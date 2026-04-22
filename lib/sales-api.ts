import { supabase } from "./supabase";
import type { ClientSegment } from "@/types";

// ============================================================
// SHARED TYPES
// ============================================================

export interface SalesUser {
  id: string;
  name: string;
  role: string;
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
    .select("id, status, assigned_to_user_id, created_at, segment");
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

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePolicy(id: string): Promise<void> {
  const { error } = await supabase.from("policies").delete().eq("id", id);
  if (error) throw error;
}
