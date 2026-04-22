/**
 * settings-api.ts
 *
 * Previously read underwriters and product catalog from the system_settings
 * JSON blob. Now reads from proper DB tables: underwriters, product_categories,
 * products. This keeps QuoteModal, AddPolicyModal, LeadDetail etc. in sync
 * with whatever is managed in Sales → Settings.
 */

import { supabase } from "./supabase";

export interface SystemSettings {
  underwriters: string[];
  productCatalog: Record<string, string[]>;
  enableIndividualSegment: boolean;
  enableCommercialSegment: boolean;
}

let cachedSettings: SystemSettings | null = null;

export async function getSystemSettings(): Promise<SystemSettings> {
  if (cachedSettings) return cachedSettings;

  const [uwRes, catRes, prodRes] = await Promise.all([
    supabase.from("underwriters").select("name").eq("active", true).order("name"),
    supabase.from("product_categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
    supabase.from("products").select("name, category_id").eq("active", true).order("sort_order"),
  ]);

  const underwriters = (uwRes.data ?? []).map((u: { name: string }) => u.name);

  const categories = catRes.data ?? [];
  const products = prodRes.data ?? [];

  const productCatalog: Record<string, string[]> = {};
  categories.forEach((cat: { id: string; name: string }) => {
    productCatalog[cat.name] = products
      .filter((p: { category_id: string }) => p.category_id === cat.id)
      .map((p: { name: string }) => p.name);
  });

  // Fallback if tables are empty for some reason
  if (underwriters.length === 0) {
    underwriters.push(
      "1Life","1st For Women","AIG South Africa","Absa","Auto & General",
      "Brightrock","Bryte","Budget","Centriq","Hollard","King Price",
      "Metropolitan Life","MiWay","New National","Old Mutual Insure",
      "Profusion","Quicksure","SAU","Santam","Yard Insurance"
    );
  }

  if (Object.keys(productCatalog).length === 0) {
    Object.assign(productCatalog, {
      "Mobility": ["Motor Fleet","Group Staff Scheme","Motor Traders Internal & External","Aviation","Marine Cargo & Hull","Goods in Transit","VAPS"],
      "Commercial": ["Assets All Risks","Fire & Allied Perils","Buildings Combined","Money","Theft","Glass","Business Interruption","Accounts Receivable","Fidelity Guarantee","Group Personal Accident","Electronic Equipment"],
      "Life & Credit Life": ["Funeral Cover","Credit Life (Death, TPD, Retrenchment)","Accidental Cover (Death & Disability)","Critical Illness"],
      "Liabilities & Guarantees": ["Directors & Officers","Broad Form Liability","Public & Product Liability","Environmental Liability","Professional Indemnity","Medical Malpractice","Mining Guarantees","Performance & Contract Guarantees"],
    });
  }

  cachedSettings = {
    underwriters,
    productCatalog,
    enableIndividualSegment: true,
    enableCommercialSegment: true,
  };

  return cachedSettings;
}

export function clearSettingsCache() {
  cachedSettings = null;
}
