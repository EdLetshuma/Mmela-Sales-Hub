/**
 * Mmela Hub — Excel Report Generator
 *
 * Uses xlsx-js-style (npm package — install: npm install xlsx-js-style)
 * Full Mmela branding: logo from Supabase Logos bucket, navy headers,
 * blue subtitle, alternating rows, coloured status cells, totals row,
 * footer, freeze panes.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import XLSX from "xlsx-js-style";
import { supabase } from "./supabase";

// ── Brand colours (ARGB, no leading #) ───────────────────────
const NAVY   = "1A348C";
const BLUE   = "0058A3";
const LBLUE  = "CCE0F5";
const WHITE  = "FFFFFF";
const DARK   = "111827";
const LGRAY  = "F8F9FB";
const GBORD  = "E5E7EB";

// Status cell colours
const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  Active:    { bg: "EAF3DE", fg: "27500A" },
  Won:       { bg: "EAF3DE", fg: "27500A" },
  Retained:  { bg: "EAF3DE", fg: "27500A" },
  Approved:  { bg: "EAF3DE", fg: "27500A" },
  Complete:  { bg: "EAF3DE", fg: "27500A" },
  Pending:   { bg: "FAEEDA", fg: "633806" },
  Contacted: { bg: "FAEEDA", fg: "633806" },
  Sourcing:  { bg: "FAEEDA", fg: "633806" },
  Quoted:    { bg: "EEF4FD", fg: "1A348C" },
  Prospect:  { bg: "E6F1FB", fg: "0C447C" },
  Assessment:{ bg: "E6F1FB", fg: "0C447C" },
  Submitted: { bg: "E6F1FB", fg: "0C447C" },
  Lost:      { bg: "FCEBEB", fg: "791F1F" },
  Canceled:  { bg: "FCEBEB", fg: "791F1F" },
  Declined:  { bg: "FCEBEB", fg: "791F1F" },
  Expired:   { bg: "FCEBEB", fg: "791F1F" },
  Inactive:  { bg: "F1F3F5", fg: "6B7280" },
};

// ── Style factories ───────────────────────────────────────────

function hdrStyle(bg = NAVY): XLSX.CellStyle {
  return {
    fill: { fgColor: { rgb: bg } },
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
  bg = WHITE,
  bold = false,
  align: "left" | "center" | "right" = "left",
  fg = DARK
): XLSX.CellStyle {
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

function currStyle(bg = WHITE): XLSX.CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: '"R "#,##0.00' };
}

function pctStyle(bg = WHITE): XLSX.CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: '0.0"%"' };
}

function numStyle(bg = WHITE): XLSX.CellStyle {
  return { ...cellStyle(bg, false, "right"), numFmt: "#,##0" };
}

function statusStyle(value: string, bg: string): XLSX.CellStyle {
  const s = STATUS_STYLES[value];
  if (!s) return cellStyle(bg);
  return {
    fill: { fgColor: { rgb: s.bg } },
    font: { bold: true, color: { rgb: s.fg }, sz: 10, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    border: cellStyle(bg).border,
  };
}

// ── Logo fetcher (SVG → PNG via canvas) ───────────────────────

let _logo: string | null = null;

async function getLogo(): Promise<string | null> {
  if (_logo !== null) return _logo || null;
  try {
    const { data, error } = await supabase.storage
      .from("Logos")
      .download("Mmela MFS Logo.svg");
    if (error || !data) { _logo = ""; return null; }

    const svgText = await data.text();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const svgUrl  = URL.createObjectURL(svgBlob);

    const base64 = await new Promise<string>((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = 640;
        canvas.height = Math.round((img.height / img.width) * 640);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas.toDataURL("image/png").split(",")[1]);
        URL.revokeObjectURL(svgUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(svgUrl); rej(); };
      img.src = svgUrl;
    });
    _logo = base64;
    return base64;
  } catch {
    _logo = "";
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

async function buildWorkbook(
  sheetName: string,
  title: string,
  subtitle: string,
  cols: ColDef[],
  rows: (string | number | null)[][]
): Promise<Uint8Array> {
  const logo  = await getLogo();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = { "!merges": [], "!cols": cols.map(c => ({ wch: c.width })) };
  const NC = cols.length;
  let r = 0;

  const merge = (r1: number, c1: number, r2: number, c2: number) =>
    (ws["!merges"] as XLSX.Range[]).push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

  const enc = (row: number, col: number) => XLSX.utils.encode_cell({ r: row, c: col });

  function navyBg(row: number, ncols: number) {
    for (let c = 0; c < ncols; c++) {
      ws[enc(row, c)] = { v: "", t: "s", s: { fill: { fgColor: { rgb: NAVY } } } };
    }
  }

  // ── Logo rows (navy background, 3 rows) ──────────────────
  for (let lr = 0; lr < 3; lr++) navyBg(lr, NC);
  merge(0, 0, 2, NC - 1);

  // ── Title row ────────────────────────────────────────────
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

  // ── Subtitle row ─────────────────────────────────────────
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

  // ── Accent line ──────────────────────────────────────────
  for (let c = 0; c < NC; c++) {
    ws[enc(r, c)] = { v: "", t: "s", s: { fill: { fgColor: { rgb: LBLUE } } } };
  }
  merge(r, 0, r, NC - 1);
  r++;

  // ── Column headers ───────────────────────────────────────
  const HDR_ROW = r;
  cols.forEach((col, c) => {
    ws[enc(r, c)] = { v: col.label, t: "s", s: hdrStyle() };
  });
  r++;

  // ── Data rows ────────────────────────────────────────────
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? WHITE : LGRAY;
    row.forEach((val, c) => {
      const t  = cols[c].type;
      const ad = enc(r, c);
      if (t === "currency" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: currStyle(bg) };
      } else if (t === "pct" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: pctStyle(bg) };
      } else if (t === "number" && typeof val === "number") {
        ws[ad] = { v: val, t: "n", s: numStyle(bg) };
      } else if (t === "status" && typeof val === "string") {
        ws[ad] = { v: val ?? "", t: "s", s: statusStyle(val, bg) };
      } else {
        ws[ad] = { v: val ?? "", t: typeof val === "number" ? "n" : "s", s: cellStyle(bg) };
      }
    });
    r++;
  });

  // ── Totals row ───────────────────────────────────────────
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

  // ── Footer ───────────────────────────────────────────────
  r++;
  ws[enc(r, 0)] = {
    v: "Mmela Financial Services (Pty) Ltd   ·   Confidential — for internal use only",
    t: "s",
    s: { font: { color: { rgb: "9CA3AF" }, sz: 8, italic: true, name: "Calibri" } },
  };
  merge(r, 0, r, NC - 1);

  // ── Sheet metadata ───────────────────────────────────────
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: NC - 1 } });
  ws["!freeze"] = { xSplit: 0, ySplit: HDR_ROW + 1 };

  // Row heights
  const heights: { hpt: number }[] = [
    { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, // logo rows
    { hpt: 32 },  // title
    { hpt: 18 },  // subtitle
    { hpt: 4  },  // accent
    { hpt: 24 },  // headers
  ];
  ws["!rows"] = heights;

  // ── Logo image embed ─────────────────────────────────────
  if (logo) {
    ws["!images"] = [{
      "!type": "image",
      "!data": logo,
      "!ext": "png",
      "!pos": { r: 0, c: 0, w: 200, h: 54 },
    }];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

// ── Individual report generators ─────────────────────────────

export async function generateAgentSummaryReport(): Promise<Uint8Array> {
  const [ur, pr, lr] = await Promise.all([
    supabase.from("users").select("id, name, role").eq("status", "Active").in("role", ["Sales Agent","Team Leader"]).order("name"),
    supabase.from("policies").select("sold_by_user_id, status, premium"),
    supabase.from("leads").select("assigned_to_user_id, status"),
  ]);
  const users = ur.data ?? [], policies = pr.data ?? [], leads = lr.data ?? [];
  const rows = users.map(u => {
    const al = leads.filter(l => l.assigned_to_user_id === u.id);
    const ap = policies.filter(p => p.sold_by_user_id === u.id);
    const active = ap.filter(p => p.status === "Active");
    const won = al.filter(l => l.status === "Won").length;
    const prem = active.reduce((s, p) => s + Number(p.premium ?? 0), 0);
    return [u.name, u.role, al.length, won, al.length > 0 ? Math.round((won/al.length)*1000)/10 : 0, ap.length, active.length, prem];
  });
  return buildWorkbook("Agent Summary", "Agent Performance Summary", "Sales Unit — All Agents",
    [{label:"Agent",type:"text",width:24},{label:"Role",type:"text",width:20},{label:"Total Leads",type:"number",width:12},
     {label:"Won",type:"number",width:8},{label:"Conversion %",type:"pct",width:13},{label:"Total Policies",type:"number",width:14},
     {label:"Active Policies",type:"number",width:14},{label:"Active Premium",type:"currency",width:18}], rows);
}

export async function generatePolicyRegisterReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("policies")
    .select("policy_number, status, product_name, product_category, insurer, premium, base_premium, inception_date, sale_date, documentation_status, client_segment, clients(name), users(name)")
    .order("inception_date", { ascending: false });
  const rows = (data ?? []).map((p: Record<string, unknown>) => [
    String(p.policy_number ?? ""),
    String((p.clients as {name:string}|null)?.name ?? ""),
    String(p.product_category ?? ""), String(p.product_name ?? ""), String(p.insurer ?? ""),
    Number(p.premium ?? 0), Number(p.base_premium ?? 0),
    p.inception_date ? new Date(p.inception_date as string).toLocaleDateString("en-ZA") : "",
    p.sale_date ? new Date(p.sale_date as string).toLocaleDateString("en-ZA") : "",
    String(p.status ?? ""), String(p.documentation_status ?? ""), String(p.client_segment ?? ""),
    String((p.users as {name:string}|null)?.name ?? ""),
  ]);
  return buildWorkbook("Policy Register", "Policy Register", "All Policies",
    [{label:"Policy #",type:"text",width:14},{label:"Client",type:"text",width:24},
     {label:"Category",type:"text",width:20},{label:"Product",type:"text",width:24},
     {label:"Insurer",type:"text",width:16},{label:"Premium",type:"currency",width:16},
     {label:"Base Premium",type:"currency",width:14},{label:"Inception",type:"text",width:13},
     {label:"Sale Date",type:"text",width:13},{label:"Status",type:"status",width:12},
     {label:"Docs",type:"status",width:11},{label:"Segment",type:"text",width:12},
     {label:"Sold By",type:"text",width:18}], rows);
}

export async function generateRetentionSummaryReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("policies")
    .select("policy_number, status, premium, insurer, product_name, retention_details, clients(name)")
    .in("status", ["Retained","Canceled","Expired"]).order("status");
  const rows = (data ?? []).map((p: Record<string, unknown>) => {
    const rd = p.retention_details as Record<string,string>|null;
    return [String(p.policy_number ?? ""), String((p.clients as {name:string}|null)?.name ?? ""),
      String(p.product_name ?? ""), String(p.insurer ?? ""), Number(p.premium ?? 0),
      String(p.status ?? ""), rd?.retainedAt ? new Date(rd.retainedAt).toLocaleDateString("en-ZA") : "",
      rd?.previousPolicyNumber ?? "", rd?.previousPremium ? Number(rd.previousPremium) : 0];
  });
  return buildWorkbook("Retention Summary", "Retention Summary", "Canceled, Expired & Retained",
    [{label:"Policy #",type:"text",width:14},{label:"Client",type:"text",width:24},
     {label:"Product",type:"text",width:24},{label:"Insurer",type:"text",width:16},
     {label:"Premium",type:"currency",width:16},{label:"Status",type:"status",width:12},
     {label:"Retained On",type:"text",width:14},{label:"Prev Policy #",type:"text",width:14},
     {label:"Prev Premium",type:"currency",width:16}], rows);
}

export async function generateLeadPipelineReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("leads")
    .select("name, email, phone, status, source, segment, created_at, loss_reason, users(name)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []).map((l: Record<string, unknown>) => [
    String(l.name ?? ""),
    (l.email as string ?? "").includes("@placeholder.com") ? "" : String(l.email ?? ""),
    String(l.phone ?? ""), String(l.status ?? ""), String(l.source ?? ""), String(l.segment ?? ""),
    String((l.users as {name:string}|null)?.name ?? "Unassigned"),
    l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
    String(l.loss_reason ?? ""),
  ]);
  return buildWorkbook("Lead Pipeline", "Lead Pipeline", "All Leads",
    [{label:"Name",type:"text",width:22},{label:"Email",type:"text",width:26},
     {label:"Phone",type:"text",width:14},{label:"Status",type:"status",width:12},
     {label:"Source",type:"text",width:14},{label:"Segment",type:"text",width:12},
     {label:"Assigned To",type:"text",width:18},{label:"Date Added",type:"text",width:13},
     {label:"Loss Reason",type:"text",width:16}], rows);
}

export async function generateConversionBySourceReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("leads").select("source, status");
  const map: Record<string,{total:number;contacted:number;quoted:number;won:number;lost:number}> = {};
  (data ?? []).forEach((l: Record<string,string>) => {
    const s = l.source ?? "Unknown";
    if (!map[s]) map[s] = {total:0,contacted:0,quoted:0,won:0,lost:0};
    map[s].total++;
    if (l.status === "Contacted") map[s].contacted++;
    if (l.status === "Quoted")    map[s].quoted++;
    if (l.status === "Won")       map[s].won++;
    if (l.status === "Lost")      map[s].lost++;
  });
  const rows = Object.entries(map).sort((a,b) => b[1].won-a[1].won).map(([src,s]) =>
    [src, s.total, s.contacted, s.quoted, s.won, s.lost, s.total > 0 ? Math.round((s.won/s.total)*1000)/10 : 0]);
  return buildWorkbook("Conversion by Source", "Conversion by Source", "Lead Funnel Analysis",
    [{label:"Source",type:"text",width:18},{label:"Total",type:"number",width:10},
     {label:"Contacted",type:"number",width:11},{label:"Quoted",type:"number",width:9},
     {label:"Won",type:"number",width:8},{label:"Lost",type:"number",width:8},
     {label:"Win Rate %",type:"pct",width:11}], rows);
}

export async function generatePremiumByInsurerReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("policies").select("insurer, status, premium, product_category");
  const map: Record<string,{active:number;total:number;activePrem:number;cats:Set<string>}> = {};
  (data ?? []).forEach((p: Record<string,unknown>) => {
    const ins = String(p.insurer ?? "Unknown");
    if (!map[ins]) map[ins] = {active:0,total:0,activePrem:0,cats:new Set()};
    map[ins].total++;
    if (p.status === "Active") { map[ins].active++; map[ins].activePrem += Number(p.premium ?? 0); }
    if (p.product_category) map[ins].cats.add(String(p.product_category));
  });
  const grand = Object.values(map).reduce((s,v) => s + v.activePrem, 0);
  const rows = Object.entries(map).sort((a,b) => b[1].activePrem-a[1].activePrem).map(([ins,v]) =>
    [ins, v.active, v.total, v.activePrem, grand > 0 ? Math.round((v.activePrem/grand)*1000)/10 : 0, Array.from(v.cats).join(", ")]);
  return buildWorkbook("Premium by Insurer", "Premium by Insurer", "Active Premium Distribution",
    [{label:"Insurer",type:"text",width:20},{label:"Active Policies",type:"number",width:14},
     {label:"Total Policies",type:"number",width:13},{label:"Active Premium",type:"currency",width:18},
     {label:"Market Share %",type:"pct",width:14},{label:"Categories",type:"text",width:30}], rows);
}

export async function generateConciergePipelineReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("leads")
    .select("name, phone, source, unit_status, vehicle_make, vehicle_model, vehicle_year, vehicle_price, created_at, users(name)")
    .eq("business_unit_id", "07cb16ec-34bb-4731-a5b2-94cf33ce85a5").order("created_at", { ascending: false });
  const rows = (data ?? []).map((l: Record<string,unknown>) => [
    String(l.name ?? ""), String(l.phone ?? ""), String(l.source ?? ""),
    String(l.unit_status ?? ""),
    String([l.vehicle_make,l.vehicle_model,l.vehicle_year].filter(Boolean).join(" ") || "—"),
    l.vehicle_price ? Number(l.vehicle_price) : 0,
    String((l.users as {name:string}|null)?.name ?? "Unassigned"),
    l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
  ]);
  return buildWorkbook("Concierge Pipeline", "Concierge Pipeline", "Vehicle Acquisition",
    [{label:"Name",type:"text",width:22},{label:"Phone",type:"text",width:14},
     {label:"Source",type:"text",width:12},{label:"Status",type:"status",width:14},
     {label:"Vehicle",type:"text",width:26},{label:"Budget",type:"currency",width:16},
     {label:"Assigned To",type:"text",width:18},{label:"Date Added",type:"text",width:13}], rows);
}

export async function generateCreditHealthPipelineReport(): Promise<Uint8Array> {
  const { data } = await supabase.from("leads")
    .select("name, phone, source, unit_status, employment_status, monthly_income, loan_amount, credit_score, created_at, users(name)")
    .eq("business_unit_id", "62a86026-af4f-47c2-8498-d1c3bb0a1ad3").order("created_at", { ascending: false });
  const rows = (data ?? []).map((l: Record<string,unknown>) => [
    String(l.name ?? ""), String(l.phone ?? ""), String(l.source ?? ""),
    String(l.unit_status ?? ""), String(l.employment_status ?? ""),
    l.monthly_income ? Number(l.monthly_income) : 0,
    l.loan_amount ? Number(l.loan_amount) : 0,
    String(l.credit_score ?? ""),
    String((l.users as {name:string}|null)?.name ?? "Unassigned"),
    l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
  ]);
  return buildWorkbook("Credit Health", "Credit Health Pipeline", "Credit Advisory",
    [{label:"Name",type:"text",width:22},{label:"Phone",type:"text",width:14},
     {label:"Source",type:"text",width:12},{label:"Status",type:"status",width:14},
     {label:"Employment",type:"text",width:14},{label:"Monthly Income",type:"currency",width:16},
     {label:"Loan Amount",type:"currency",width:14},{label:"Credit Score",type:"text",width:12},
     {label:"Assigned To",type:"text",width:18},{label:"Date Added",type:"text",width:13}], rows);
}

export async function generateBusinessUnitComparisonReport(): Promise<Uint8Array> {
  const [{ data: leads }, { data: policies }] = await Promise.all([
    supabase.from("leads").select("business_unit_id, status"),
    supabase.from("policies").select("status, premium"),
  ]);
  const all = leads ?? [];
  const salesLeads   = all.filter(l => !l.business_unit_id || l.business_unit_id === "75299d6f-408d-4f5c-8e91-63ac5d965866");
  const concierge    = all.filter(l => l.business_unit_id === "07cb16ec-34bb-4731-a5b2-94cf33ce85a5");
  const ch           = all.filter(l => l.business_unit_id === "62a86026-af4f-47c2-8498-d1c3bb0a1ad3");
  const active       = (policies ?? []).filter(p => p.status === "Active");
  const totalPrem    = active.reduce((s,p) => s + Number(p.premium ?? 0), 0);
  function urow(name: string, ul: typeof all, prem = 0, pol = 0) {
    const won = ul.filter(l => l.status === "Won").length;
    return [name, ul.length, won, ul.length > 0 ? Math.round((won/ul.length)*1000)/10 : 0, pol, prem];
  }
  const rows = [
    urow("Insurance Sales", salesLeads, totalPrem, active.length),
    urow("Concierge", concierge),
    urow("Credit Health", ch),
    ["TOTAL", all.length, all.filter(l => l.status === "Won").length,
     all.length > 0 ? Math.round((all.filter(l => l.status === "Won").length/all.length)*1000)/10 : 0,
     active.length, totalPrem],
  ];
  return buildWorkbook("Unit Comparison", "Business Unit Comparison", "Cross-Unit Performance",
    [{label:"Business Unit",type:"text",width:22},{label:"Total Leads",type:"number",width:12},
     {label:"Won",type:"number",width:8},{label:"Win Rate %",type:"pct",width:11},
     {label:"Active Policies",type:"number",width:14},{label:"Active Premium",type:"currency",width:18}], rows);
}

// ── Master dispatcher ─────────────────────────────────────────

export async function generateReport(reportType: string): Promise<Uint8Array> {
  switch (reportType) {
    case "agent_summary":            return generateAgentSummaryReport();
    case "policy_register":          return generatePolicyRegisterReport();
    case "retention_summary":        return generateRetentionSummaryReport();
    case "lead_pipeline":            return generateLeadPipelineReport();
    case "conversion_by_source":     return generateConversionBySourceReport();
    case "premium_by_insurer":       return generatePremiumByInsurerReport();
    case "concierge_pipeline":       return generateConciergePipelineReport();
    case "credit_health_pipeline":   return generateCreditHealthPipelineReport();
    case "business_unit_comparison": return generateBusinessUnitComparisonReport();
    default: throw new Error(`Unknown report type: ${reportType}`);
  }
}

export function downloadReport(data: Uint8Array, filename: string) {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
