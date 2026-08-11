// Sales Performance / Agent Performance / Products / Premium — the "Sales"
// branch of the division-scoped Analytics area. Rides on the regular
// authenticated client; RLS + the onlyUserId scope together are what keep
// a Sales Agent from seeing a teammate's numbers.

import { supabase } from "./supabase";
import { rangeToDates, SALES_UNIT_ID, type ExecutiveRange } from "./sales-api";

const isSales = (bu: string | null) => !bu || bu === SALES_UNIT_ID;

interface RawPolicy {
  id: string;
  status: string | null;
  premium: number | null;
  base_premium: number | null;
  sale_date: string | null;
  sold_by_user_id: string | null;
  product_name: string | null;
  product_category: string | null;
  category: string | null;
  client_segment: string | null;
}

interface RawLead {
  id: string;
  status: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
  business_unit_id: string | null;
}

const POLICY_COLUMNS = "id, status, premium, base_premium, sale_date, sold_by_user_id, product_name, product_category, category, client_segment";

// ============================================================
// SALES PERFORMANCE (+ AGENT PERFORMANCE, combined into one leaderboard)
// ============================================================

export interface SalesPerformanceKpis {
  totalPoliciesSold: number;     // sold within the selected period
  totalPremium: number;          // active policies, current state
  averagePremium: number | null;
  conversionRatePct: number | null; // Sales-only, leads created in period
}

export interface AgentRow {
  userId: string;
  name: string;
  role: string;
  leads: number;
  converted: number;
  lost: number;
  conversionRatePct: number | null;
  policiesSold: number;
  premiumGenerated: number;
}

export interface SalesPerformanceData {
  kpis: SalesPerformanceKpis;
  agents: AgentRow[]; // when onlyUserId is set, this has at most one row — the caller's own
}

export async function getSalesPerformance(range: ExecutiveRange = "30d", onlyUserId?: string): Promise<SalesPerformanceData> {
  const now = new Date();
  const { since } = rangeToDates(range, now);
  const sinceStr = since ? since.toISOString().slice(0, 10) : null;

  const [policiesRes, leadsRes, usersRes] = await Promise.all([
    supabase.from("policies").select(POLICY_COLUMNS),
    supabase.from("leads").select("id, status, assigned_to_user_id, created_at, business_unit_id"),
    supabase.from("users").select("id, name, role"),
  ]);
  if (policiesRes.error) throw policiesRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (usersRes.error) throw usersRes.error;

  let policies = (policiesRes.data ?? []) as RawPolicy[];
  let leads = ((leadsRes.data ?? []) as RawLead[]).filter((l) => isSales(l.business_unit_id));
  const users = usersRes.data ?? [];
  if (onlyUserId) {
    policies = policies.filter((p) => p.sold_by_user_id === onlyUserId);
    leads = leads.filter((l) => l.assigned_to_user_id === onlyUserId);
  }

  const inPeriod = (l: RawLead) => !since || l.created_at >= since.toISOString();
  const periodLeads = leads.filter(inPeriod);
  const won = periodLeads.filter((l) => l.status === "Won");
  const conversionRatePct = periodLeads.length > 0 ? Math.round((won.length / periodLeads.length) * 1000) / 10 : null;

  const activePolicies = policies.filter((p) => p.status === "Active");
  const totalPremium = activePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0);
  const soldInPeriod = sinceStr ? policies.filter((p) => p.sale_date && p.sale_date >= sinceStr) : policies;

  const userNames = new Map(users.map((u) => [u.id, { name: u.name, role: u.role }]));
  const agentIds = onlyUserId ? [onlyUserId] : Array.from(new Set([...leads.map((l) => l.assigned_to_user_id), ...policies.map((p) => p.sold_by_user_id)].filter((id): id is string => !!id)));

  const agents: AgentRow[] = agentIds.map((userId) => {
    const info = userNames.get(userId);
    const agentLeads = periodLeads.filter((l) => l.assigned_to_user_id === userId);
    const agentConverted = agentLeads.filter((l) => l.status === "Won");
    const agentLost = agentLeads.filter((l) => l.status === "Lost" || l.status === "Retention Failure");
    const agentPolicies = soldInPeriod.filter((p) => p.sold_by_user_id === userId);
    return {
      userId,
      name: info?.name ?? "Unknown",
      role: info?.role ?? "—",
      leads: agentLeads.length,
      converted: agentConverted.length,
      lost: agentLost.length,
      conversionRatePct: agentLeads.length > 0 ? Math.round((agentConverted.length / agentLeads.length) * 1000) / 10 : null,
      policiesSold: agentPolicies.length,
      premiumGenerated: Math.round(agentPolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0) * 100) / 100,
    };
  }).sort((a, b) => b.premiumGenerated - a.premiumGenerated);

  return {
    kpis: {
      totalPoliciesSold: soldInPeriod.length,
      totalPremium: Math.round(totalPremium * 100) / 100,
      averagePremium: activePolicies.length > 0 ? Math.round((totalPremium / activePolicies.length) * 100) / 100 : null,
      conversionRatePct,
    },
    agents,
  };
}

// ============================================================
// PRODUCTS
// ============================================================

export interface ProductRow {
  label: string;
  policies: number;
  premium: number;
  averagePremium: number;
}

export async function getProductPerformance(range: ExecutiveRange = "30d"): Promise<{ byProduct: ProductRow[]; byCategory: ProductRow[] }> {
  const now = new Date();
  const { since } = rangeToDates(range, now);
  const sinceStr = since ? since.toISOString().slice(0, 10) : null;
  const { data, error } = await supabase.from("policies").select(POLICY_COLUMNS);
  if (error) throw error;

  const policies = ((data ?? []) as RawPolicy[]).filter((p) => !sinceStr || (p.sale_date && p.sale_date >= sinceStr));

  function group(key: (p: RawPolicy) => string | null): ProductRow[] {
    const map = new Map<string, RawPolicy[]>();
    for (const p of policies) {
      const k = key(p);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).map(([label, group]) => {
      const premium = group.reduce((s, p) => s + (Number(p.premium) || 0), 0);
      return { label, policies: group.length, premium: Math.round(premium * 100) / 100, averagePremium: Math.round((premium / group.length) * 100) / 100 };
    }).sort((a, b) => b.policies - a.policies);
  }

  return { byProduct: group((p) => p.product_name), byCategory: group((p) => p.category) };
}

// ============================================================
// PREMIUM
// ============================================================

export interface PremiumTrendPoint { month: string; premium: number; }

export interface PremiumData {
  bySegment: ProductRow[];
  byAgent: ProductRow[];
  trend: PremiumTrendPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getPremiumAnalytics(): Promise<PremiumData> {
  const now = new Date();
  const [policiesRes, usersRes] = await Promise.all([
    supabase.from("policies").select(POLICY_COLUMNS),
    supabase.from("users").select("id, name"),
  ]);
  if (policiesRes.error) throw policiesRes.error;
  if (usersRes.error) throw usersRes.error;

  const policies = (policiesRes.data ?? []) as RawPolicy[];
  const active = policies.filter((p) => p.status === "Active");
  const userNames = new Map((usersRes.data ?? []).map((u) => [u.id, u.name]));

  function group(list: RawPolicy[], key: (p: RawPolicy) => string | null): ProductRow[] {
    const map = new Map<string, RawPolicy[]>();
    for (const p of list) {
      const k = key(p);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).map(([label, group]) => {
      const premium = group.reduce((s, p) => s + (Number(p.premium) || 0), 0);
      return { label, policies: group.length, premium: Math.round(premium * 100) / 100, averagePremium: Math.round((premium / group.length) * 100) / 100 };
    }).sort((a, b) => b.premium - a.premium);
  }

  const trend: PremiumTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const sold = policies.filter((p) => p.sale_date && p.sale_date >= startStr && p.sale_date < endStr);
    trend.push({ month: MONTH_LABELS[start.getMonth()], premium: Math.round(sold.reduce((s, p) => s + (Number(p.premium) || 0), 0) * 100) / 100 });
  }

  return {
    bySegment: group(active, (p) => p.client_segment),
    byAgent: group(active, (p) => (p.sold_by_user_id ? userNames.get(p.sold_by_user_id) ?? "Unknown" : null)),
    trend,
  };
}
