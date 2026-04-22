import { supabase } from "./supabase";

export const CONCIERGE_UNIT_ID = "07cb16ec-34bb-4731-a5b2-94cf33ce85a5";

export const CONCIERGE_STATUSES = [
  "New", "Contacted", "Sourcing", "Quote Sent", "Won", "Lost", "On Hold",
];

export interface ConciergeLeadFilters {
  status?: string;
  assigned?: "mine" | "unassigned" | "all";
  search?: string;
  userId?: string;
}

export interface ConciergeLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  unit_status?: string;
  unit_notes?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_price?: number;
  assigned_to_user_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
}

export async function getConciergeLeads(
  filters?: ConciergeLeadFilters
): Promise<ConciergeLead[]> {
  let query = supabase
    .from("leads")
    .select("*")
    .eq("business_unit_id", CONCIERGE_UNIT_ID)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("unit_status", filters.status);
  if (filters?.assigned === "mine" && filters.userId)
    query = query.eq("assigned_to_user_id", filters.userId);
  if (filters?.assigned === "unassigned")
    query = query.is("assigned_to_user_id", null);
  if (filters?.search) {
    const q = filters.search;
    query = query.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,vehicle_make.ilike.%${q}%,vehicle_model.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ConciergeLead[]) ?? [];
}

export async function getConciergeLead(id: string): Promise<ConciergeLead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ConciergeLead;
}

export async function createConciergeLead(
  lead: Omit<ConciergeLead, "id" | "created_at" | "updated_at">
): Promise<ConciergeLead> {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...lead,
      business_unit_id: CONCIERGE_UNIT_ID,
      unit_status: lead.unit_status ?? "New",
      source_type: "manual_entry",
      source: lead.source ?? "Manual",
      status: "Prospect",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConciergeLead;
}

export async function updateConciergeLead(
  id: string,
  updates: Partial<ConciergeLead>
): Promise<ConciergeLead> {
  const { data, error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ConciergeLead;
}

export async function getConciergeStats() {
  const { data } = await supabase
    .from("leads")
    .select("id, unit_status, assigned_to_user_id, created_at")
    .eq("business_unit_id", CONCIERGE_UNIT_ID);

  const leads = data ?? [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    total: leads.length,
    new: leads.filter((l) => l.unit_status === "New").length,
    active: leads.filter((l) =>
      ["Contacted", "Sourcing", "Quote Sent"].includes(l.unit_status ?? "")
    ).length,
    won: leads.filter((l) => l.unit_status === "Won").length,
    unassigned: leads.filter((l) => !l.assigned_to_user_id).length,
    thisMonth: leads.filter((l) => l.created_at >= startOfMonth).length,
  };
}
