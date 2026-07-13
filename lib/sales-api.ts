import { supabase } from "./supabase";
import type { ClientSegment } from "@/types";
import { CONCIERGE_UNIT_ID } from "./concierge-api";
import { CREDIT_HEALTH_UNIT_ID } from "./credit-health-api";

// The Sales business unit's id — most legacy Sales leads predate business
// units and have a null business_unit_id, so "is a Sales lead" means
// "not tagged as Concierge or Credit Health" rather than an exact match.
export const SALES_UNIT_ID = "75299d6f-408d-4f5c-8e91-63ac5d965866";

// ============================================================
// SHARED TYPES
// ============================================================

export interface SalesUser {
  id: string;
  name: string;
  role: string;
  email?: string;
  specialization?: string;
}

export interface AppointmentDetails {
  date: string;
  time: string;
  location: string;
  outcome?: string;
  notes?: string;
}

export interface PrimaryContact {
  name: string;
  email: string;
  phone: string;
}

export interface SalesQuote {
  id: string;
  quoteNumber: string;
  underwriter: string;
  productCategory: string;
  productName: string;
  basePremium: number;
  status: "Pending" | "Accepted" | "Rejected";
  createdAt: string;
}

export interface VAP {
  id: string;
  name: string;
  premium: number;
  underwriter?: string;
}

// ============================================================
// LEADS
// ============================================================

export interface SalesLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  segment?: ClientSegment;
  status?: string;
  source?: string;
  source_type?: string;
  campaign?: string;
  campaign_id?: string;
  referred_by?: string;
  assigned_to_user_id?: string;
  notes?: string;
  quotes?: SalesQuote[];
  loss_reason?: string;
  lost_policy_details?: Record<string, unknown>;
  client_id?: string;
  appointment_details?: AppointmentDetails;
  primary_contact?: PrimaryContact;
  industry?: string;
  scheme_details?: Record<string, unknown>;
  company_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadFilters {
  segment?: ClientSegment;
  status?: string;
  source?: string;
  assigned?: "assigned" | "unassigned" | "mine";
  search?: string;
  userId?: string;
}

export async function getLeads(filters?: LeadFilters): Promise<SalesLead[]> {
  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.segment) query = query.eq("segment", filters.segment);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.source) query = query.eq("source", filters.source);
  if (filters?.assigned === "unassigned") query = query.is("assigned_to_user_id", null);
  if (filters?.assigned === "assigned") query = query.not("assigned_to_user_id", "is", null);
  if (filters?.assigned === "mine" && filters.userId) {
    query = query.eq("assigned_to_user_id", filters.userId);
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLead(id: string): Promise<SalesLead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ── Duplicate detection ───────────────────────────────────────────
export async function checkDuplicateLeads(
  phone: string | null | undefined,
  email: string | null | undefined,
  excludeId?: string
): Promise<{
  id: string; name: string; phone: string | null; email: string | null;
  status: string; source: string | null; assigned_to: string | null;
  created_at: string;
}[]> {
  const cleanPhone = phone?.trim() || null;
  const cleanEmail = email?.trim().toLowerCase() || null;

  // Skip check if both are empty or placeholder
  if (
    (!cleanPhone || cleanPhone === "n/a") &&
    (!cleanEmail || cleanEmail.includes("@placeholder.com"))
  ) {
    return [];
  }

  const { data, error } = await supabase.rpc("find_duplicate_leads", {
    p_phone:      cleanPhone,
    p_email:      cleanEmail?.includes("@placeholder.com") ? null : cleanEmail,
    p_exclude_id: excludeId ?? null,
  });

  if (error) {
    console.error("Duplicate check error:", error);
    return [];
  }
  return data ?? [];
}

export interface DuplicateClientMatch {
  id: string; name: string; phone: string | null; email: string | null;
  id_number: string | null; segment: string | null; join_date: string | null;
}

export async function checkDuplicateClients(
  phone: string | null | undefined,
  email: string | null | undefined,
  idNumber?: string | null,
  excludeId?: string
): Promise<DuplicateClientMatch[]> {
  const cleanPhone = phone?.trim() || null;
  const cleanEmail = email?.trim().toLowerCase() || null;
  const cleanIdNumber = idNumber?.trim() || null;

  if (
    (!cleanPhone || cleanPhone === "n/a") &&
    (!cleanEmail || cleanEmail.includes("@placeholder.com")) &&
    !cleanIdNumber
  ) {
    return [];
  }

  const { data, error } = await supabase.rpc("find_duplicate_clients", {
    p_phone:      cleanPhone,
    p_email:      cleanEmail?.includes("@placeholder.com") ? null : cleanEmail,
    p_id_number:  cleanIdNumber,
    p_exclude_id: excludeId ?? null,
  });

  if (error) {
    console.error("Duplicate client check error:", error);
    return [];
  }
  return data ?? [];
}

export interface DuplicatePolicyMatch {
  id: string; policy_number: string; client_id: string | null; client_name: string | null;
  insurer: string | null; product_name: string | null; status: string;
}

export async function checkDuplicatePolicies(
  policyNumber: string | null | undefined,
  clientId?: string | null,
  insurer?: string | null,
  productName?: string | null,
  excludeId?: string
): Promise<DuplicatePolicyMatch[]> {
  const cleanNumber = policyNumber?.trim() || null;
  if (!cleanNumber && !(clientId && insurer && productName)) return [];

  const { data, error } = await supabase.rpc("find_duplicate_policies", {
    p_policy_number: cleanNumber,
    p_client_id: clientId ?? null,
    p_insurer: insurer ?? null,
    p_product_name: productName ?? null,
    p_exclude_id: excludeId ?? null,
  });

  if (error) {
    console.error("Duplicate policy check error:", error);
    return [];
  }
  return data ?? [];
}

export async function createLead(
  lead: Omit<SalesLead, "id" | "created_at" | "updated_at">
): Promise<SalesLead> {
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...lead, source_type: lead.source_type ?? "manual_entry" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(
  id: string,
  updates: Partial<SalesLead>
): Promise<SalesLead> {
  const { data, error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function assignLead(
  leadId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({
      assigned_to_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw error;
}

export async function convertLeadToClient(leadId: string): Promise<string> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      segment: lead.segment,
      source: lead.source,
      industry: lead.industry,
      primary_contact: lead.primary_contact,
      join_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (clientError) throw clientError;

  await updateLead(leadId, { client_id: client.id, status: "Won" });
  return client.id;
}

// ============================================================
// CLIENTS
// ============================================================

export interface SalesClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  id_number?: string;
  address?: string;
  join_date?: string;
  segment?: ClientSegment;
  policy_ids?: string[];
  title?: string;
  date_of_birth?: string;
  marital_status?: string;
  occupation?: string;
  communication_preference?: string;
  primary_contact?: PrimaryContact;
  industry?: string;
  website?: string;
  source?: string;
  notes?: unknown[];
  audit_trail?: unknown[];
  documents?: unknown[];
  created_by_user_id?: string;
}

export interface ClientFilters {
  segment?: ClientSegment;
  search?: string;
}

export async function getClients(
  filters?: ClientFilters
): Promise<SalesClient[]> {
  let query = supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  if (filters?.segment) query = query.eq("segment", filters.segment);
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,id_number.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getClient(id: string): Promise<SalesClient | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(
  id: string,
  updates: Partial<SalesClient>
): Promise<SalesClient> {
  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// POLICIES
// ============================================================

export interface SalesPolicy {
  id: string;
  policy_number: string;
  client_id?: string;
  client_segment?: ClientSegment;
  product_category?: string;
  product_name?: string;
  category?: string;
  insurer?: string;
  base_premium?: number;
  premium?: number;
  inception_date?: string;
  cancellation_date?: string;
  sale_date?: string;
  status?: string;
  documentation_status?: string;
  document_link?: string;
  retention_attempt_failed?: boolean;
  retention_details?: Record<string, unknown>;
  vaps?: VAP[];
  notes?: unknown[];
  documents?: unknown[];
  sold_by_user_id?: string;
}

export interface PolicyFilters {
  segment?: ClientSegment;
  status?: string;
  insurer?: string;
  product_category?: string;
  documentation_status?: string;
  search?: string;
  clientId?: string;
}

export async function getPolicies(
  filters?: PolicyFilters
): Promise<SalesPolicy[]> {
  let query = supabase
    .from("policies")
    .select("*")
    .order("inception_date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.insurer) query = query.eq("insurer", filters.insurer);
  if (filters?.product_category)
    query = query.eq("product_category", filters.product_category);
  if (filters?.documentation_status)
    query = query.eq("documentation_status", filters.documentation_status);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);
  if (filters?.segment) query = query.eq("client_segment", filters.segment);
  if (filters?.search) query = query.ilike("policy_number", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPolicy(id: string): Promise<SalesPolicy | null> {
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPolicy(
  policy: Omit<SalesPolicy, "id">
): Promise<SalesPolicy> {
  const { data, error } = await supabase
    .from("policies")
    .insert(policy)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePolicy(
  id: string,
  updates: Partial<SalesPolicy>
): Promise<SalesPolicy> {
  const { data, error } = await supabase
    .from("policies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// RETENTIONS
// ============================================================

export async function getPoliciesForRetention(
  segment?: ClientSegment
): Promise<SalesPolicy[]> {
  let query = supabase
    .from("policies")
    .select("*")
    .in("status", ["Canceled", "Expired"])
    .order("cancellation_date", { ascending: false });

  if (segment) query = query.eq("client_segment", segment);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function retainPolicy(
  policyId: string,
  retainedByUserId: string,
  previousPolicyNumber: string,
  previousPremium: number
): Promise<SalesPolicy> {
  return updatePolicy(policyId, {
    status: "Retained",
    retention_attempt_failed: false,
    retention_details: {
      previousPolicyNumber,
      previousPremium,
      retainedAt: new Date().toISOString(),
      retainedBy: retainedByUserId,
    },
  });
}

export async function markRetentionFailed(
  policyId: string
): Promise<SalesPolicy> {
  return updatePolicy(policyId, { retention_attempt_failed: true });
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface SalesDashboardStats {
  totalLeads: number;
  leadsThisMonth: number;
  totalClients: number;
  activePolicies: number;
  totalMonthlyPremium: number;
  conversionRate: number;
  pipeline: {
    prospect: number;
    contacted: number;
    quoted: number;
    won: number;
    lost: number;
  };
  unassignedLeads: number;
}

export async function getDashboardStats(
  segment?: ClientSegment
): Promise<SalesDashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();

  let leadsQuery = supabase
    .from("leads")
    .select("id, status, assigned_to_user_id, created_at, segment")
    .or(`business_unit_id.is.null,business_unit_id.eq.${SALES_UNIT_ID}`);
  let policiesQuery = supabase
    .from("policies")
    .select("id, status, premium, client_segment");
  let clientsQuery = supabase.from("clients").select("id, segment");

  if (segment) {
    leadsQuery = leadsQuery.eq("segment", segment);
    policiesQuery = policiesQuery.eq("client_segment", segment);
    clientsQuery = clientsQuery.eq("segment", segment);
  }

  const [leadsRes, policiesRes, clientsRes] = await Promise.all([
    leadsQuery,
    policiesQuery,
    clientsQuery,
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (policiesRes.error) throw policiesRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const leads = leadsRes.data || [];
  const policies = policiesRes.data || [];
  const clients = clientsRes.data || [];

  const leadsThisMonth = leads.filter(
    (l) => l.created_at && l.created_at >= startOfMonth
  ).length;

  const activePolicies = policies.filter((p) => p.status === "Active");
  const totalMonthlyPremium = activePolicies.reduce(
    (sum, p) => sum + (Number(p.premium) || 0),
    0
  );

  const won = leads.filter((l) => l.status === "Won").length;
  const conversionRate =
    leads.length > 0
      ? Math.round((won / leads.length) * 1000) / 10
      : 0;

  return {
    totalLeads: leads.length,
    leadsThisMonth,
    totalClients: clients.length,
    activePolicies: activePolicies.length,
    totalMonthlyPremium,
    conversionRate,
    pipeline: {
      prospect: leads.filter((l) => l.status === "Prospect").length,
      contacted: leads.filter((l) => l.status === "Contacted").length,
      quoted: leads.filter((l) => l.status === "Quoted").length,
      won,
      lost: leads.filter((l) => l.status === "Lost").length,
    },
    unassignedLeads: leads.filter((l) => !l.assigned_to_user_id).length,
  };
}

// Personal, agent-scoped equivalent of getDashboardStats — only counts
// this user's own assigned leads / sold policies / created clients, so an
// agent's dashboard never reveals company-wide volumes they don't hold
// the View Executive Dashboard permission to see.
export async function getMyDashboardStats(
  userId: string,
  segment?: ClientSegment
): Promise<SalesDashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let leadsQuery = supabase
    .from("leads")
    .select("id, status, assigned_to_user_id, created_at, segment")
    .eq("assigned_to_user_id", userId);
  let policiesQuery = supabase
    .from("policies")
    .select("id, status, premium, client_segment")
    .eq("sold_by_user_id", userId);
  let clientsQuery = supabase.from("clients").select("id, segment").eq("created_by_user_id", userId);

  if (segment) {
    leadsQuery = leadsQuery.eq("segment", segment);
    policiesQuery = policiesQuery.eq("client_segment", segment);
    clientsQuery = clientsQuery.eq("segment", segment);
  }

  const [leadsRes, policiesRes, clientsRes] = await Promise.all([leadsQuery, policiesQuery, clientsQuery]);
  if (leadsRes.error) throw leadsRes.error;
  if (policiesRes.error) throw policiesRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const leads = leadsRes.data || [];
  const policies = policiesRes.data || [];
  const clients = clientsRes.data || [];

  const leadsThisMonth = leads.filter((l) => l.created_at && l.created_at >= startOfMonth).length;
  const activePolicies = policies.filter((p) => p.status === "Active");
  const totalMonthlyPremium = activePolicies.reduce((sum, p) => sum + (Number(p.premium) || 0), 0);
  const won = leads.filter((l) => l.status === "Won").length;
  const conversionRate = leads.length > 0 ? Math.round((won / leads.length) * 1000) / 10 : 0;

  return {
    totalLeads: leads.length,
    leadsThisMonth,
    totalClients: clients.length,
    activePolicies: activePolicies.length,
    totalMonthlyPremium,
    conversionRate,
    pipeline: {
      prospect: leads.filter((l) => l.status === "Prospect").length,
      contacted: leads.filter((l) => l.status === "Contacted").length,
      quoted: leads.filter((l) => l.status === "Quoted").length,
      won,
      lost: leads.filter((l) => l.status === "Lost").length,
    },
    unassignedLeads: 0,
  };
}

// ============================================================
// POLICY ADMIN OVERVIEW — for roles without lead access (e.g.
// Policy Admin) whose job is clients/policies/retentions, not leads
// ============================================================

export interface PolicyAdminOverview {
  totalClients: number;
  activePolicies: number;
  totalMonthlyPremium: number;
  pendingDocs: number;
  retentionsCount: number;
  policyStatus: { active: number; pending: number; canceled: number; expired: number; retained: number };
  recentClients: { id: string; name: string; segment: string | null; join_date: string | null }[];
}

export async function getPolicyAdminOverview(segment?: ClientSegment): Promise<PolicyAdminOverview> {
  let clientsQuery = supabase.from("clients").select("id, name, segment, join_date").order("join_date", { ascending: false });
  let policiesQuery = supabase.from("policies").select("id, status, premium, client_segment, documentation_status");

  if (segment) {
    clientsQuery = clientsQuery.eq("segment", segment);
    policiesQuery = policiesQuery.eq("client_segment", segment);
  }

  const [clientsRes, policiesRes] = await Promise.all([clientsQuery, policiesQuery]);
  if (clientsRes.error) throw clientsRes.error;
  if (policiesRes.error) throw policiesRes.error;

  const clients = clientsRes.data ?? [];
  const policies = policiesRes.data ?? [];
  const activePolicies = policies.filter((p) => p.status === "Active");

  return {
    totalClients: clients.length,
    activePolicies: activePolicies.length,
    totalMonthlyPremium: activePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0),
    pendingDocs: activePolicies.filter((p) => p.documentation_status !== "Complete").length,
    retentionsCount: policies.filter((p) => p.status === "Canceled" || p.status === "Expired").length,
    policyStatus: {
      active: activePolicies.length,
      pending: policies.filter((p) => p.status === "Pending").length,
      canceled: policies.filter((p) => p.status === "Canceled").length,
      expired: policies.filter((p) => p.status === "Expired").length,
      retained: policies.filter((p) => p.status === "Retained").length,
    },
    recentClients: clients.slice(0, 6).map((c) => ({ id: c.id, name: c.name, segment: c.segment, join_date: c.join_date })),
  };
}

// ============================================================
// EXECUTIVE OVERVIEW — cross-business-unit dashboard, gated
// behind the View Executive Dashboard permission
// ============================================================

export interface ExecutiveUnitStats {
  leads: number;
  clients?: number;
  activePolicies?: number;
  monthlyPremium?: number;
  active?: number;
  closed?: number;
  unassigned: number;
  growthPct: number;
}

export interface ExecutiveOverview {
  totals: {
    totalLeads: number;
    leadsThisMonth: number;
    totalClients: number;
    activePolicies: number;
    totalMonthlyPremium: number;
    conversionRate: number;
    unassignedLeads: number;
  };
  pipeline: { prospect: number; contacted: number; quoted: number; won: number; lost: number };
  units: {
    personal: ExecutiveUnitStats;
    commercial: ExecutiveUnitStats;
    concierge: ExecutiveUnitStats;
    creditHealth: ExecutiveUnitStats;
  };
  monthlyTrend: { month: string; leads: number; converted: number }[];
  recentLeads: {
    id: string; name: string; unit: string; source: string | null;
    status: string; created_at: string;
  }[];
  alerts: { id: string; label: string; detail: string; tone: "warning" | "danger" }[];
  topPerformers: { userId: string; name: string; role: string; closed: number }[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [leadsRes, clientsRes, policiesRes, usersRes] = await Promise.all([
    supabase.from("leads").select(
      "id, name, status, segment, source, business_unit_id, assigned_to_user_id, created_at, closed_at, unit_status"
    ),
    supabase.from("clients").select("id, segment"),
    supabase.from("policies").select("id, status, premium, client_segment, documentation_status"),
    supabase.from("users").select("id, name, role"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (clientsRes.error) throw clientsRes.error;
  if (policiesRes.error) throw policiesRes.error;
  if (usersRes.error) throw usersRes.error;

  const allLeads = leadsRes.data ?? [];
  const allClients = clientsRes.data ?? [];
  const allPolicies = policiesRes.data ?? [];
  const users = usersRes.data ?? [];

  const isSales = (bu: string | null) => !bu || bu === SALES_UNIT_ID;
  const salesLeads = allLeads.filter((l) => isSales(l.business_unit_id));
  const conciergeLeads = allLeads.filter((l) => l.business_unit_id === CONCIERGE_UNIT_ID);
  const creditHealthLeads = allLeads.filter((l) => l.business_unit_id === CREDIT_HEALTH_UNIT_ID);

  const leadsThisMonth = salesLeads.filter((l) => l.created_at >= startOfMonth).length;
  const activePolicies = allPolicies.filter((p) => p.status === "Active");
  const totalMonthlyPremium = activePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0);
  const won = salesLeads.filter((l) => l.status === "Won").length;
  const conversionRate = salesLeads.length > 0 ? Math.round((won / salesLeads.length) * 1000) / 10 : 0;
  const unassignedLeads = salesLeads.filter((l) => !l.assigned_to_user_id).length;

  function growth(list: { created_at: string }[]): number {
    const thisM = list.filter((l) => l.created_at >= startOfMonth).length;
    const lastM = list.filter((l) => l.created_at >= startOfLastMonth && l.created_at < startOfMonth).length;
    if (lastM === 0) return thisM > 0 ? 100 : 0;
    return Math.round(((thisM - lastM) / lastM) * 1000) / 10;
  }

  const personalLeads = salesLeads.filter((l) => l.segment === "Individual");
  const commercialLeads = salesLeads.filter((l) => l.segment === "Commercial");
  const personalActivePolicies = activePolicies.filter((p) => p.client_segment === "Individual");
  const commercialActivePolicies = activePolicies.filter((p) => p.client_segment === "Commercial");

  const units: ExecutiveOverview["units"] = {
    personal: {
      leads: personalLeads.length,
      clients: allClients.filter((c) => c.segment === "Individual").length,
      activePolicies: personalActivePolicies.length,
      monthlyPremium: personalActivePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0),
      unassigned: personalLeads.filter((l) => !l.assigned_to_user_id).length,
      growthPct: growth(personalLeads),
    },
    commercial: {
      leads: commercialLeads.length,
      clients: allClients.filter((c) => c.segment === "Commercial").length,
      activePolicies: commercialActivePolicies.length,
      monthlyPremium: commercialActivePolicies.reduce((s, p) => s + (Number(p.premium) || 0), 0),
      unassigned: commercialLeads.filter((l) => !l.assigned_to_user_id).length,
      growthPct: growth(commercialLeads),
    },
    concierge: {
      leads: conciergeLeads.length,
      active: conciergeLeads.filter((l) => ["Contacted", "Sourcing", "Quote Sent"].includes(l.unit_status ?? "")).length,
      closed: conciergeLeads.filter((l) => l.unit_status === "Won").length,
      unassigned: conciergeLeads.filter((l) => !l.assigned_to_user_id).length,
      growthPct: growth(conciergeLeads),
    },
    creditHealth: {
      leads: creditHealthLeads.length,
      active: creditHealthLeads.filter((l) => ["Contacted", "Assessment", "Submitted"].includes(l.unit_status ?? "")).length,
      closed: creditHealthLeads.filter((l) => l.unit_status === "Approved").length,
      unassigned: creditHealthLeads.filter((l) => !l.assigned_to_user_id).length,
      growthPct: growth(creditHealthLeads),
    },
  };

  // Last 6 months, all units combined
  const monthlyTrend: ExecutiveOverview["monthlyTrend"] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = allLeads.filter((l) => l.created_at >= start.toISOString() && l.created_at < end.toISOString());
    const convertedInMonth = allLeads.filter(
      (l) => l.closed_at && l.closed_at >= start.toISOString() && l.closed_at < end.toISOString() &&
        (l.status === "Won" || l.unit_status === "Won" || l.unit_status === "Approved")
    );
    monthlyTrend.push({ month: MONTH_LABELS[start.getMonth()], leads: inMonth.length, converted: convertedInMonth.length });
  }

  const unitLabel = (bu: string | null, segment: string | null) => {
    if (bu === CONCIERGE_UNIT_ID) return "Concierge";
    if (bu === CREDIT_HEALTH_UNIT_ID) return "Credit Health";
    return segment === "Commercial" ? "Commercial Insurance" : "Personal Insurance";
  };

  const recentLeads = [...allLeads]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 6)
    .map((l) => ({
      id: l.id,
      name: l.name,
      unit: unitLabel(l.business_unit_id, l.segment),
      source: l.source,
      status: l.unit_status ?? l.status ?? "—",
      created_at: l.created_at,
    }));

  const alerts: ExecutiveOverview["alerts"] = [];
  if (unassignedLeads > 0) {
    alerts.push({ id: "unassigned-sales", label: `${unassignedLeads} unassigned sales lead${unassignedLeads !== 1 ? "s" : ""}`, detail: "Personal + Commercial Insurance", tone: "warning" });
  }
  if (units.concierge.unassigned > 0) {
    alerts.push({ id: "unassigned-concierge", label: `${units.concierge.unassigned} unassigned Concierge lead${units.concierge.unassigned !== 1 ? "s" : ""}`, detail: "Vehicle sourcing", tone: "warning" });
  }
  if (units.creditHealth.unassigned > 0) {
    alerts.push({ id: "unassigned-credit", label: `${units.creditHealth.unassigned} unassigned Credit Health lead${units.creditHealth.unassigned !== 1 ? "s" : ""}`, detail: "Debt review & advisory", tone: "warning" });
  }
  const pendingDocs = activePolicies.filter((p) => p.documentation_status !== "Complete").length;
  if (pendingDocs > 0) {
    alerts.push({ id: "pending-docs", label: `${pendingDocs} active polic${pendingDocs !== 1 ? "ies" : "y"} missing documentation`, detail: "Documentation status incomplete", tone: "danger" });
  }

  const closedThisMonth = allLeads.filter(
    (l) => l.closed_at && l.closed_at >= startOfMonth &&
      (l.status === "Won" || l.unit_status === "Won" || l.unit_status === "Approved")
  );
  const closedByUser = new Map<string, number>();
  closedThisMonth.forEach((l) => {
    if (!l.assigned_to_user_id) return;
    closedByUser.set(l.assigned_to_user_id, (closedByUser.get(l.assigned_to_user_id) ?? 0) + 1);
  });
  const topPerformers = Array.from(closedByUser.entries())
    .map(([userId, closed]) => {
      const u = users.find((usr) => usr.id === userId);
      return { userId, name: u?.name ?? "Unknown", role: u?.role ?? "—", closed };
    })
    .sort((a, b) => b.closed - a.closed)
    .slice(0, 5);

  return {
    totals: {
      totalLeads: salesLeads.length,
      leadsThisMonth,
      totalClients: allClients.length,
      activePolicies: activePolicies.length,
      totalMonthlyPremium,
      conversionRate,
      unassignedLeads,
    },
    pipeline: {
      prospect: salesLeads.filter((l) => l.status === "Prospect").length,
      contacted: salesLeads.filter((l) => l.status === "Contacted").length,
      quoted: salesLeads.filter((l) => l.status === "Quoted").length,
      won,
      lost: salesLeads.filter((l) => l.status === "Lost").length,
    },
    units,
    monthlyTrend,
    recentLeads,
    alerts,
    topPerformers,
  };
}

// ============================================================
// ANALYTICS
// ============================================================

export async function getLeadsBySource(
  segment?: ClientSegment
): Promise<{ source: string; count: number }[]> {
  let query = supabase.from("leads").select("source");
  if (segment) query = query.eq("segment", segment);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  (data || []).forEach((l) => {
    const src = l.source || "Other";
    counts[src] = (counts[src] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getPoliciesByInsurer(
  segment?: ClientSegment
): Promise<{ insurer: string; count: number; premium: number }[]> {
  let query = supabase.from("policies").select("insurer, premium, status");
  if (segment) query = query.eq("client_segment", segment);

  const { data, error } = await query;
  if (error) throw error;

  const map: Record<string, { count: number; premium: number }> = {};
  (data || []).forEach((p) => {
    const ins = p.insurer || "Unknown";
    if (!map[ins]) map[ins] = { count: 0, premium: 0 };
    map[ins].count += 1;
    if (p.status === "Active") map[ins].premium += Number(p.premium) || 0;
  });

  return Object.entries(map)
    .map(([insurer, v]) => ({ insurer, ...v }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================
// USERS — for assignment dropdowns
// ============================================================

export async function getSalesUsers(): Promise<SalesUser[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("status", "Active")
    .order("name");
  if (error) throw error;
  return data || [];
}

export interface NewClientData {
  name: string;
  email: string;
  phone?: string;
  id_number?: string;
  address?: string;
  segment: ClientSegment;
  title?: string;
  occupation?: string;
  created_by_user_id?: string;
}

// Adds a client directly, bypassing the lead pipeline — for Policy Admins
// and others who capture a walk-in / existing client without ever having
// worked them as a lead.
export async function createClient(client: NewClientData): Promise<SalesClient> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...client, join_date: new Date().toISOString().split("T")[0] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePolicy(id: string): Promise<void> {
  const { error } = await supabase.from("policies").delete().eq("id", id);
  if (error) throw error;
}
