// Lead Analytics (Phase 2 of the Analytics module): Lead Overview, Lead
// Funnel, Lead Sources, Lead Aging, Lost Leads.
//
// Same rule as Phase 1: rides on the regular authenticated Supabase client
// so RLS (scoped by business unit + role) does the access control, not
// this file. Every stage/status label used here comes from the real enum
// values or the real app-level status lists — nothing invented.

import { supabase } from "./supabase";
import { SALES_UNIT_ID, rangeToDates, type ExecutiveRange } from "./sales-api";
import { CONCIERGE_UNIT_ID, CONCIERGE_STATUSES } from "./concierge-api";
import { CREDIT_HEALTH_UNIT_ID, CREDIT_HEALTH_STATUSES } from "./credit-health-api";
import type { PeriodMetric } from "./analytics-api";

interface RawLead {
  id: string;
  name: string;
  status: string | null;
  unit_status: string | null;
  segment: string | null;
  source: string | null;
  source_type: string | null;
  campaign: string | null;
  business_unit_id: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
  closed_at: string | null;
  loss_reason: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  employment_status: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  client_id: string | null;
}

const LEAD_COLUMNS = "id, name, status, unit_status, segment, source, source_type, campaign, business_unit_id, assigned_to_user_id, created_at, closed_at, loss_reason, vehicle_make, vehicle_model, employment_status, utm_source, utm_medium, utm_campaign, utm_content, utm_term, client_id";

const WON_VALUES = ["Won", "Approved"];
const LOST_VALUES = ["Lost", "Declined"];

function isSales(bu: string | null): boolean { return !bu || bu === SALES_UNIT_ID; }
function divisionOf(bu: string | null): "sales" | "concierge" | "creditHealth" {
  if (bu === CONCIERGE_UNIT_ID) return "concierge";
  if (bu === CREDIT_HEALTH_UNIT_ID) return "creditHealth";
  return "sales";
}
function currentStatus(l: RawLead): string {
  return isSales(l.business_unit_id) ? (l.status ?? "Prospect") : (l.unit_status ?? "New");
}
function isWon(l: RawLead): boolean {
  return l.status === "Won" || WON_VALUES.includes(l.unit_status ?? "");
}
function isLost(l: RawLead): boolean {
  return l.status === "Lost" || l.status === "Retention Failure" || LOST_VALUES.includes(l.unit_status ?? "");
}

function periodMetric(curr: number, prev: number): PeriodMetric {
  if (prev === 0) return { value: curr, prevValue: prev, pctChange: null };
  return { value: curr, prevValue: prev, pctChange: Math.round(((curr - prev) / prev) * 1000) / 10 };
}

// Every Lead Analytics query can be scoped two ways: to one division
// (e.g. viewing this from inside the Sales module rather than Executive's
// cross-division rollup), and to one user's own leads (a Sales Agent
// looking at "my performance" shouldn't see teammates' leads). Both are
// optional — Executive's cross-division views pass neither.
export interface LeadScope {
  division?: "sales" | "concierge" | "creditHealth";
  onlyUserId?: string;
}

function applyScope(leads: RawLead[], scope?: LeadScope): RawLead[] {
  let out = leads;
  if (scope?.division) out = out.filter((l) => divisionOf(l.business_unit_id) === scope.division);
  if (scope?.onlyUserId) out = out.filter((l) => l.assigned_to_user_id === scope.onlyUserId);
  return out;
}

export interface BreakdownRow { label: string; count: number; }

function breakdown(leads: RawLead[], key: (l: RawLead) => string | null, fallback = "Unknown"): BreakdownRow[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const k = key(l) || fallback;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// ============================================================
// LEAD OVERVIEW
// ============================================================

export interface LeadOverviewData {
  totalLeads: number;
  newLeads: PeriodMetric;
  activeLeads: number;       // currently open (closed_at is null), current state
  convertedLeads: PeriodMetric;
  lostLeads: PeriodMetric;
  conversionRatePct: number | null;
  avgLeadAgeDays: number | null; // average age of currently-open leads, in days
  breakdowns: {
    businessUnit: BreakdownRow[];
    status: BreakdownRow[];
    source: BreakdownRow[];
    sourceType: BreakdownRow[];
    campaign: BreakdownRow[];
    segment: BreakdownRow[];
    assignedAgent: BreakdownRow[];
  };
}

export async function getLeadOverview(range: ExecutiveRange = "30d", scope?: LeadScope): Promise<LeadOverviewData> {
  const now = new Date();
  const { since, prevSince, prevUntil } = rangeToDates(range, now);

  const [leadsRes, usersRes] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS),
    supabase.from("users").select("id, name"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (usersRes.error) throw usersRes.error;

  const allLeads = applyScope((leadsRes.data ?? []) as RawLead[], scope);
  const userNames = new Map((usersRes.data ?? []).map((u) => [u.id, u.name]));

  const inWindow = (createdAt: string, from: Date | null, to: Date | null) =>
    (!from || createdAt >= from.toISOString()) && (!to || createdAt < to.toISOString());

  const currLeads = allLeads.filter((l) => inWindow(l.created_at, since, null));
  const prevLeads = since && prevSince && prevUntil ? allLeads.filter((l) => inWindow(l.created_at, prevSince, prevUntil)) : [];

  const currConverted = currLeads.filter(isWon);
  const prevConverted = prevLeads.filter(isWon);
  const currLost = currLeads.filter(isLost);
  const prevLost = prevLeads.filter(isLost);
  const conversionRatePct = currLeads.length > 0 ? Math.round((currConverted.length / currLeads.length) * 1000) / 10 : null;

  const openLeads = allLeads.filter((l) => !l.closed_at);
  const avgLeadAgeDays = openLeads.length > 0
    ? Math.round(openLeads.reduce((s, l) => s + (now.getTime() - new Date(l.created_at).getTime()) / 86_400_000, 0) / openLeads.length)
    : null;

  return {
    totalLeads: allLeads.length,
    newLeads: periodMetric(currLeads.length, prevLeads.length),
    activeLeads: openLeads.length,
    convertedLeads: periodMetric(currConverted.length, prevConverted.length),
    lostLeads: periodMetric(currLost.length, prevLost.length),
    conversionRatePct,
    avgLeadAgeDays,
    breakdowns: {
      businessUnit: breakdown(currLeads, (l) => ({ sales: "Sales", concierge: "Concierge", creditHealth: "Credit Health" }[divisionOf(l.business_unit_id)])),
      status: breakdown(currLeads, currentStatus),
      source: breakdown(currLeads, (l) => l.source),
      sourceType: breakdown(currLeads, (l) => l.source_type),
      campaign: breakdown(currLeads, (l) => l.campaign),
      segment: breakdown(currLeads, (l) => l.segment),
      assignedAgent: breakdown(currLeads, (l) => (l.assigned_to_user_id ? userNames.get(l.assigned_to_user_id) ?? "Unknown agent" : "Unassigned")),
    },
  };
}

// ============================================================
// LEAD FUNNEL — stages come straight from the real status lists, per
// division, since Sales/Concierge/Credit Health don't share one funnel.
// ============================================================

export type FunnelDivision = "sales" | "concierge" | "creditHealth";

const FUNNEL_STAGES: Record<FunnelDivision, string[]> = {
  sales: ["Prospect", "Contacted", "Quoted", "Won"],
  concierge: CONCIERGE_STATUSES.filter((s) => s !== "Lost" && s !== "On Hold"),
  creditHealth: CREDIT_HEALTH_STATUSES.filter((s) => s !== "Declined"),
};

export interface FunnelStage {
  stage: string;
  count: number;
  pctOfTotal: number;
  pctOfPrevStage: number | null; // stage-to-stage conversion; null for the first stage
}

export interface FunnelData {
  division: FunnelDivision;
  stages: FunnelStage[];
  overallConversionPct: number | null;
  leadsByStage: Record<string, { id: string; name: string }[]>;
}

export async function getLeadFunnel(division: FunnelDivision, range: ExecutiveRange = "30d", onlyUserId?: string): Promise<FunnelData> {
  const now = new Date();
  const { since } = rangeToDates(range, now);
  const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS);
  if (error) throw error;
  const allLeads = (data ?? []) as RawLead[];

  const buId = division === "sales" ? null : division === "concierge" ? CONCIERGE_UNIT_ID : CREDIT_HEALTH_UNIT_ID;
  const inDivision = (l: RawLead) => (division === "sales" ? isSales(l.business_unit_id) : l.business_unit_id === buId);
  const leads = allLeads.filter((l) =>
    inDivision(l) && (!since || l.created_at >= since.toISOString()) && (!onlyUserId || l.assigned_to_user_id === onlyUserId)
  );

  const stageOrder = FUNNEL_STAGES[division];
  const leadsByStage: Record<string, { id: string; name: string }[]> = {};
  for (const stage of stageOrder) leadsByStage[stage] = [];

  // A lead "reaches" every stage up to and including its current one —
  // Won leads passed through Prospect/Contacted/Quoted on the way.
  for (const l of leads) {
    const current = currentStatus(l);
    const idx = stageOrder.indexOf(current);
    const reachedUpTo = idx === -1 ? -1 : idx;
    for (let i = 0; i <= reachedUpTo; i++) leadsByStage[stageOrder[i]].push({ id: l.id, name: l.name });
  }

  const total = leads.length;
  const stages: FunnelStage[] = stageOrder.map((stage, i) => {
    const count = leadsByStage[stage].length;
    const prevCount = i === 0 ? null : leadsByStage[stageOrder[i - 1]].length;
    return {
      stage,
      count,
      pctOfTotal: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      pctOfPrevStage: prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : null,
    };
  });

  const lastStageCount = stages[stages.length - 1]?.count ?? 0;
  return {
    division,
    stages,
    overallConversionPct: total > 0 ? Math.round((lastStageCount / total) * 1000) / 10 : null,
    leadsByStage,
  };
}

// ============================================================
// LEAD SOURCES
// ============================================================

export interface SourceRow {
  label: string;
  leads: number;
  converted: number;
  conversionRatePct: number | null;
  policies: number;
  premium: number;
}

export interface LeadSourceData {
  bySource: SourceRow[];
  bySourceType: SourceRow[];
  byUtmSource: SourceRow[];
  byUtmMedium: SourceRow[];
  byUtmCampaign: SourceRow[];
}

async function buildSourceRows(leads: RawLead[], key: (l: RawLead) => string | null, premiumByClient: Map<string, { count: number; premium: number }>): Promise<SourceRow[]> {
  const groups = new Map<string, RawLead[]>();
  for (const l of leads) {
    const k = key(l);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }
  return Array.from(groups.entries()).map(([label, group]) => {
    const converted = group.filter(isWon).length;
    let policies = 0, premium = 0;
    for (const l of group) {
      if (l.client_id) {
        const p = premiumByClient.get(l.client_id);
        if (p) { policies += p.count; premium += p.premium; }
      }
    }
    return {
      label,
      leads: group.length,
      converted,
      conversionRatePct: group.length > 0 ? Math.round((converted / group.length) * 1000) / 10 : null,
      policies,
      premium: Math.round(premium * 100) / 100,
    };
  }).sort((a, b) => b.leads - a.leads);
}

export async function getLeadSources(range: ExecutiveRange = "30d", scope?: LeadScope): Promise<LeadSourceData> {
  const now = new Date();
  const { since } = rangeToDates(range, now);
  const [leadsRes, policiesRes] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS),
    supabase.from("policies").select("client_id, status, premium"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (policiesRes.error) throw policiesRes.error;

  const allLeads = applyScope((leadsRes.data ?? []) as RawLead[], scope).filter((l) => !since || l.created_at >= since.toISOString());

  // Premium/policy count attributed via each lead's linked client — a
  // client with more than one lead would see that premium counted once
  // per lead here, since there's no direct lead→policy link in the schema.
  const premiumByClient = new Map<string, { count: number; premium: number }>();
  for (const p of policiesRes.data ?? []) {
    if (!p.client_id || p.status !== "Active") continue;
    const curr = premiumByClient.get(p.client_id) ?? { count: 0, premium: 0 };
    curr.count += 1;
    curr.premium += Number(p.premium) || 0;
    premiumByClient.set(p.client_id, curr);
  }

  const [bySource, bySourceType, byUtmSource, byUtmMedium, byUtmCampaign] = await Promise.all([
    buildSourceRows(allLeads, (l) => l.source, premiumByClient),
    buildSourceRows(allLeads, (l) => l.source_type, premiumByClient),
    buildSourceRows(allLeads, (l) => l.utm_source, premiumByClient),
    buildSourceRows(allLeads, (l) => l.utm_medium, premiumByClient),
    buildSourceRows(allLeads, (l) => l.utm_campaign, premiumByClient),
  ]);

  return { bySource, bySourceType, byUtmSource, byUtmMedium, byUtmCampaign };
}

// ============================================================
// LEAD AGING — current snapshot of open leads, not range-filtered.
// ============================================================

export interface AgingBucket { label: string; count: number; leads: { id: string; name: string; ageDays: number }[]; }

export async function getLeadAging(scope?: LeadScope): Promise<{ buckets: AgingBucket[]; hasActivityData: boolean }> {
  const now = new Date();
  const [leadsRes, activityRes] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS).is("closed_at", null),
    supabase.from("lead_activities").select("id").limit(1),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (activityRes.error) throw activityRes.error;

  const open = applyScope((leadsRes.data ?? []) as RawLead[], scope);
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: "0–1 days", min: 0, max: 1 },
    { label: "2–3 days", min: 2, max: 3 },
    { label: "4–7 days", min: 4, max: 7 },
    { label: "8–14 days", min: 8, max: 14 },
    { label: "15–30 days", min: 15, max: 30 },
    { label: "30+ days", min: 31, max: Infinity },
  ];

  const buckets: AgingBucket[] = bucketDefs.map((b) => ({ label: b.label, count: 0, leads: [] }));
  for (const l of open) {
    const ageDays = Math.floor((now.getTime() - new Date(l.created_at).getTime()) / 86_400_000);
    const idx = bucketDefs.findIndex((b) => ageDays >= b.min && ageDays <= b.max);
    if (idx >= 0) {
      buckets[idx].count++;
      buckets[idx].leads.push({ id: l.id, name: l.name, ageDays });
    }
  }

  return { buckets, hasActivityData: (activityRes.data ?? []).length > 0 };
}

// ============================================================
// LOST LEADS
// ============================================================

export interface LossReasonRow { reason: string; count: number; }
export interface LostLeadsData {
  totalLost: PeriodMetric;
  lossRatePct: number | null; // lost / (lost + won) in period
  byReason: LossReasonRow[];  // Sales only — loss_reason isn't captured for Concierge/Credit Health
  byDivision: BreakdownRow[];
  byAgent: BreakdownRow[];
  bySource: BreakdownRow[];
}

export async function getLostLeads(range: ExecutiveRange = "30d", scope?: LeadScope): Promise<LostLeadsData> {
  const now = new Date();
  const { since, prevSince, prevUntil } = rangeToDates(range, now);
  const [leadsRes, usersRes] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS),
    supabase.from("users").select("id, name"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (usersRes.error) throw usersRes.error;

  const allLeads = applyScope((leadsRes.data ?? []) as RawLead[], scope);
  const userNames = new Map((usersRes.data ?? []).map((u) => [u.id, u.name]));
  const inWindow = (createdAt: string, from: Date | null, to: Date | null) =>
    (!from || createdAt >= from.toISOString()) && (!to || createdAt < to.toISOString());

  const currLeads = allLeads.filter((l) => inWindow(l.created_at, since, null));
  const prevLeads = since && prevSince && prevUntil ? allLeads.filter((l) => inWindow(l.created_at, prevSince, prevUntil)) : [];
  const currLost = currLeads.filter(isLost);
  const prevLost = prevLeads.filter(isLost);
  const currWon = currLeads.filter(isWon);

  const closedTotal = currLost.length + currWon.length;

  return {
    totalLost: periodMetric(currLost.length, prevLost.length),
    lossRatePct: closedTotal > 0 ? Math.round((currLost.length / closedTotal) * 1000) / 10 : null,
    byReason: breakdown(currLost.filter((l) => isSales(l.business_unit_id)), (l) => l.loss_reason, "Not recorded").map((r) => ({ reason: r.label, count: r.count })),
    byDivision: breakdown(currLost, (l) => ({ sales: "Sales", concierge: "Concierge", creditHealth: "Credit Health" }[divisionOf(l.business_unit_id)])),
    byAgent: breakdown(currLost, (l) => (l.assigned_to_user_id ? userNames.get(l.assigned_to_user_id) ?? "Unknown agent" : "Unassigned")),
    bySource: breakdown(currLost, (l) => l.source),
  };
}
