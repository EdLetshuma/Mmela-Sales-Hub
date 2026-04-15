import { supabase } from "./supabase";
import type {
  Campaign,
  Form,
  FormField,
  Lead,
  BusinessUnit,
  RoutingRule,
} from "@/types";

// ============================================================
// BUSINESS UNITS
// ============================================================

export async function getBusinessUnits(): Promise<BusinessUnit[]> {
  const { data, error } = await supabase
    .from("business_units")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}

// ============================================================
// CAMPAIGNS
// ============================================================

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, business_units(name, slug)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, business_units(name, slug)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCampaign(
  campaign: Omit<Campaign, "id" | "created_at" | "updated_at">
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCampaign(
  id: string,
  updates: Partial<Campaign>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// FORMS
// ============================================================

export async function getForms(campaignId?: string): Promise<Form[]> {
  let query = supabase
    .from("forms")
    .select("*, campaigns(name, business_unit_id)")
    .order("created_at", { ascending: false });

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getForm(id: string): Promise<Form | null> {
  const { data, error } = await supabase
    .from("forms")
    .select("*, campaigns(name, business_unit_id)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  const { data, error } = await supabase
    .from("forms")
    .select("*, campaigns(name, business_unit_id, business_units(name))")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data;
}

export async function createForm(
  form: Omit<Form, "id" | "created_at" | "updated_at">
): Promise<Form> {
  const { data, error } = await supabase
    .from("forms")
    .insert(form)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateForm(
  id: string,
  updates: Partial<Form>
): Promise<Form> {
  const { data, error } = await supabase
    .from("forms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// FORM FIELDS
// ============================================================

export async function getFormFields(formId: string): Promise<FormField[]> {
  const { data, error } = await supabase
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("display_order");

  if (error) throw error;
  return data || [];
}

export async function upsertFormFields(
  formId: string,
  fields: Omit<FormField, "id" | "created_at">[]
): Promise<FormField[]> {
  // Delete existing fields and re-insert (simplest approach for reordering)
  await supabase.from("form_fields").delete().eq("form_id", formId);

  if (fields.length === 0) return [];

  const { data, error } = await supabase
    .from("form_fields")
    .insert(fields.map((f) => ({ ...f, form_id: formId })))
    .select();

  if (error) throw error;
  return data || [];
}

// ============================================================
// LEADS (Campaign-scoped)
// ============================================================

export async function getCampaignLeads(filters?: {
  campaign_id?: string;
  business_unit_id?: string;
  source_type?: string;
  status?: string;
  assigned?: "assigned" | "unassigned";
}): Promise<Lead[]> {
  let query = supabase
    .from("leads")
    .select("*")
    .neq("source_type", "legacy")
    .order("created_at", { ascending: false });

  if (filters?.campaign_id) query = query.eq("campaign_id", filters.campaign_id);
  if (filters?.business_unit_id) query = query.eq("business_unit_id", filters.business_unit_id);
  if (filters?.source_type) query = query.eq("source_type", filters.source_type);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assigned === "unassigned") query = query.is("assigned_to_user_id", null);
  if (filters?.assigned === "assigned") query = query.not("assigned_to_user_id", "is", null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function submitPublicLead(leadData: {
  name: string;
  email: string;
  phone?: string;
  form_id: string;
  campaign_id: string;
  business_unit_id: string;
  source_type: string;
  captured_data: Record<string, unknown>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...leadData,
      status: "Prospect",
      source: "Campaign",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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

export async function bulkAssignLeads(
  leadIds: string[],
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({
      assigned_to_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .in("id", leadIds);

  if (error) throw error;
}

// ============================================================
// ROUTING RULES
// ============================================================

export async function getRoutingRules(): Promise<RoutingRule[]> {
  const { data, error } = await supabase
    .from("routing_rules")
    .select("*, business_units(name), campaigns(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createRoutingRule(
  rule: Omit<RoutingRule, "id">
): Promise<RoutingRule> {
  const { data, error } = await supabase
    .from("routing_rules")
    .insert(rule)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRoutingRule(
  id: string,
  updates: Partial<RoutingRule>
): Promise<RoutingRule> {
  const { data, error } = await supabase
    .from("routing_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// USERS (for assignment dropdowns)
// ============================================================

export async function getActiveUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("status", "Active")
    .order("name");

  if (error) throw error;
  return data || [];
}

// ============================================================
// STATS
// ============================================================

export async function getCampaignStats() {
  const [campaigns, leads, forms] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, is_active")
      .eq("is_active", true),
    supabase
      .from("leads")
      .select("id, source_type, campaign_id, business_unit_id, assigned_to_user_id, status, created_at")
      .neq("source_type", "legacy"),
    supabase
      .from("forms")
      .select("id, is_active")
      .eq("is_active", true),
  ]);

  const allLeads = leads.data || [];
  const now = new Date();
  const thisMonth = allLeads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return {
    activeCampaigns: campaigns.data?.length || 0,
    activeForms: forms.data?.length || 0,
    totalLeads: allLeads.length,
    leadsThisMonth: thisMonth.length,
    unassignedLeads: allLeads.filter((l) => !l.assigned_to_user_id).length,
  };
}
