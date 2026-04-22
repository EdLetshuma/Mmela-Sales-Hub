/**
 * POST /api/generate-report
 * Generates a branded XLSX report and uploads it to Supabase Storage.
 * Returns the public download URL.
 * Called by the send-report Edge Function for scheduled deliveries.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx-js-style";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INTERNAL_SECRET   = SERVICE_ROLE_KEY?.slice(-32) ?? "";

// ── Brand colours ─────────────────────────────────────────────
const NAVY  = "1A348C";
const BLUE  = "0058A3";
const LBLUE = "CCE0F5";
const WHITE = "FFFFFF";
const DARK  = "111827";
const LGRAY = "F8F9FB";
const GBORD = "E5E7EB";

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  Active:    { bg: "EAF3DE", fg: "27500A" },
  Won:       { bg: "EAF3DE", fg: "27500A" },
  Retained:  { bg: "EAF3DE", fg: "27500A" },
  Complete:  { bg: "EAF3DE", fg: "27500A" },
  Pending:   { bg: "FAEEDA", fg: "633806" },
  Contacted: { bg: "FAEEDA", fg: "633806" },
  Quoted:    { bg: "EEF4FD", fg: "1A348C" },
  Prospect:  { bg: "E6F1FB", fg: "0C447C" },
  Lost:      { bg: "FCEBEB", fg: "791F1F" },
  Canceled:  { bg: "FCEBEB", fg: "791F1F" },
  Declined:  { bg: "FCEBEB", fg: "791F1F" },
  Expired:   { bg: "FCEBEB", fg: "791F1F" },
  Inactive:  { bg: "F1F3F5", fg: "6B7280" },
};

// ── Style helpers ─────────────────────────────────────────────

type CellStyle = Record<string, unknown>;

function hdrStyle(): CellStyle {
  return {
    fill: { fgColor: { rgb: NAVY } },
    font: { bold: true, color: { rgb: WHITE }, sz: 10, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top:    { style: "medium", color: { rgb: "0F1B4A" } },
      bottom: { style: "medium", color: { rgb: "0F1B4A" } },
      left:   { style: "thin",   color: { rgb: WHITE } },
      right:  { style: "thin",   color: { rgb: WHITE } },
    },
  };
}

function cellStyle(
  bg = WHITE, bold = false,
  align: "left" | "center" | "right" = "left",
  fg = DARK
): CellStyle {
  return {
    fill: { fgColor: { rgb: bg } },
    font: { bold, color: { rgb: fg }, sz: 10, name: "Calibri" },
    alignment: { horizontal: align, vertical: "center" },
    border: {
      top:    { style: "thin", color: { rgb: GBORD } },
      bottom: { style: "thin", color: { rgb: GBORD } },
      left:   { style: "thin", color: { rgb: GBORD } },
      right:  { style: "thin", color: { rgb: GBORD } },
    },
  };
}

function currStyle(bg = WHITE): CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: '"R "#,##0.00' };
}
function numStyle(bg = WHITE): CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: "#,##0" };
}
function pctStyle(bg = WHITE): CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: '0.0"%"' };
}
function statusStyle(value: string, bg: string): CellStyle {
  const s = STATUS_STYLES[value];
  if (!s) return cellStyle(bg);
  return {
    fill: { fgColor: { rgb: s.bg } },
    font: { bold: true, color: { rgb: s.fg }, sz: 10, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    border: cellStyle(bg).border,
  };
}

// ── Fetch logo from Supabase Storage as base64 ───────────────

async function fetchLogo(): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/Logos/MFS%20LOGO%20ROTATED.png`
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return b64;
  } catch {
    return null;
  }
}

// ── Column definition ─────────────────────────────────────────

interface ColDef {
  label: string;
  type: "text" | "currency" | "pct" | "number" | "status";
  width: number;
}

// ── Core sheet builder ────────────────────────────────────────

function buildSheet(
  sheetName: string,
  title: string,
  subtitle: string,
  cols: ColDef[],
  rows: (string | number | null)[][],
  logo: string | null
): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = { "!merges": [], "!cols": cols.map(c => ({ wch: c.width })) };
  const NC = cols.length;
  let r = 0;

  const merge = (r1: number, c1: number, r2: number, c2: number) =>
    ws["!merges"].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

  const enc = (row: number, col: number) => XLSX.utils.encode_cell({ r: row, c: col });

  // Logo rows — navy background
  for (let lr = 0; lr < 3; lr++) {
    for (let c = 0; c < NC; c++) {
      ws[enc(lr, c)] = { v: "", t: "s", s: { fill: { fgColor: { rgb: NAVY } } } };
    }
  }
  merge(0, 0, 2, NC - 1);

  // Title
  ws[enc(r = 3, 0)] = {
    v: `MMELA FINANCIAL SERVICES (PTY) LTD   ·   ${title.toUpperCase()}`,
    t: "s",
    s: {
      fill: { fgColor: { rgb: NAVY } },
      font: { bold: true, color: { rgb: WHITE }, sz: 14, name: "Calibri" },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };
  merge(r, 0, r, NC - 1);
  r++;

  // Subtitle
  ws[enc(r, 0)] = {
    v: `${subtitle}   ·   Generated: ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}   ·   ${rows.length} records`,
    t: "s",
    s: {
      fill: { fgColor: { rgb: BLUE } },
      font: { color: { rgb: WHITE }, sz: 9, name: "Calibri", italic: true },
      alignment: { horizontal: "left", vertical: "center" },
    },
  };
  merge(r, 0, r, NC - 1);
  r++;

  // Accent line
  for (let c = 0; c < NC; c++) {
    ws[enc(r, c)] = { v: "", t: "s", s: { fill: { fgColor: { rgb: LBLUE } } } };
  }
  merge(r, 0, r, NC - 1);
  r++;

  // Headers
  const HDR_ROW = r;
  cols.forEach((col, c) => {
    ws[enc(r, c)] = { v: col.label, t: "s", s: hdrStyle() };
  });
  r++;

  // Data rows — no zebra striping per requirement
  rows.forEach((row) => {
    row.forEach((val, c) => {
      const t  = cols[c].type;
      const ad = enc(r, c);
      if (t === "currency" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: currStyle() };
      } else if (t === "pct" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: pctStyle() };
      } else if (t === "number" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: numStyle() };
      } else if (t === "status" && typeof val === "string") {
        ws[ad] = { v: val ?? "", t: "s", s: statusStyle(val, WHITE) };
      } else {
        ws[ad] = { v: val ?? "", t: typeof val === "number" ? "n" : "s", s: cellStyle() };
      }
    });
    r++;
  });

  // Totals row
  const hasTotals = cols.some(c => c.type === "currency" || c.type === "number");
  if (hasTotals) {
    const totStyle = { ...cellStyle(LBLUE, true, "right", NAVY), fill: { fgColor: { rgb: LBLUE } } };
    cols.forEach((col, c) => {
      const ad = enc(r, c);
      if (c === 0) {
        ws[ad] = { v: "TOTAL", t: "s", s: { ...cellStyle(LBLUE, true, "left", NAVY), fill: { fgColor: { rgb: LBLUE } } } };
      } else if (col.type === "currency") {
        const total = rows.reduce((s, row) => s + (typeof row[c] === "number" ? (row[c] as number) : 0), 0);
        ws[ad] = { v: total, t: "n", s: { ...totStyle, numFmt: '"R "#,##0.00' } };
      } else if (col.type === "number") {
        const total = rows.reduce((s, row) => s + (typeof row[c] === "number" ? (row[c] as number) : 0), 0);
        ws[ad] = { v: total, t: "n", s: { ...totStyle, numFmt: "#,##0" } };
      } else {
        ws[ad] = { v: "", t: "s", s: cellStyle(LBLUE) };
      }
    });
    r++;
  }

  // Footer
  r++;
  ws[enc(r, 0)] = {
    v: "Mmela Financial Services (Pty) Ltd   ·   Confidential — for internal use only",
    t: "s",
    s: { font: { color: { rgb: "9CA3AF" }, sz: 8, italic: true, name: "Calibri" } },
  };
  merge(r, 0, r, NC - 1);

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: NC - 1 } });
  ws["!freeze"] = { xSplit: 0, ySplit: HDR_ROW + 1 };
  ws["!rows"] = [
    { hpt: 18 }, { hpt: 18 }, { hpt: 18 },
    { hpt: 32 }, { hpt: 18 }, { hpt: 4 }, { hpt: 24 },
  ];

  if (logo) {
    ws["!images"] = [{
      "!type": "image", "!data": logo, "!ext": "png",
      "!pos": { r: 0, c: 0, w: 200, h: 54 },
    }];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

// ── Data fetchers ─────────────────────────────────────────────

async function getReportData(
  admin: ReturnType<typeof createClient>,
  reportType: string
): Promise<{ cols: ColDef[]; rows: (string | number | null)[][]; title: string; subtitle: string; sheetName: string }> {

  if (reportType === "policy_register") {
    const { data } = await admin.from("policies")
      .select("policy_number, status, product_name, product_category, insurer, premium, base_premium, inception_date, sale_date, documentation_status, client_segment, clients(name), users(name)")
      .order("inception_date", { ascending: false });
    const rows = (data ?? []).map((p: Record<string, unknown>) => [
      String(p.policy_number ?? ""),
      String((p.clients as { name: string } | null)?.name ?? ""),
      String(p.product_category ?? ""), String(p.product_name ?? ""), String(p.insurer ?? ""),
      Number(p.premium ?? 0), Number(p.base_premium ?? 0),
      p.inception_date ? new Date(p.inception_date as string).toLocaleDateString("en-ZA") : "",
      p.sale_date ? new Date(p.sale_date as string).toLocaleDateString("en-ZA") : "",
      String(p.status ?? ""), String(p.documentation_status ?? ""), String(p.client_segment ?? ""),
      String((p.users as { name: string } | null)?.name ?? ""),
    ]);
    return {
      title: "Policy Register", subtitle: "All Policies", sheetName: "Policy Register",
      cols: [
        { label: "Policy #",       type: "text",     width: 14 },
        { label: "Client",         type: "text",     width: 24 },
        { label: "Category",       type: "text",     width: 20 },
        { label: "Product",        type: "text",     width: 24 },
        { label: "Insurer",        type: "text",     width: 16 },
        { label: "Premium",        type: "currency", width: 16 },
        { label: "Base Premium",   type: "currency", width: 14 },
        { label: "Inception",      type: "text",     width: 13 },
        { label: "Sale Date",      type: "text",     width: 13 },
        { label: "Status",         type: "status",   width: 12 },
        { label: "Docs",           type: "status",   width: 11 },
        { label: "Segment",        type: "text",     width: 12 },
        { label: "Sold By",        type: "text",     width: 18 },
      ],
      rows,
    };
  }

  if (reportType === "agent_summary") {
    const [ur, pr, lr] = await Promise.all([
      admin.from("users").select("id, name, role").eq("status", "Active").in("role", ["Sales Agent", "Team Leader"]).order("name"),
      admin.from("policies").select("sold_by_user_id, status, premium"),
      admin.from("leads").select("assigned_to_user_id, status"),
    ]);
    const users = ur.data ?? [], policies = pr.data ?? [], leads = lr.data ?? [];
    const rows = users.map((u: Record<string, unknown>) => {
      const al = leads.filter((l: Record<string, unknown>) => l.assigned_to_user_id === u.id);
      const ap = policies.filter((p: Record<string, unknown>) => p.sold_by_user_id === u.id);
      const active = ap.filter((p: Record<string, unknown>) => p.status === "Active");
      const won = al.filter((l: Record<string, unknown>) => l.status === "Won").length;
      const prem = active.reduce((s: number, p: Record<string, unknown>) => s + Number(p.premium ?? 0), 0);
      return [String(u.name), String(u.role), al.length, won, al.length > 0 ? Math.round((won / al.length) * 1000) / 10 : 0, ap.length, active.length, prem];
    });
    return {
      title: "Agent Performance Summary", subtitle: "Sales Unit — All Agents", sheetName: "Agent Summary",
      cols: [
        { label: "Agent",           type: "text",     width: 24 },
        { label: "Role",            type: "text",     width: 20 },
        { label: "Total Leads",     type: "number",   width: 12 },
        { label: "Won",             type: "number",   width: 8  },
        { label: "Conversion %",   type: "pct",      width: 13 },
        { label: "Total Policies",  type: "number",   width: 14 },
        { label: "Active Policies", type: "number",   width: 14 },
        { label: "Active Premium",  type: "currency", width: 18 },
      ],
      rows,
    };
  }

  if (reportType === "lead_pipeline") {
    const { data } = await admin.from("leads")
      .select("name, email, phone, status, source, segment, created_at, loss_reason, users(name)")
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ""),
      (String(l.email ?? "")).includes("@placeholder.com") ? "" : String(l.email ?? ""),
      String(l.phone ?? ""), String(l.status ?? ""), String(l.source ?? ""), String(l.segment ?? ""),
      String((l.users as { name: string } | null)?.name ?? "Unassigned"),
      l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
      String(l.loss_reason ?? ""),
    ]);
    return {
      title: "Lead Pipeline", subtitle: "All Leads", sheetName: "Lead Pipeline",
      cols: [
        { label: "Name",        type: "text",   width: 22 },
        { label: "Email",       type: "text",   width: 26 },
        { label: "Phone",       type: "text",   width: 14 },
        { label: "Status",      type: "status", width: 12 },
        { label: "Source",      type: "text",   width: 14 },
        { label: "Segment",     type: "text",   width: 12 },
        { label: "Assigned To", type: "text",   width: 18 },
        { label: "Date Added",  type: "text",   width: 13 },
        { label: "Loss Reason", type: "text",   width: 16 },
      ],
      rows,
    };
  }

  if (reportType === "premium_by_insurer") {
    const { data } = await admin.from("policies").select("insurer, status, premium, product_category");
    const map: Record<string, { active: number; total: number; activePrem: number; cats: Set<string> }> = {};
    (data ?? []).forEach((p: Record<string, unknown>) => {
      const ins = String(p.insurer ?? "Unknown");
      if (!map[ins]) map[ins] = { active: 0, total: 0, activePrem: 0, cats: new Set() };
      map[ins].total++;
      if (p.status === "Active") { map[ins].active++; map[ins].activePrem += Number(p.premium ?? 0); }
      if (p.product_category) map[ins].cats.add(String(p.product_category));
    });
    const grand = Object.values(map).reduce((s, v) => s + v.activePrem, 0);
    const rows = Object.entries(map).sort((a, b) => b[1].activePrem - a[1].activePrem)
      .map(([ins, v]) => [ins, v.active, v.total, v.activePrem, grand > 0 ? Math.round((v.activePrem / grand) * 1000) / 10 : 0, Array.from(v.cats).join(", ")]);
    return {
      title: "Premium by Insurer", subtitle: "Active Premium Distribution", sheetName: "Premium by Insurer",
      cols: [
        { label: "Insurer",          type: "text",     width: 20 },
        { label: "Active Policies",  type: "number",   width: 14 },
        { label: "Total Policies",   type: "number",   width: 13 },
        { label: "Active Premium",   type: "currency", width: 18 },
        { label: "Market Share %",   type: "pct",      width: 14 },
        { label: "Categories",       type: "text",     width: 30 },
      ],
      rows,
    };
  }

  if (reportType === "retention_summary") {
    const { data } = await admin.from("policies")
      .select("policy_number, status, premium, insurer, product_name, retention_details, clients(name)")
      .in("status", ["Retained", "Canceled", "Expired"]).order("status");
    const rows = (data ?? []).map((p: Record<string, unknown>) => {
      const rd = p.retention_details as Record<string, string> | null;
      return [
        String(p.policy_number ?? ""),
        String((p.clients as { name: string } | null)?.name ?? ""),
        String(p.product_name ?? ""), String(p.insurer ?? ""), Number(p.premium ?? 0),
        String(p.status ?? ""),
        rd?.retainedAt ? new Date(rd.retainedAt).toLocaleDateString("en-ZA") : "",
        rd?.previousPolicyNumber ?? "",
        rd?.previousPremium ? Number(rd.previousPremium) : 0,
      ];
    });
    return {
      title: "Retention Summary", subtitle: "Canceled, Expired & Retained", sheetName: "Retention Summary",
      cols: [
        { label: "Policy #",      type: "text",     width: 14 },
        { label: "Client",        type: "text",     width: 24 },
        { label: "Product",       type: "text",     width: 24 },
        { label: "Insurer",       type: "text",     width: 16 },
        { label: "Premium",       type: "currency", width: 16 },
        { label: "Status",        type: "status",   width: 12 },
        { label: "Retained On",   type: "text",     width: 14 },
        { label: "Prev Policy #", type: "text",     width: 14 },
        { label: "Prev Premium",  type: "currency", width: 16 },
      ],
      rows,
    };
  }

  if (reportType === "concierge_pipeline") {
    const { data } = await admin.from("leads")
      .select("name, phone, source, unit_status, vehicle_make, vehicle_model, vehicle_year, vehicle_price, created_at, users(name)")
      .eq("business_unit_id", "07cb16ec-34bb-4731-a5b2-94cf33ce85a5").order("created_at", { ascending: false });
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ""), String(l.phone ?? ""), String(l.source ?? ""), String(l.unit_status ?? ""),
      String([l.vehicle_make, l.vehicle_model, l.vehicle_year].filter(Boolean).join(" ") || "—"),
      l.vehicle_price ? Number(l.vehicle_price) : 0,
      String((l.users as { name: string } | null)?.name ?? "Unassigned"),
      l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
    ]);
    return {
      title: "Concierge Pipeline", subtitle: "Vehicle Acquisition", sheetName: "Concierge Pipeline",
      cols: [
        { label: "Name",        type: "text",     width: 22 },
        { label: "Phone",       type: "text",     width: 14 },
        { label: "Source",      type: "text",     width: 12 },
        { label: "Status",      type: "status",   width: 14 },
        { label: "Vehicle",     type: "text",     width: 26 },
        { label: "Budget",      type: "currency", width: 16 },
        { label: "Assigned To", type: "text",     width: 18 },
        { label: "Date Added",  type: "text",     width: 13 },
      ],
      rows,
    };
  }

  if (reportType === "credit_health_pipeline") {
    const { data } = await admin.from("leads")
      .select("name, phone, source, unit_status, employment_status, monthly_income, loan_amount, credit_score, created_at, users(name)")
      .eq("business_unit_id", "62a86026-af4f-47c2-8498-d1c3bb0a1ad3").order("created_at", { ascending: false });
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ""), String(l.phone ?? ""), String(l.source ?? ""), String(l.unit_status ?? ""),
      String(l.employment_status ?? ""),
      l.monthly_income ? Number(l.monthly_income) : 0,
      l.loan_amount ? Number(l.loan_amount) : 0,
      String(l.credit_score ?? ""),
      String((l.users as { name: string } | null)?.name ?? "Unassigned"),
      l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
    ]);
    return {
      title: "Credit Health Pipeline", subtitle: "Credit Advisory", sheetName: "Credit Health",
      cols: [
        { label: "Name",           type: "text",     width: 22 },
        { label: "Phone",          type: "text",     width: 14 },
        { label: "Source",         type: "text",     width: 12 },
        { label: "Status",         type: "status",   width: 14 },
        { label: "Employment",     type: "text",     width: 14 },
        { label: "Monthly Income", type: "currency", width: 16 },
        { label: "Loan Amount",    type: "currency", width: 14 },
        { label: "Credit Score",   type: "text",     width: 12 },
        { label: "Assigned To",    type: "text",     width: 18 },
        { label: "Date Added",     type: "text",     width: 13 },
      ],
      rows,
    };
  }

  // Fallback: conversion by source
  const { data } = await admin.from("leads").select("source, status");
  const srcMap: Record<string, { total: number; won: number }> = {};
  (data ?? []).forEach((l: Record<string, unknown>) => {
    const s = String(l.source ?? "Unknown");
    if (!srcMap[s]) srcMap[s] = { total: 0, won: 0 };
    srcMap[s].total++;
    if (l.status === "Won") srcMap[s].won++;
  });
  const rows = Object.entries(srcMap).sort((a, b) => b[1].total - a[1].total)
    .map(([source, v]) => [source, v.total, v.won, v.total > 0 ? Math.round((v.won / v.total) * 1000) / 10 : 0]);
  return {
    title: "Conversion by Source", subtitle: "Lead Funnel Analysis", sheetName: "Conversion by Source",
    cols: [
      { label: "Source",      type: "text",   width: 18 },
      { label: "Total Leads", type: "number", width: 12 },
      { label: "Won",         type: "number", width: 8  },
      { label: "Win Rate %",  type: "pct",    width: 11 },
    ],
    rows,
  };
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify this is an internal call from our Edge Function
  const secret = req.headers.get("x-internal-secret") ?? "";
  if (!secret || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { report_type, mailing_id } = await req.json();
    if (!report_type) return NextResponse.json({ error: "report_type required" }, { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch logo and report data in parallel
    const [logo, reportData] = await Promise.all([
      fetchLogo(),
      getReportData(admin as any, report_type),
    ]);

    // Build XLSX
    const xlsxBytes = buildSheet(
      reportData.sheetName,
      reportData.title,
      reportData.subtitle,
      reportData.cols,
      reportData.rows,
      logo
    );

    // Upload to Supabase Storage — reports bucket, 24hr expiry path
    const date    = new Date().toISOString().slice(0, 10);
    const fname   = `mmela-${report_type.replace(/_/g, "-")}-${date}.xlsx`;
    const path    = `scheduled/${mailing_id ?? "manual"}/${fname}`;

    const { error: uploadErr } = await admin.storage
      .from("reports")
      .upload(path, xlsxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Get a signed URL valid for 7 days
    const { data: signedData, error: signErr } = await admin.storage
      .from("reports")
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signErr) throw signErr;

    return NextResponse.json({
      ok: true,
      url: signedData.signedUrl,
      filename: fname,
      rows: reportData.rows.length,
    });

  } catch (err) {
    console.error("generate-report error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
