import { supabase } from "./supabase";

export const CREDIT_HEALTH_UNIT_ID = "62a86026-af4f-47c2-8498-d1c3bb0a1ad3";

export const CREDIT_HEALTH_STATUSES = [
  "New", "Contacted", "Assessment", "Submitted", "Approved", "Declined", "On Hold",
];

export interface CreditHealthLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  unit_status?: string;
  unit_notes?: string;
  credit_score?: string;
  employment_status?: string;
  monthly_income?: number;
  loan_amount?: number;
  assigned_to_user_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
}

export interface CreditHealthFilters {
  status?: string;
  assigned?: "mine" | "unassigned" | "all";
  search?: string;
  userId?: string;
}

export async function getCreditHealthLeads(
  filters?: CreditHealthFilters
): Promise<CreditHealthLead[]> {
  let query = supabase
    .from("leads")
    .select("*")
    .eq("business_unit_id", CREDIT_HEALTH_UNIT_ID)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("unit_status", filters.status);
  if (filters?.assigned === "mine" && filters.userId)
    query = query.eq("assigned_to_user_id", filters.userId);
  if (filters?.assigned === "unassigned")
    query = query.is("assigned_to_user_id", null);
  if (filters?.search) {
    const q = filters.search;
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as CreditHealthLead[]) ?? [];
}

export async function getCreditHealthLead(id: string): Promise<CreditHealthLead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CreditHealthLead;
}

export async function createCreditHealthLead(
  lead: Omit<CreditHealthLead, "id" | "created_at" | "updated_at">
): Promise<CreditHealthLead> {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...lead,
      business_unit_id: CREDIT_HEALTH_UNIT_ID,
      unit_status: lead.unit_status ?? "New",
      source_type: "manual_entry",
      source: lead.source ?? "Manual",
      status: "Prospect",
    })
    .select()
    .single();
  if (error) throw error;
  return data as CreditHealthLead;
}

export async function updateCreditHealthLead(
  id: string,
  updates: Partial<CreditHealthLead>
): Promise<CreditHealthLead> {
  const { data, error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CreditHealthLead;
}

export async function getCreditHealthStats() {
  const { data } = await supabase
    .from("leads")
    .select("id, unit_status, assigned_to_user_id, created_at")
    .eq("business_unit_id", CREDIT_HEALTH_UNIT_ID);

  const leads = data ?? [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    total: leads.length,
    new: leads.filter((l) => l.unit_status === "New").length,
    active: leads.filter((l) => ["Contacted", "Assessment", "Submitted"].includes(l.unit_status ?? "")).length,
    approved: leads.filter((l) => l.unit_status === "Approved").length,
    unassigned: leads.filter((l) => !l.assigned_to_user_id).length,
    thisMonth: leads.filter((l) => l.created_at >= startOfMonth).length,
  };
}
