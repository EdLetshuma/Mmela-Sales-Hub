import { supabase } from "./supabase";

// ── Types ─────────────────────────────────────────────────────

export interface Underwriter {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  active: boolean;
  sort_order: number;
}

export interface ReportMailing {
  id: string;
  name: string;
  report_type: string;
  unit: string;
  recipients: string[];
  frequency: "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  send_hour: number;
  active: boolean;
  last_sent_at?: string;
  created_by?: string;
  created_at?: string;
}

// ── Cache ─────────────────────────────────────────────────────

let uwCache: Underwriter[] | null = null;
let prodCache: { categories: ProductCategory[]; products: Product[] } | null = null;

export function clearCatalogCache() { uwCache = null; prodCache = null; }

// ── Underwriters ──────────────────────────────────────────────

export async function getUnderwriters(activeOnly = true): Promise<Underwriter[]> {
  if (uwCache) return activeOnly ? uwCache.filter(u => u.active) : uwCache;
  const { data, error } = await supabase
    .from("underwriters").select("*").order("name");
  if (error) throw error;
  uwCache = (data as Underwriter[]) ?? [];
  return activeOnly ? uwCache.filter(u => u.active) : uwCache;
}

export async function createUnderwriter(name: string): Promise<Underwriter> {
  const { data, error } = await supabase
    .from("underwriters").insert({ name }).select().single();
  if (error) throw error;
  clearCatalogCache();
  return data as Underwriter;
}

export async function updateUnderwriter(id: string, updates: Partial<Underwriter>): Promise<void> {
  const { error } = await supabase.from("underwriters").update(updates).eq("id", id);
  if (error) throw error;
  clearCatalogCache();
}

export async function deleteUnderwriter(id: string): Promise<void> {
  const { error } = await supabase.from("underwriters").update({ active: false }).eq("id", id);
  if (error) throw error;
  clearCatalogCache();
}

// ── Product catalog ───────────────────────────────────────────

export async function getProductCatalog(): Promise<{ categories: ProductCategory[]; products: Product[] }> {
  if (prodCache) return prodCache;
  const [catRes, prodRes] = await Promise.all([
    supabase.from("product_categories").select("*").eq("active", true).order("sort_order"),
    supabase.from("products")
      .select("*, product_categories(name)")
      .eq("active", true)
      .order("sort_order"),
  ]);
  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;

  const products = (prodRes.data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    category_name: (p.product_categories as { name: string } | null)?.name,
  })) as Product[];

  prodCache = { categories: catRes.data as ProductCategory[], products };
  return prodCache;
}

export async function getProductCatalogMap(): Promise<Record<string, string[]>> {
  const { categories, products } = await getProductCatalog();
  const map: Record<string, string[]> = {};
  categories.forEach(c => { map[c.name] = []; });
  products.forEach(p => {
    const cat = categories.find(c => c.id === p.category_id);
    if (cat) map[cat.name] = [...(map[cat.name] ?? []), p.name];
  });
  return map;
}

export async function createProduct(name: string, categoryId: string): Promise<Product> {
  const { data, error } = await supabase
    .from("products").insert({ name, category_id: categoryId }).select().single();
  if (error) throw error;
  clearCatalogCache();
  return data as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase.from("products").update(updates).eq("id", id);
  if (error) throw error;
  clearCatalogCache();
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").update({ active: false }).eq("id", id);
  if (error) throw error;
  clearCatalogCache();
}

export async function createProductCategory(name: string): Promise<ProductCategory> {
  const { data, error } = await supabase
    .from("product_categories").insert({ name }).select().single();
  if (error) throw error;
  clearCatalogCache();
  return data as ProductCategory;
}

// ── Report mailings ───────────────────────────────────────────

export async function getReportMailings(): Promise<ReportMailing[]> {
  const { data, error } = await supabase
    .from("report_mailings").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ReportMailing[]) ?? [];
}

export async function createReportMailing(mailing: Omit<ReportMailing, "id" | "created_at" | "last_sent_at">): Promise<ReportMailing> {
  const { data, error } = await supabase
    .from("report_mailings").insert(mailing).select().single();
  if (error) throw error;
  return data as ReportMailing;
}

export async function updateReportMailing(id: string, updates: Partial<ReportMailing>): Promise<void> {
  const { error } = await supabase
    .from("report_mailings").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteReportMailing(id: string): Promise<void> {
  const { error } = await supabase.from("report_mailings").delete().eq("id", id);
  if (error) throw error;
}

// ── Report types catalogue (used in UI dropdowns) ────────────

export const REPORT_TYPES = [
  { value: "agent_summary",       label: "Agent summary",          unit: "sales" },
  { value: "policy_register",     label: "Policy register",        unit: "sales" },
  { value: "retention_summary",   label: "Retention summary",      unit: "sales" },
  { value: "lead_pipeline",       label: "Lead pipeline",          unit: "sales" },
  { value: "conversion_by_source",label: "Conversion by source",   unit: "sales" },
  { value: "premium_by_insurer",  label: "Premium by insurer",     unit: "sales" },
  { value: "concierge_pipeline",  label: "Concierge pipeline",     unit: "concierge" },
  { value: "credit_health_pipeline", label: "Credit Health pipeline", unit: "credit-health" },
  { value: "business_unit_comparison", label: "Business unit comparison", unit: "all" },
] as const;

export type ReportTypeValue = typeof REPORT_TYPES[number]["value"];
