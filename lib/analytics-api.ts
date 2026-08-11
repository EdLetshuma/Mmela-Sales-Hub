// Cross-business Analytics module (Executive Overview + Division Performance).
// Deliberately rides on the regular authenticated Supabase client, not a
// service-role bypass — RLS on leads/clients/policies already scopes reads
// correctly by business unit and role, so "don't leak across divisions"
// is enforced at the database, not reconstructed here.

import { supabase } from "./supabase";
import { SALES_UNIT_ID, rangeToDates, EXECUTIVE_RANGE_LABELS, type ExecutiveRange } from "./sales-api";
import { CONCIERGE_UNIT_ID } from "./concierge-api";
import { CREDIT_HEALTH_UNIT_ID } from "./credit-health-api";

export type { ExecutiveRange };
export { EXECUTIVE_RANGE_LABELS };

// A metric that has a period comparison. pctChange is null when there's no
// meaningful baseline (previous period was zero) — never divide by zero
// into a fake percentage, per spec: don't show a % change without a
// baseline to change from.
export interface PeriodMetric {
  value: number;
  prevValue: number;
  pctChange: number | null;
}

function periodMetric(curr: number, prev: number): PeriodMetric {
  if (prev === 0) return { value: curr, prevValue: prev, pctChange: null };
  return { value: curr, prevValue: prev, pctChange: Math.round(((curr - prev) / prev) * 1000) / 10 };
}

const WON_VALUES = ["Won", "Approved"];
const LOST_VALUES = ["Lost", "Declined"];

function isWon(l: { status: string | null; unit_status: string | null }): boolean {
  return l.status === "Won" || WON_VALUES.includes(l.unit_status ?? "");
}
function isLost(l: { status: string | null; unit_status: string | null }): boolean {
  return l.status === "Lost" || l.status === "Retention Failure" || LOST_VALUES.includes(l.unit_status ?? "");
}

export interface ExecutiveKpis {
  totalLeads: number;           // current total, all divisions in scope
  newLeads: PeriodMetric;
  convertedLeads: PeriodMetric;
  conversionRatePct: { value: number | null; prevValue: number | null; pointChange: number | null };
  activePolicies: number;       // current state — no meaningful "previous state" without snapshots
  newPolicies: PeriodMetric;
  totalPremium: number;         // current state
  averagePremium: number | null; // null (not 0) when there are no active policies
  lostLeads: PeriodMetric;
}

export async function getExecutiveKpis(range: ExecutiveRange = "30d"): Promise<ExecutiveKpis> {
  const now = new Date();
  const { since, prevSince, prevUntil } = rangeToDates(range, now);

  const [leadsRes, policiesRes] = await Promise.all([
    supabase.from("leads").select("id, status, unit_status, created_at, business_unit_id"),
    supabase.from("policies").select("id, status, premium, sale_date"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (policiesRes.error) throw policiesRes.error;

  const allLeads = leadsRes.data ?? [];
  const allPolicies = policiesRes.data ?? [];

  const inWindow = (createdAt: string, from: Date | null, to: Date | null) =>
    (!from || createdAt >= from.toISOString()) && (!to || createdAt < to.toISOString());

  const currLeads = allLeads.filter((l) => inWindow(l.created_at, since, null));
  const prevLeads = since && prevSince && prevUntil ? allLeads.filter((l) => inWindow(l.created_at, prevSince, prevUntil)) : [];

  const currConverted = currLeads.filter(isWon);
  const prevConverted = prevLeads.filter(isWon);
  const currLost = currLeads.filter(isLost);
  const prevLost = prevLeads.filter(isLost);

  const currRate = currLeads.length > 0 ? Math.round((currConverted.length / currLeads.length) * 1000) / 10 : null;
  const prevRate = prevLeads.length > 0 ? Math.round((prevConverted.length / prevLeads.length) * 1000) / 10 : null;

  const activePolicies = allPolicies.filter((p) => p.status === "Active");
  const totalPremium = activePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0);
  const sinceStr = since ? since.toISOString().slice(0, 10) : null;
  const currNewPolicies = sinceStr ? allPolicies.filter((p) => p.sale_date && p.sale_date >= sinceStr) : allPolicies;
  const prevNewPolicies = (prevSince && prevUntil)
    ? allPolicies.filter((p) => p.sale_date && p.sale_date >= prevSince.toISOString().slice(0, 10) && p.sale_date < prevUntil.toISOString().slice(0, 10))
    : [];

  return {
    totalLeads: allLeads.length,
    newLeads: periodMetric(currLeads.length, prevLeads.length),
    convertedLeads: periodMetric(currConverted.length, prevConverted.length),
    conversionRatePct: {
      value: currRate,
      prevValue: prevRate,
      pointChange: currRate !== null && prevRate !== null ? Math.round((currRate - prevRate) * 10) / 10 : null,
    },
    activePolicies: activePolicies.length,
    newPolicies: periodMetric(currNewPolicies.length, prevNewPolicies.length),
    totalPremium,
    averagePremium: activePolicies.length > 0 ? Math.round((totalPremium / activePolicies.length) * 100) / 100 : null,
    lostLeads: periodMetric(currLost.length, prevLost.length),
  };
}

// ============================================================
// DIVISION PERFORMANCE
// ============================================================

export type DivisionKey = "sales" | "concierge" | "creditHealth";

export interface DivisionRow {
  key: DivisionKey;
  label: string;
  leads: number;
  converted: number;
  conversionRatePct: number | null; // null = no leads to compute a rate from
  policies: number | null;          // null = not applicable (only Sales sells policies)
  premium: number | null;           // null = not applicable
}

export interface DivisionMonthlyPoint {
  month: string;
  sales: number;
  concierge: number;
  creditHealth: number;
}

export interface DivisionPerformance {
  rows: DivisionRow[];
  monthlyTrend: DivisionMonthlyPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getDivisionPerformance(range: ExecutiveRange = "30d"): Promise<DivisionPerformance> {
  const now = new Date();
  const { since } = rangeToDates(range, now);

  const [leadsRes, policiesRes] = await Promise.all([
    supabase.from("leads").select("id, status, unit_status, created_at, business_unit_id"),
    supabase.from("policies").select("id, status, premium"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (policiesRes.error) throw policiesRes.error;

  const allLeads = leadsRes.data ?? [];
  const activePolicies = (policiesRes.data ?? []).filter((p) => p.status === "Active");
  const salesPremium = activePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0);

  const isSales = (bu: string | null) => !bu || bu === SALES_UNIT_ID;
  const inRange = (createdAt: string) => !since || createdAt >= since.toISOString();

  const bucket = (pred: (bu: string | null) => boolean) => allLeads.filter((l) => pred(l.business_unit_id) && inRange(l.created_at));

  const salesLeads = bucket(isSales);
  const conciergeLeads = bucket((bu) => bu === CONCIERGE_UNIT_ID);
  const creditHealthLeads = bucket((bu) => bu === CREDIT_HEALTH_UNIT_ID);

  function row(key: DivisionKey, label: string, leads: typeof salesLeads, includePolicies: boolean): DivisionRow {
    const converted = leads.filter(isWon).length;
    return {
      key, label,
      leads: leads.length,
      converted,
      conversionRatePct: leads.length > 0 ? Math.round((converted / leads.length) * 1000) / 10 : null,
      policies: includePolicies ? activePolicies.length : null,
      premium: includePolicies ? salesPremium : null,
    };
  }

  const rows: DivisionRow[] = [
    row("sales", "Sales", salesLeads, true),
    row("concierge", "Concierge", conciergeLeads, false),
    row("creditHealth", "Credit Health", creditHealthLeads, false),
  ];

  const monthlyTrend: DivisionMonthlyPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = (l: { created_at: string }) => l.created_at >= start.toISOString() && l.created_at < end.toISOString();
    monthlyTrend.push({
      month: MONTH_LABELS[start.getMonth()],
      sales: allLeads.filter((l) => isSales(l.business_unit_id) && inMonth(l)).length,
      concierge: allLeads.filter((l) => l.business_unit_id === CONCIERGE_UNIT_ID && inMonth(l)).length,
      creditHealth: allLeads.filter((l) => l.business_unit_id === CREDIT_HEALTH_UNIT_ID && inMonth(l)).length,
    });
  }

  return { rows, monthlyTrend };
}
