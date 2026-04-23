"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { downloadReport } from "@/lib/excel-reports";
import { getUserReportConfigs, saveReportConfig, deleteReportConfig, type ReportConfig } from "@/lib/user-api";
import { Download, Save, Trash2, ChevronRight, X, Filter, Columns, Eye } from "lucide-react";

// ── Data source definitions ───────────────────────────────────

const DATA_SOURCES = [
  { value: "leads",       label: "Leads",            unit: "Sales" },
  { value: "policies",    label: "Policies",         unit: "Sales" },
  { value: "clients",     label: "Clients",          unit: "Sales" },
  { value: "retentions",  label: "Retentions",       unit: "Sales" },
  { value: "concierge",   label: "Concierge leads",  unit: "Concierge" },
  { value: "credit_health", label: "Credit Health leads", unit: "Credit Health" },
  { value: "all_leads",   label: "All leads (cross-unit)", unit: "All units" },
] as const;

type DataSourceValue = typeof DATA_SOURCES[number]["value"];

// Column definitions per source
const COLUMNS: Record<DataSourceValue, { key: string; label: string; type: "text"|"date"|"currency"|"number"|"pct" }[]> = {
  leads: [
    { key: "name",                label: "Name",            type: "text" },
    { key: "email",               label: "Email",           type: "text" },
    { key: "phone",               label: "Phone",           type: "text" },
    { key: "status",              label: "Status",          type: "text" },
    { key: "source",              label: "Source",          type: "text" },
    { key: "segment",             label: "Segment",         type: "text" },
    { key: "assigned_to",         label: "Assigned to",     type: "text" },
    { key: "created_at",          label: "Date added",      type: "date" },
    { key: "loss_reason",         label: "Loss reason",     type: "text" },
    { key: "referred_by",         label: "Referred by",     type: "text" },
    { key: "campaign",            label: "Campaign",        type: "text" },
  ],
  policies: [
    { key: "policy_number",       label: "Policy number",   type: "text" },
    { key: "client_name",         label: "Client",          type: "text" },
    { key: "product_category",    label: "Category",        type: "text" },
    { key: "product_name",        label: "Product",         type: "text" },
    { key: "insurer",             label: "Insurer",         type: "text" },
    { key: "premium",             label: "Premium",         type: "currency" },
    { key: "base_premium",        label: "Base premium",    type: "currency" },
    { key: "inception_date",      label: "Inception date",  type: "date" },
    { key: "sale_date",           label: "Sale date",       type: "date" },
    { key: "status",              label: "Status",          type: "text" },
    { key: "documentation_status",label: "Docs status",     type: "text" },
    { key: "client_segment",      label: "Segment",         type: "text" },
    { key: "sold_by",             label: "Sold by",         type: "text" },
  ],
  clients: [
    { key: "name",                label: "Name",            type: "text" },
    { key: "email",               label: "Email",           type: "text" },
    { key: "phone",               label: "Phone",           type: "text" },
    { key: "id_number",           label: "ID number",       type: "text" },
    { key: "segment",             label: "Segment",         type: "text" },
    { key: "created_at",          label: "Date added",      type: "date" },
  ],
  retentions: [
    { key: "policy_number",       label: "Policy number",   type: "text" },
    { key: "client_name",         label: "Client",          type: "text" },
    { key: "product_name",        label: "Product",         type: "text" },
    { key: "insurer",             label: "Insurer",         type: "text" },
    { key: "premium",             label: "Premium",         type: "currency" },
    { key: "status",              label: "Status",          type: "text" },
    { key: "retention_date",      label: "Retained on",     type: "date" },
    { key: "previous_policy",     label: "Previous policy", type: "text" },
    { key: "previous_premium",    label: "Previous premium",type: "currency" },
  ],
  concierge: [
    { key: "name",                label: "Name",            type: "text" },
    { key: "phone",               label: "Phone",           type: "text" },
    { key: "source",              label: "Source",          type: "text" },
    { key: "unit_status",         label: "Status",          type: "text" },
    { key: "vehicle",             label: "Vehicle",         type: "text" },
    { key: "vehicle_price",       label: "Budget",          type: "currency" },
    { key: "assigned_to",         label: "Assigned to",     type: "text" },
    { key: "created_at",          label: "Date added",      type: "date" },
  ],
  credit_health: [
    { key: "name",                label: "Name",            type: "text" },
    { key: "phone",               label: "Phone",           type: "text" },
    { key: "source",              label: "Source",          type: "text" },
    { key: "unit_status",         label: "Status",          type: "text" },
    { key: "employment_status",   label: "Employment",      type: "text" },
    { key: "monthly_income",      label: "Monthly income",  type: "currency" },
    { key: "loan_amount",         label: "Loan amount",     type: "currency" },
    { key: "credit_score",        label: "Credit score",    type: "text" },
    { key: "assigned_to",         label: "Assigned to",     type: "text" },
    { key: "created_at",          label: "Date added",      type: "date" },
  ],
  all_leads: [
    { key: "name",                label: "Name",            type: "text" },
    { key: "phone",               label: "Phone",           type: "text" },
    { key: "status",              label: "Status",          type: "text" },
    { key: "source",              label: "Source",          type: "text" },
    { key: "unit",                label: "Business unit",   type: "text" },
    { key: "assigned_to",         label: "Assigned to",     type: "text" },
    { key: "created_at",          label: "Date added",      type: "date" },
  ],
};

// Filter definitions per source
const FILTER_DEFS: Record<DataSourceValue, { key: string; label: string; type: "select"|"date_range"|"text" }[]> = {
  leads: [
    { key: "status",   label: "Status",   type: "select" },
    { key: "source",   label: "Source",   type: "select" },
    { key: "segment",  label: "Segment",  type: "select" },
    { key: "date_from",label: "From date",type: "date_range" },
    { key: "date_to",  label: "To date",  type: "date_range" },
  ],
  policies: [
    { key: "status",   label: "Status",   type: "select" },
    { key: "insurer",  label: "Insurer",  type: "select" },
    { key: "segment",  label: "Segment",  type: "select" },
    { key: "docs",     label: "Docs status", type: "select" },
    { key: "date_from",label: "Sale from", type: "date_range" },
    { key: "date_to",  label: "Sale to",  type: "date_range" },
  ],
  clients: [
    { key: "segment",  label: "Segment",  type: "select" },
    { key: "date_from",label: "From date",type: "date_range" },
    { key: "date_to",  label: "To date",  type: "date_range" },
  ],
  retentions: [
    { key: "status",   label: "Status",   type: "select" },
  ],
  concierge: [
    { key: "unit_status", label: "Status", type: "select" },
    { key: "source",   label: "Source",   type: "select" },
    { key: "date_from",label: "From date",type: "date_range" },
    { key: "date_to",  label: "To date",  type: "date_range" },
  ],
  credit_health: [
    { key: "unit_status",      label: "Status",     type: "select" },
    { key: "employment_status",label: "Employment", type: "select" },
    { key: "date_from",        label: "From date",  type: "date_range" },
    { key: "date_to",          label: "To date",    type: "date_range" },
  ],
  all_leads: [
    { key: "date_from",label: "From date",type: "date_range" },
    { key: "date_to",  label: "To date",  type: "date_range" },
  ],
};

const FILTER_OPTIONS: Record<string, string[]> = {
  status:            ["Prospect","Contacted","Quoted","Won","Lost"],
  source:            ["Campaign","DS RT58","Incoming Call","Manual","Other","Rand Show","Referral","Website"],
  segment:           ["Individual","Commercial"],
  "policy_status":   ["Active","Pending","Canceled","Retained","Expired"],
  insurer:           ["1Life","1st For Women","AIG South Africa","Absa","Auto & General","Brightrock","Bryte","Budget","Centriq","Hollard","King Price","Metropolitan Life","MiWay","New National","Old Mutual Insure","Profusion","Quicksure","SAU","Santam","Yard Insurance"],
  docs:              ["Complete","Pending"],
  unit_status_concierge: ["New","Contacted","Sourcing","Quote Sent","Won","Lost","On Hold"],
  unit_status_credit:    ["New","Contacted","Assessment","Submitted","Approved","Declined","On Hold"],
  employment_status: ["Employed","Self-employed","Contract","Unemployed","Other"],
};

function formatCurrency(v: number) {
  return `R ${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCell(value: unknown, type: string): string {
  if (value === null || value === undefined) return "—";
  if (type === "date" && typeof value === "string") {
    return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }
  if (type === "currency" && typeof value === "number") return formatCurrency(value);
  if (type === "currency" && value) return formatCurrency(Number(value));
  return String(value);
}

// ── Data fetcher ──────────────────────────────────────────────

async function fetchData(
  source: DataSourceValue,
  filters: Record<string, string>,
  selectedColumns: string[],
  users: { id: string; name: string }[]
): Promise<Record<string, unknown>[]> {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  if (source === "leads" || source === "all_leads") {
    let q = supabase.from("leads").select("*, users(name)").order("created_at", { ascending: false });
    if (source !== "all_leads") {
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.source) q = q.eq("source", filters.source);
      if (filters.segment) q = q.eq("segment", filters.segment);
    }
    if (filters.date_from) q = q.gte("created_at", filters.date_from);
    if (filters.date_to) q = q.lte("created_at", filters.date_to + "T23:59:59");

    const { data } = await q.limit(500);
    return (data ?? []).map((l: Record<string, unknown>) => ({
      name: l.name,
      email: (l.email as string ?? "").includes("@placeholder.com") ? "" : l.email,
      phone: l.phone,
      status: l.status,
      source: l.source,
      segment: l.segment,
      assigned_to: (l.users as { name: string } | null)?.name ?? userMap[l.assigned_to_user_id as string] ?? "Unassigned",
      created_at: l.created_at,
      loss_reason: l.loss_reason,
      referred_by: l.referred_by,
      campaign: l.campaign,
      unit: l.business_unit_id ? (l.business_unit_id === "07cb16ec-34bb-4731-a5b2-94cf33ce85a5" ? "Concierge" : l.business_unit_id === "62a86026-af4f-47c2-8498-d1c3bb0a1ad3" ? "Credit Health" : "Sales") : "Sales",
    }));
  }

  if (source === "policies") {
    let q = supabase.from("policies").select("*, clients(name), users(name)").order("sale_date", { ascending: false });
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.insurer) q = q.eq("insurer", filters.insurer);
    if (filters.segment) q = q.eq("client_segment", filters.segment);
    if (filters.docs) q = q.eq("documentation_status", filters.docs);
    if (filters.date_from) q = q.gte("sale_date", filters.date_from);
    if (filters.date_to) q = q.lte("sale_date", filters.date_to);
    const { data } = await q.limit(500);
    return (data ?? []).map((p: Record<string, unknown>) => ({
      policy_number: p.policy_number,
      client_name: (p.clients as { name: string } | null)?.name ?? "",
      product_category: p.product_category,
      product_name: p.product_name,
      insurer: p.insurer,
      premium: Number(p.premium ?? 0),
      base_premium: Number(p.base_premium ?? 0),
      inception_date: p.inception_date,
      sale_date: p.sale_date,
      status: p.status,
      documentation_status: p.documentation_status,
      client_segment: p.client_segment,
      sold_by: (p.users as { name: string } | null)?.name ?? "",
    }));
  }

  if (source === "clients") {
    let q = supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (filters.segment) q = q.eq("segment", filters.segment);
    if (filters.date_from) q = q.gte("created_at", filters.date_from);
    if (filters.date_to) q = q.lte("created_at", filters.date_to + "T23:59:59");
    const { data } = await q.limit(500);
    return (data ?? []).map((c: Record<string, unknown>) => ({
      name: c.name, email: c.email, phone: c.phone,
      id_number: c.id_number, segment: c.segment, created_at: c.created_at,
    }));
  }

  if (source === "retentions") {
    let q = supabase.from("policies").select("*, clients(name)").in("status", ["Retained","Canceled","Expired"]).order("status");
    if (filters.status) q = q.eq("status", filters.status);
    const { data } = await q.limit(500);
    return (data ?? []).map((p: Record<string, unknown>) => {
      const rd = p.retention_details as Record<string, string> | null;
      return {
        policy_number: p.policy_number,
        client_name: (p.clients as { name: string } | null)?.name ?? "",
        product_name: p.product_name,
        insurer: p.insurer,
        premium: Number(p.premium ?? 0),
        status: p.status,
        retention_date: rd?.retainedAt ?? null,
        previous_policy: rd?.previousPolicyNumber ?? "",
        previous_premium: rd?.previousPremium ? Number(rd.previousPremium) : null,
      };
    });
  }

  if (source === "concierge") {
    let q = supabase.from("leads").select("*, users(name)")
      .eq("business_unit_id", "07cb16ec-34bb-4731-a5b2-94cf33ce85a5")
      .order("created_at", { ascending: false });
    if (filters.unit_status) q = q.eq("unit_status", filters.unit_status);
    if (filters.source) q = q.eq("source", filters.source);
    if (filters.date_from) q = q.gte("created_at", filters.date_from);
    if (filters.date_to) q = q.lte("created_at", filters.date_to + "T23:59:59");
    const { data } = await q.limit(500);
    return (data ?? []).map((l: Record<string, unknown>) => ({
      name: l.name, phone: l.phone, source: l.source,
      unit_status: l.unit_status,
      vehicle: [l.vehicle_make, l.vehicle_model, l.vehicle_year].filter(Boolean).join(" ") || null,
      vehicle_price: l.vehicle_price ? Number(l.vehicle_price) : null,
      assigned_to: (l.users as { name: string } | null)?.name ?? "Unassigned",
      created_at: l.created_at,
    }));
  }

  if (source === "credit_health") {
    let q = supabase.from("leads").select("*, users(name)")
      .eq("business_unit_id", "62a86026-af4f-47c2-8498-d1c3bb0a1ad3")
      .order("created_at", { ascending: false });
    if (filters.unit_status) q = q.eq("unit_status", filters.unit_status);
    if (filters.employment_status) q = q.eq("employment_status", filters.employment_status);
    if (filters.date_from) q = q.gte("created_at", filters.date_from);
    if (filters.date_to) q = q.lte("created_at", filters.date_to + "T23:59:59");
    const { data } = await q.limit(500);
    return (data ?? []).map((l: Record<string, unknown>) => ({
      name: l.name, phone: l.phone, source: l.source,
      unit_status: l.unit_status,
      employment_status: l.employment_status,
      monthly_income: l.monthly_income ? Number(l.monthly_income) : null,
      loan_amount: l.loan_amount ? Number(l.loan_amount) : null,
      credit_score: l.credit_score,
      assigned_to: (l.users as { name: string } | null)?.name ?? "Unassigned",
      created_at: l.created_at,
    }));
  }

  return [];
}

// ── Excel export from custom config ──────────────────────────

async function exportCustomReport(
  source: DataSourceValue,
  data: Record<string, unknown>[],
  selectedCols: string[],
  title: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = await new Promise<any>((resolve, reject) => {
    const existing = document.querySelector("script[data-xlsx]");
    if (existing) { resolve((window as unknown as { XLSX: any }).XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.setAttribute("data-xlsx", "true");
    s.onload = () => resolve((window as unknown as { XLSX: any }).XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const colDefs = COLUMNS[source].filter((c) => selectedCols.includes(c.key));
  const NAVY = "FF1A348C"; const BLUE = "FF0058A3"; const WHITE = "FFFFFFFF";
  const DARK = "FF111827"; const LGRAY = "FFF8F9FB";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = { "!merges": [] };
  let r = 0;

  // Logo row
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
    v: `MMELA FINANCIAL SERVICES (PTY) LTD   |   ${title.toUpperCase()}`,
    t: "s",
    s: { fill: { patternType: "solid", fgColor: { rgb: NAVY } }, font: { bold: true, color: { rgb: WHITE }, sz: 13, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } },
  };
  ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: colDefs.length - 1 } });
  r++;

  // Subtitle
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
    v: `Generated: ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}   |   ${data.length} records`,
    t: "s",
    s: { fill: { patternType: "solid", fgColor: { rgb: BLUE } }, font: { color: { rgb: WHITE }, sz: 9, name: "Calibri", italic: true }, alignment: { horizontal: "left", vertical: "center" } },
  };
  ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: colDefs.length - 1 } });
  r++; r++; // spacer

  // Headers
  colDefs.forEach((col, c) => {
    ws[XLSX.utils.encode_cell({ r, c })] = {
      v: col.label, t: "s",
      s: { fill: { patternType: "solid", fgColor: { rgb: NAVY } }, font: { bold: true, color: { rgb: WHITE }, sz: 10, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: { top: { style: "medium", color: { rgb: WHITE } }, bottom: { style: "medium", color: { rgb: WHITE } }, left: { style: "thin", color: { rgb: WHITE } }, right: { style: "thin", color: { rgb: WHITE } } } },
    };
  });
  r++;

  // Data
  data.forEach((row, i) => {
    const bg = i % 2 === 0 ? WHITE : LGRAY;
    const bdr = { top: { style: "thin", color: { rgb: "FFE5E7EB" } }, bottom: { style: "thin", color: { rgb: "FFE5E7EB" } }, left: { style: "thin", color: { rgb: "FFE5E7EB" } }, right: { style: "thin", color: { rgb: "FFE5E7EB" } } };
    colDefs.forEach((col, c) => {
      const val = row[col.key];
      const addr = XLSX.utils.encode_cell({ r, c });
      const fill = { patternType: "solid", fgColor: { rgb: bg } };
      const font = { color: { rgb: DARK }, sz: 10, name: "Calibri" };
      if (col.type === "currency" && val != null) {
        ws[addr] = { v: Number(val), t: "n", s: { fill, font, alignment: { horizontal: "right", vertical: "center" }, border: bdr, numFmt: '"R "#,##0.00' } };
      } else if (col.type === "date" && val) {
        ws[addr] = { v: new Date(val as string).toLocaleDateString("en-ZA"), t: "s", s: { fill, font, alignment: { horizontal: "left", vertical: "center" }, border: bdr } };
      } else {
        ws[addr] = { v: val ?? "", t: "s", s: { fill, font, alignment: { horizontal: "left", vertical: "center" }, border: bdr } };
      }
    });
    r++;
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: colDefs.length - 1 } });
  ws["!cols"] = colDefs.map(() => ({ wch: 18 }));
  ws["!rows"] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

  const date = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xlsxData = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as any;
  const blob = new Blob([xlsxData], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `mmela-${source.replace(/_/g, "-")}-${date}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────

export default function HubGenerate() {
  const { user } = useAuth();
  const [source, setSource] = useState<DataSourceValue>("leads");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<ReportConfig[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [step, setStep] = useState<"build"|"preview">("build");

  // Default all columns when source changes
  useEffect(() => {
    setSelectedCols(COLUMNS[source].map((c) => c.key));
    setFilters({});
    setData([]);
    setStep("build");
  }, [source]);

  // Load users and saved configs
  useEffect(() => {
    supabase.from("users").select("id, name").then(({ data: d }) => setUsers(d ?? []));
    if (user?.id) getUserReportConfigs(user.id).then(setSavedConfigs);
  }, [user?.id]);

  const colDefs = COLUMNS[source];
  const filterDefs = FILTER_DEFS[source];

  async function handlePreview() {
    setLoading(true);
    try {
      const result = await fetchData(source, filters, selectedCols, users);
      setData(result);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (data.length === 0) return;
    setGenerating(true);
    const src = DATA_SOURCES.find((s) => s.value === source);
    try {
      await exportCustomReport(source, data, selectedCols, src?.label ?? source);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveConfig() {
    if (!saveName.trim() || !user?.id) return;
    const cfg = await saveReportConfig(user.id, {
      name: saveName.trim(),
      data_source: source,
      filters,
      columns: selectedCols,
    });
    setSavedConfigs((prev) => [cfg, ...prev]);
    setSaveName("");
    setShowSaveInput(false);
  }

  function handleLoadConfig(cfg: ReportConfig) {
    setSource(cfg.data_source as DataSourceValue);
    setTimeout(() => {
      setFilters(cfg.filters as Record<string, string>);
      setSelectedCols(cfg.columns);
    }, 50);
  }

  async function handleDeleteConfig(id: string) {
    await deleteReportConfig(id);
    setSavedConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  const activeFilters = Object.entries(filters).filter(([, v]) => v).length;
  const previewCols = colDefs.filter((c) => selectedCols.includes(c.key));

  const getFilterOptions = (key: string) => {
    if (key === "status" && source === "policies") return FILTER_OPTIONS["policy_status"];
    if (key === "unit_status" && source === "concierge") return FILTER_OPTIONS["unit_status_concierge"];
    if (key === "unit_status" && source === "credit_health") return FILTER_OPTIONS["unit_status_credit"];
    return FILTER_OPTIONS[key] ?? [];
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Report builder</h1>
          <p className="text-sm text-gray-500 mt-1">
            Choose a data source, apply filters, pick your columns and download.
          </p>
        </div>
        {step === "preview" && (
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs gap-1.5" onClick={() => setStep("build")}>
              ← Edit filters
            </button>
            {!showSaveInput ? (
              <button className="btn btn-secondary text-xs gap-1.5" onClick={() => setShowSaveInput(true)}>
                <Save className="w-3.5 h-3.5" /> Save config
              </button>
            ) : (
              <div className="flex gap-1.5">
                <input
                  className="input-field text-xs"
                  style={{ width: 180 }}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Config name…"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveConfig(); if (e.key === "Escape") { setShowSaveInput(false); setSaveName(""); } }}
                  autoFocus
                />
                <button className="btn btn-primary text-xs" onClick={handleSaveConfig} disabled={!saveName.trim()}>Save</button>
                <button className="btn btn-ghost p-1.5" onClick={() => { setShowSaveInput(false); setSaveName(""); }}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <button className="btn btn-primary gap-1.5" onClick={handleExport} disabled={generating || data.length === 0}>
              <Download className="w-4 h-4" />
              {generating ? "Generating…" : `Export ${data.length} rows`}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* Left panel — builder */}
        <div className="col-span-1 space-y-4">
          {/* Data source */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data source</p>
            <div className="space-y-1">
              {DATA_SOURCES.map((ds) => (
                <button
                  key={ds.value}
                  onClick={() => setSource(ds.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    source === ds.value
                      ? "bg-brand-50 text-brand-900 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{ds.label}</span>
                  {source === ds.value && <ChevronRight className="w-3.5 h-3.5 text-brand-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Saved configs */}
          {savedConfigs.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Saved configs</p>
              <div className="space-y-1">
                {savedConfigs.map((cfg) => (
                  <div key={cfg.id} className="flex items-center gap-1">
                    <button
                      className="flex-1 text-left px-3 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-50 truncate"
                      onClick={() => handleLoadConfig(cfg)}
                    >
                      {cfg.name}
                    </button>
                    <button
                      className="btn btn-ghost p-1 text-red-300 hover:text-red-500"
                      onClick={() => handleDeleteConfig(cfg.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — filters + columns + preview */}
        <div className="col-span-3 space-y-4">
          {step === "build" && (
            <>
              {/* Filters */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-900">
                    Filters {activeFilters > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-bold" style={{ background: "#EEF4FD", color: "#1A348C" }}>{activeFilters}</span>}
                  </p>
                  {activeFilters > 0 && (
                    <button className="ml-auto text-xs text-gray-400 hover:text-gray-600" onClick={() => setFilters({})}>
                      Clear all
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {filterDefs.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                      {f.type === "select" ? (
                        <select
                          className="input-field"
                          value={filters[f.key] ?? ""}
                          onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        >
                          <option value="">All</option>
                          {getFilterOptions(f.key).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          className="input-field"
                          type="date"
                          value={filters[f.key] ?? ""}
                          onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Columns className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-900">
                    Columns <span className="text-gray-400 font-normal text-xs ml-1">({selectedCols.length} of {colDefs.length})</span>
                  </p>
                  <div className="ml-auto flex gap-2">
                    <button className="text-xs text-brand-700 hover:underline" onClick={() => setSelectedCols(colDefs.map((c) => c.key))}>All</button>
                    <button className="text-xs text-gray-400 hover:underline" onClick={() => setSelectedCols([])}>None</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                  {colDefs.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedCols.includes(col.key)}
                        onChange={(e) => {
                          setSelectedCols((prev) =>
                            e.target.checked ? [...prev, col.key] : prev.filter((k) => k !== col.key)
                          );
                        }}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview button */}
              <button
                className="btn btn-primary w-full justify-center gap-2"
                style={{ padding: "10px 0" }}
                onClick={handlePreview}
                disabled={loading || selectedCols.length === 0}
              >
                <Eye className="w-4 h-4" />
                {loading ? "Loading data…" : "Preview report"}
              </button>
            </>
          )}

          {step === "preview" && (
            <div className="card p-0 overflow-hidden">
              {/* Preview header */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {DATA_SOURCES.find((s) => s.value === source)?.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {data.length} records — showing first 20 rows. Export to see all.
                  </p>
                </div>
                {activeFilters > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#EEF4FD", color: "#1A348C" }}>
                    {activeFilters} filter{activeFilters !== 1 ? "s" : ""} applied
                  </span>
                )}
              </div>

              {data.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-400">No data matches your filters.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="text-sm border-collapse" style={{ minWidth: "100%" }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {previewCols.map((col) => (
                          <th key={col.key} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.slice(0, 20).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {previewCols.map((col) => (
                            <td key={col.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap text-xs">
                              {formatCell(row[col.key], col.type)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
