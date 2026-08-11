import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY      = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM            = 'Mmela Hub Reports <onboarding@resend.dev>';
const NAVY            = '#1A348C';
const BLUE            = '#0058A3';
const LOGO            = 'https://tslovjdrcbnewcajawiq.supabase.co/storage/v1/object/public/Logos/Mmela%20MFS%20Logo%20WHITE.png';
const INTERNAL_SECRET = SERVICE_KEY.slice(-32);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };

// Business unit IDs — same constants used app-wide (lib/sales-api.ts).
const SALES_UNIT_ID        = '75299d6f-408d-4f5c-8e91-63ac5d965866';
const CONCIERGE_UNIT_ID    = '07cb16ec-34bb-4731-a5b2-94cf33ce85a5';
const CREDIT_HEALTH_UNIT_ID = '62a86026-af4f-47c2-8498-d1c3bb0a1ad3';

const REPORT_LABELS: Record<string,string> = {
  agent_summary:'Agent Performance Summary', policy_register:'Policy Register',
  retention_summary:'Retention Summary', lead_pipeline:'Lead Pipeline',
  conversion_by_source:'Conversion by Source', premium_by_insurer:'Premium by Insurer',
  concierge_pipeline:'Concierge Pipeline', credit_health_pipeline:'Credit Health Pipeline',
  business_unit_comparison:'Business Unit Comparison',
};

async function dbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`dbGet ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// ── Date range scoping ──────────────────────────────────────────
// A mailing can be limited to a period ("this week's new policies")
// instead of always dumping the entire table. "since_last_sent" is
// the useful default for a recurring mailing — each send only
// contains what's new since the previous one.

type ReportDateRange = 'all' | '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'since_last_sent';

const RANGE_LABELS: Record<ReportDateRange, string> = {
  all: 'All data', since_last_sent: 'Since last send', '7d': 'Last 7 days',
  '30d': 'Last 30 days', '90d': 'Last 90 days', mtd: 'Month to date', ytd: 'Year to date',
};

function rangeToSince(range: ReportDateRange, lastSentAt: string | null): Date | null {
  const now = new Date();
  switch (range) {
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '30d': return new Date(now.getTime() - 30 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case 'mtd': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'ytd': return new Date(now.getFullYear(), 0, 1);
    case 'since_last_sent': return lastSentAt ? new Date(lastSentAt) : null;
    default: return null;
  }
}

interface Col { label: string; type: 'text' | 'currency' | 'number' | 'pct' | 'status'; width: number; }
interface ReportData { cols: Col[]; rows: (string | number | null)[][]; label: string; subtitle: string; sheetName: string; }

function withRangeSubtitle(subtitle: string, since: Date | null, rangeLabel: string): string {
  return since ? `${subtitle} — ${rangeLabel}` : subtitle;
}

// Ported from app/api/generate-report/route.ts's getReportData — same report
// types, same column layouts, just plain REST GETs instead of supabase-js
// (this function has no JS client dependency, only fetch). `since`/`rangeLabel`
// scope each report to a period; leads-based "flow" columns (new leads, won,
// conversion) and sale-date-based columns are period-scoped, while
// current-state snapshots (active premium, active policy counts) always
// reflect the current book regardless of range — a "this week" report still
// needs to show the real current active premium, not a zeroed-out slice.
async function fetchReportData(reportType: string, since: Date | null, rangeLabel: string): Promise<ReportData> {
  const sinceStr = since ? since.toISOString().slice(0, 10) : null;
  const sinceIso = since ? since.toISOString() : null;

  if (reportType === 'policy_register') {
    const filter = sinceStr ? `&sale_date=gte.${sinceStr}` : '';
    const data = await dbGet(`policies?select=policy_number,status,product_name,product_category,insurer,premium,base_premium,inception_date,sale_date,documentation_status,client_segment,clients(name),users(name)&order=inception_date.desc${filter}`);
    const rows = (data ?? []).map((p: Record<string, unknown>) => [
      String(p.policy_number ?? ''), String((p.clients as { name: string } | null)?.name ?? ''),
      String(p.product_category ?? ''), String(p.product_name ?? ''), String(p.insurer ?? ''),
      Number(p.premium ?? 0), Number(p.base_premium ?? 0),
      fmtDate(p.inception_date as string | null), fmtDate(p.sale_date as string | null),
      String(p.status ?? ''), String(p.documentation_status ?? ''), String(p.client_segment ?? ''),
      String((p.users as { name: string } | null)?.name ?? ''),
    ]);
    return {
      label: 'Policy Register', subtitle: withRangeSubtitle(sinceStr ? 'Policies sold' : 'All Policies', since, rangeLabel), sheetName: 'Policy Register',
      cols: [
        { label: 'Policy #', type: 'text', width: 14 }, { label: 'Client', type: 'text', width: 24 },
        { label: 'Category', type: 'text', width: 20 }, { label: 'Product', type: 'text', width: 24 },
        { label: 'Insurer', type: 'text', width: 16 }, { label: 'Premium', type: 'currency', width: 16 },
        { label: 'Base Premium', type: 'currency', width: 14 }, { label: 'Inception', type: 'text', width: 13 },
        { label: 'Sale Date', type: 'text', width: 13 }, { label: 'Status', type: 'status', width: 12 },
        { label: 'Docs', type: 'status', width: 11 }, { label: 'Segment', type: 'text', width: 12 },
        { label: 'Sold By', type: 'text', width: 18 },
      ],
      rows,
    };
  }

  if (reportType === 'agent_summary') {
    const leadFilter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
    const [users, policies, leads] = await Promise.all([
      dbGet('users?select=id,name,role&status=eq.Active&role=in.("Sales Agent","Team Leader")&order=name'),
      dbGet('policies?select=sold_by_user_id,status,premium'),
      dbGet(`leads?select=assigned_to_user_id,status,created_at${leadFilter}`),
    ]);
    const rows = (users ?? []).map((u: Record<string, unknown>) => {
      const al = (leads ?? []).filter((l: Record<string, unknown>) => l.assigned_to_user_id === u.id);
      const ap = (policies ?? []).filter((p: Record<string, unknown>) => p.sold_by_user_id === u.id);
      const active = ap.filter((p: Record<string, unknown>) => p.status === 'Active');
      const won = al.filter((l: Record<string, unknown>) => l.status === 'Won').length;
      const prem = active.reduce((s: number, p: Record<string, unknown>) => s + Number(p.premium ?? 0), 0);
      return [String(u.name), String(u.role), al.length, won, al.length > 0 ? Math.round((won / al.length) * 1000) / 10 : 0, ap.length, active.length, prem];
    });
    return {
      label: 'Agent Performance Summary',
      subtitle: withRangeSubtitle('Sales Unit — All Agents (Leads/Won scoped to range; Policies/Premium are the current book)', since, rangeLabel),
      sheetName: 'Agent Summary',
      cols: [
        { label: 'Agent', type: 'text', width: 24 }, { label: 'Role', type: 'text', width: 20 },
        { label: 'Total Leads', type: 'number', width: 12 }, { label: 'Won', type: 'number', width: 8 },
        { label: 'Conversion %', type: 'pct', width: 13 }, { label: 'Total Policies', type: 'number', width: 14 },
        { label: 'Active Policies', type: 'number', width: 14 }, { label: 'Active Premium', type: 'currency', width: 18 },
      ],
      rows,
    };
  }

  if (reportType === 'lead_pipeline') {
    const filter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
    const data = await dbGet(`leads?select=name,email,phone,status,source,segment,created_at,loss_reason,users!leads_assignedTo_fkey(name)&order=created_at.desc${filter}`);
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ''), (String(l.email ?? '')).includes('@placeholder.com') ? '' : String(l.email ?? ''),
      String(l.phone ?? ''), String(l.status ?? ''), String(l.source ?? ''), String(l.segment ?? ''),
      String((l.users as { name: string } | null)?.name ?? 'Unassigned'),
      fmtDate(l.created_at as string | null), String(l.loss_reason ?? ''),
    ]);
    return {
      label: 'Lead Pipeline', subtitle: withRangeSubtitle(sinceIso ? 'New Leads' : 'All Leads', since, rangeLabel), sheetName: 'Lead Pipeline',
      cols: [
        { label: 'Name', type: 'text', width: 22 }, { label: 'Email', type: 'text', width: 26 },
        { label: 'Phone', type: 'text', width: 14 }, { label: 'Status', type: 'status', width: 12 },
        { label: 'Source', type: 'text', width: 14 }, { label: 'Segment', type: 'text', width: 12 },
        { label: 'Assigned To', type: 'text', width: 18 }, { label: 'Date Added', type: 'text', width: 13 },
        { label: 'Loss Reason', type: 'text', width: 16 },
      ],
      rows,
    };
  }

  if (reportType === 'premium_by_insurer') {
    const data = await dbGet('policies?select=insurer,status,premium,product_category');
    const map: Record<string, { active: number; total: number; activePrem: number; cats: Set<string> }> = {};
    (data ?? []).forEach((p: Record<string, unknown>) => {
      const ins = String(p.insurer ?? 'Unknown');
      if (!map[ins]) map[ins] = { active: 0, total: 0, activePrem: 0, cats: new Set() };
      map[ins].total++;
      if (p.status === 'Active') { map[ins].active++; map[ins].activePrem += Number(p.premium ?? 0); }
      if (p.product_category) map[ins].cats.add(String(p.product_category));
    });
    const grand = Object.values(map).reduce((s, v) => s + v.activePrem, 0);
    const rows = Object.entries(map).sort((a, b) => b[1].activePrem - a[1].activePrem)
      .map(([ins, v]) => [ins, v.active, v.total, v.activePrem, grand > 0 ? Math.round((v.activePrem / grand) * 1000) / 10 : 0, Array.from(v.cats).join(', ')]);
    return {
      // Always the current book — a "premium by insurer" snapshot filtered to
      // one week would mostly be empty/misleading, so date_range is ignored here.
      label: 'Premium by Insurer', subtitle: 'Active Premium Distribution (current book, not affected by date range)', sheetName: 'Premium by Insurer',
      cols: [
        { label: 'Insurer', type: 'text', width: 20 }, { label: 'Active Policies', type: 'number', width: 14 },
        { label: 'Total Policies', type: 'number', width: 13 }, { label: 'Active Premium', type: 'currency', width: 18 },
        { label: 'Market Share %', type: 'pct', width: 14 }, { label: 'Categories', type: 'text', width: 30 },
      ],
      rows,
    };
  }

  if (reportType === 'retention_summary') {
    const raw = await dbGet('policies?select=policy_number,status,premium,insurer,product_name,retention_details,cancellation_date,clients(name)&status=in.(Retained,Canceled,Expired)&order=status');
    // No single "when did this happen" column exists across Retained/Canceled/
    // Expired, so the best available event date is retainedAt (if retained) or
    // cancellation_date (if canceled/expired) — filtered client-side since it's
    // not a plain column.
    const eventDate = (p: Record<string, unknown>): string | null => {
      const rd = p.retention_details as Record<string, string> | null;
      return rd?.retainedAt ?? (p.cancellation_date as string | null) ?? null;
    };
    const data = ((raw ?? []) as Record<string, unknown>[]).filter((p) => {
      if (!sinceIso) return true;
      const d = eventDate(p);
      if (d === null) return false;
      // cancellation_date is a plain date (10 chars); normalize to start-of-day
      // so it compares correctly against the full ISO sinceIso timestamp.
      const dIso = d.length === 10 ? `${d}T00:00:00.000Z` : d;
      return dIso >= sinceIso;
    });
    const rows = data.map((p: Record<string, unknown>) => {
      const rd = p.retention_details as Record<string, string> | null;
      return [
        String(p.policy_number ?? ''), String((p.clients as { name: string } | null)?.name ?? ''),
        String(p.product_name ?? ''), String(p.insurer ?? ''), Number(p.premium ?? 0),
        String(p.status ?? ''), rd?.retainedAt ? fmtDate(rd.retainedAt) : '',
        rd?.previousPolicyNumber ?? '', rd?.previousPremium ? Number(rd.previousPremium) : 0,
      ];
    });
    return {
      label: 'Retention Summary', subtitle: withRangeSubtitle('Canceled, Expired & Retained', since, rangeLabel), sheetName: 'Retention Summary',
      cols: [
        { label: 'Policy #', type: 'text', width: 14 }, { label: 'Client', type: 'text', width: 24 },
        { label: 'Product', type: 'text', width: 24 }, { label: 'Insurer', type: 'text', width: 16 },
        { label: 'Premium', type: 'currency', width: 16 }, { label: 'Status', type: 'status', width: 12 },
        { label: 'Retained On', type: 'text', width: 14 }, { label: 'Prev Policy #', type: 'text', width: 14 },
        { label: 'Prev Premium', type: 'currency', width: 16 },
      ],
      rows,
    };
  }

  if (reportType === 'concierge_pipeline') {
    const filter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
    const data = await dbGet(`leads?select=name,phone,source,unit_status,vehicle_make,vehicle_model,vehicle_year,vehicle_price,created_at,users!leads_assignedTo_fkey(name)&business_unit_id=eq.${CONCIERGE_UNIT_ID}&order=created_at.desc${filter}`);
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ''), String(l.phone ?? ''), String(l.source ?? ''), String(l.unit_status ?? ''),
      String([l.vehicle_make, l.vehicle_model, l.vehicle_year].filter(Boolean).join(' ') || '—'),
      l.vehicle_price ? Number(l.vehicle_price) : 0,
      String((l.users as { name: string } | null)?.name ?? 'Unassigned'), fmtDate(l.created_at as string | null),
    ]);
    return {
      label: 'Concierge Pipeline', subtitle: withRangeSubtitle('Vehicle Acquisition', since, rangeLabel), sheetName: 'Concierge Pipeline',
      cols: [
        { label: 'Name', type: 'text', width: 22 }, { label: 'Phone', type: 'text', width: 14 },
        { label: 'Source', type: 'text', width: 12 }, { label: 'Status', type: 'status', width: 14 },
        { label: 'Vehicle', type: 'text', width: 26 }, { label: 'Budget', type: 'currency', width: 16 },
        { label: 'Assigned To', type: 'text', width: 18 }, { label: 'Date Added', type: 'text', width: 13 },
      ],
      rows,
    };
  }

  if (reportType === 'credit_health_pipeline') {
    const filter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
    const data = await dbGet(`leads?select=name,phone,source,unit_status,employment_status,monthly_income,loan_amount,credit_score,created_at,users!leads_assignedTo_fkey(name)&business_unit_id=eq.${CREDIT_HEALTH_UNIT_ID}&order=created_at.desc${filter}`);
    const rows = (data ?? []).map((l: Record<string, unknown>) => [
      String(l.name ?? ''), String(l.phone ?? ''), String(l.source ?? ''), String(l.unit_status ?? ''),
      String(l.employment_status ?? ''), l.monthly_income ? Number(l.monthly_income) : 0,
      l.loan_amount ? Number(l.loan_amount) : 0, String(l.credit_score ?? ''),
      String((l.users as { name: string } | null)?.name ?? 'Unassigned'), fmtDate(l.created_at as string | null),
    ]);
    return {
      label: 'Credit Health Pipeline', subtitle: withRangeSubtitle('Credit Advisory', since, rangeLabel), sheetName: 'Credit Health',
      cols: [
        { label: 'Name', type: 'text', width: 22 }, { label: 'Phone', type: 'text', width: 14 },
        { label: 'Source', type: 'text', width: 12 }, { label: 'Status', type: 'status', width: 14 },
        { label: 'Employment', type: 'text', width: 14 }, { label: 'Monthly Income', type: 'currency', width: 16 },
        { label: 'Loan Amount', type: 'currency', width: 14 }, { label: 'Credit Score', type: 'text', width: 12 },
        { label: 'Assigned To', type: 'text', width: 18 }, { label: 'Date Added', type: 'text', width: 13 },
      ],
      rows,
    };
  }

  if (reportType === 'business_unit_comparison') {
    const isSales = (bu: unknown) => !bu || bu === SALES_UNIT_ID;
    const leadFilter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
    const [leads, policies] = await Promise.all([
      dbGet(`leads?select=business_unit_id,status,unit_status,created_at${leadFilter}`),
      dbGet('policies?select=status,premium'),
    ]);
    const salesLeads = (leads ?? []).filter((l: Record<string, unknown>) => isSales(l.business_unit_id));
    const conciergeLeads = (leads ?? []).filter((l: Record<string, unknown>) => l.business_unit_id === CONCIERGE_UNIT_ID);
    const creditLeads = (leads ?? []).filter((l: Record<string, unknown>) => l.business_unit_id === CREDIT_HEALTH_UNIT_ID);
    const activePolicies = (policies ?? []).filter((p: Record<string, unknown>) => p.status === 'Active');
    const activePremium = activePolicies.reduce((s: number, p: Record<string, unknown>) => s + Number(p.premium ?? 0), 0);
    const won = (arr: Record<string, unknown>[], field: string, value: string) => arr.filter((l) => l[field] === value).length;
    const rows: (string | number)[][] = [
      ['Sales', salesLeads.length, won(salesLeads, 'status', 'Won'), salesLeads.length > 0 ? Math.round((won(salesLeads, 'status', 'Won') / salesLeads.length) * 1000) / 10 : 0, activePolicies.length, Math.round(activePremium * 100) / 100],
      ['Concierge', conciergeLeads.length, won(conciergeLeads, 'unit_status', 'Won'), conciergeLeads.length > 0 ? Math.round((won(conciergeLeads, 'unit_status', 'Won') / conciergeLeads.length) * 1000) / 10 : 0, 0, 0],
      ['Credit Health', creditLeads.length, won(creditLeads, 'unit_status', 'Approved'), creditLeads.length > 0 ? Math.round((won(creditLeads, 'unit_status', 'Approved') / creditLeads.length) * 1000) / 10 : 0, 0, 0],
    ];
    return {
      label: 'Business Unit Comparison',
      subtitle: withRangeSubtitle('All Divisions (Leads/Won scoped to range; Policies/Premium are the current book)', since, rangeLabel),
      sheetName: 'Business Units',
      cols: [
        { label: 'Division', type: 'text', width: 18 }, { label: 'Total Leads', type: 'number', width: 13 },
        { label: 'Won', type: 'number', width: 8 }, { label: 'Conversion %', type: 'pct', width: 13 },
        { label: 'Active Policies', type: 'number', width: 14 }, { label: 'Active Premium', type: 'currency', width: 16 },
      ],
      rows,
    };
  }

  // Fallback: conversion by source
  const srcFilter = sinceIso ? `&created_at=gte.${sinceIso}` : '';
  const data = await dbGet(`leads?select=source,status${srcFilter}`);
  const srcMap: Record<string, { total: number; won: number }> = {};
  (data ?? []).forEach((l: Record<string, unknown>) => {
    const s = String(l.source ?? 'Unknown');
    if (!srcMap[s]) srcMap[s] = { total: 0, won: 0 };
    srcMap[s].total++;
    if (l.status === 'Won') srcMap[s].won++;
  });
  const rows = Object.entries(srcMap).sort((a, b) => b[1].total - a[1].total)
    .map(([source, v]) => [source, v.total, v.won, v.total > 0 ? Math.round((v.won / v.total) * 1000) / 10 : 0]);
  return {
    label: 'Conversion by Source', subtitle: withRangeSubtitle('Lead Funnel Analysis', since, rangeLabel), sheetName: 'Conversion by Source',
    cols: [
      { label: 'Source', type: 'text', width: 18 }, { label: 'Total Leads', type: 'number', width: 12 },
      { label: 'Won', type: 'number', width: 8 }, { label: 'Win Rate %', type: 'pct', width: 11 },
    ],
    rows,
  };
}

const NXLSX='FF1A348C',BXLSX='FF0058A3',LBLUE='FFCCE0F5',WHITE='FFFFFFFF',DARK='FF111827',GBORD='FFE5E7EB';
const STATUS_COLOURS: Record<string,{bg:string;fg:string}> = {
  Active:{bg:'FFEAF3DE',fg:'FF27500A'},Won:{bg:'FFEAF3DE',fg:'FF27500A'},Retained:{bg:'FFEAF3DE',fg:'FF27500A'},
  Complete:{bg:'FFEAF3DE',fg:'FF27500A'},Pending:{bg:'FFFAEEDA',fg:'FF633806'},Contacted:{bg:'FFFAEEDA',fg:'FF633806'},
  Quoted:{bg:'FFEEF4FD',fg:'FF1A348C'},Prospect:{bg:'FFE6F1FB',fg:'FF0C447C'},
  Lost:{bg:'FFFCEBEB',fg:'FF791F1F'},Canceled:{bg:'FFFCEBEB',fg:'FF791F1F'},Cancelled:{bg:'FFFCEBEB',fg:'FF791F1F'},Expired:{bg:'FFFCEBEB',fg:'FF791F1F'},
};
function xe(s:string){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cn(n:number){let s='';for(let c=n;c>=0;c=Math.floor(c/26)-1)s=String.fromCharCode(65+(c%26))+s;return s;}
function buildXlsx(sheetName:string,title:string,subtitle:string,cols:Col[],rows:(string|number|null)[][]):Uint8Array{
  const NC=cols.length,dateStr=new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const fill=(a:string)=>`<fill><patternFill patternType="solid"><fgColor rgb="${a}"/></patternFill></fill>`;
  const font=(a:string,sz:number,b:boolean,i=false)=>`<font>${b?'<b/>':''}${i?'<i/>':''}<sz val="${sz}"/><color rgb="${a}"/><name val="Calibri"/></font>`;
  const bdr=(st:string,a:string)=>{const b=`<color rgb="${a}"/>`;return `<border><left style="${st}">${b}</left><right style="${st}">${b}</right><top style="${st}">${b}</top><bottom style="${st}">${b}</bottom><diagonal/></border>`;};
  const al=(h:string,v='center',w=false)=>`<alignment horizontal="${h}" vertical="${v}"${w?' wrapText="1"':''}/>`;
  const xf=(fi:number,fli:number,bi:number,axml:string,nf=0,an=false)=>`<xf numFmtId="${nf}" fontId="${fi}" fillId="${fli}" borderId="${bi}" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${an?' applyNumberFormat="1"':''}>${axml}</xf>`;
  const fonts=[font(DARK,10,false),font(WHITE,14,true),font(WHITE,9,false,true),font(WHITE,10,true),font(DARK,10,true),font('FF9CA3AF',8,false,true)].join('');
  const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',fill(NXLSX),fill(BXLSX),fill(LBLUE),fill(WHITE)];
  const sfIds:Record<string,number>={};let fi=fills.length;
  for(const[s,c]of Object.entries(STATUS_COLOURS)){fills.push(fill(c.bg));sfIds[s]=fi++;}
  const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>',bdr('thin',GBORD),bdr('medium',NXLSX)];
  const numFmts=['<numFmt numFmtId="164" formatCode="&quot;R &quot;#,##0.00"/>','<numFmt numFmtId="165" formatCode="#,##0"/>','<numFmt numFmtId="166" formatCode="0.0&quot;%&quot;"/>'];
  const xfs=[xf(0,5,0,al('left')),xf(1,2,0,al('left')),xf(2,3,0,al('left')),xf(0,2,0,al('center')),xf(3,2,0,al('center')),xf(0,5,1,al('left')),xf(0,5,1,al('right'),164,true),xf(0,5,1,al('right'),165,true),xf(0,5,1,al('right'),166,true),xf(4,4,2,al('left')),xf(4,4,2,al('right'),164,true),xf(4,4,2,al('right'),165,true),xf(5,5,0,al('left'))];
  const sxIds:Record<string,number>={};let xi=xfs.length;
  for(const[s,c]of Object.entries(STATUS_COLOURS)){sxIds[s]=xi;xfs.push(xf(0,sfIds[s],1,al('center')));xi++;}
  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts><fonts count="6">${fonts}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="3">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs></styleSheet>`;
  const strs:string[]=[],si_map=new Map<string,number>();
  function si(s:string){const k=String(s??'');if(!si_map.has(k)){si_map.set(k,strs.length);strs.push(k);}return si_map.get(k)!;}
  function sc(r:number,c:number,v:string,s:number){return `<c r="${cn(c)}${r+1}" t="s" s="${s}"><v>${si(v)}</v></c>`;}
  function nc(r:number,c:number,v:number,s:number){return `<c r="${cn(c)}${r+1}" t="n" s="${s}"><v>${v}</v></c>`;}
  function bc(r:number,c:number,s:number){return `<c r="${cn(c)}${r+1}" s="${s}"/>`;}
  const cellRows:string[]=[],merges:string[][]=[];
  for(let lr=0;lr<3;lr++){cellRows.push(`<row r="${lr+1}" ht="18" customHeight="1">${Array.from({length:NC},(_,c)=>bc(lr,c,3)).join('')}</row>`);}
  merges.push([`<mergeCell ref="A1:${cn(NC-1)}3"/>`] as unknown as string[]);let R=3;
  const tt=`MMELA FINANCIAL SERVICES (PTY) LTD   ·   ${title.toUpperCase()}`;
  cellRows.push(`<row r="${R+1}" ht="32" customHeight="1">${[sc(R,0,tt,1),...Array.from({length:NC-1},(_,c)=>bc(R,c+1,1))].join('')}</row>`);merges.push([`<mergeCell ref="A${R+1}:${cn(NC-1)}${R+1}"/>`] as unknown as string[]);R++;
  const sub=`${subtitle}   ·   Generated: ${dateStr}   ·   ${rows.length} records`;
  cellRows.push(`<row r="${R+1}" ht="18" customHeight="1">${[sc(R,0,sub,2),...Array.from({length:NC-1},(_,c)=>bc(R,c+1,2))].join('')}</row>`);merges.push([`<mergeCell ref="A${R+1}:${cn(NC-1)}${R+1}"/>`] as unknown as string[]);R++;
  cellRows.push(`<row r="${R+1}" ht="4" customHeight="1">${Array.from({length:NC},(_,c)=>bc(R,c,4)).join('')}</row>`);merges.push([`<mergeCell ref="A${R+1}:${cn(NC-1)}${R+1}"/>`] as unknown as string[]);R++;
  const HDR=R;cellRows.push(`<row r="${R+1}" ht="24" customHeight="1">${cols.map((col,c)=>sc(R,c,col.label,4)).join('')}</row>`);R++;
  rows.forEach(row=>{const cells=row.map((v,c)=>{const t=cols[c].type;if(t==='currency'&&typeof v==='number')return nc(R,c,v,6);if(t==='number'&&typeof v==='number')return nc(R,c,v,7);if(t==='pct'&&typeof v==='number')return nc(R,c,v,8);if(t==='status'&&typeof v==='string'&&sxIds[v]!==undefined)return sc(R,c,v,sxIds[v]);if(typeof v==='number')return nc(R,c,v,5);return sc(R,c,String(v??''),5);});cellRows.push(`<row r="${R+1}">${cells.join('')}</row>`);R++;});
  if(cols.some(c=>c.type==='currency'||c.type==='number')){const cells=cols.map((col,c)=>{if(c===0)return sc(R,c,'TOTAL',9);if(col.type==='currency'){const tot=rows.reduce((s,r)=>s+(typeof r[c]==='number'?(r[c] as number):0),0);return nc(R,c,tot,10);}if(col.type==='number'){const tot=rows.reduce((s,r)=>s+(typeof r[c]==='number'?(r[c] as number):0),0);return nc(R,c,tot,11);}return bc(R,c,9);});cellRows.push(`<row r="${R+1}" ht="20" customHeight="1">${cells.join('')}</row>`);R++;}
  R++;const fc=[sc(R,0,'Mmela Financial Services (Pty) Ltd   ·   Confidential — for internal use only',12),...Array.from({length:NC-1},(_,c)=>bc(R,c+1,12))];
  cellRows.push(`<row r="${R+1}">${fc.join('')}</row>`);merges.push([`<mergeCell ref="A${R+1}:${cn(NC-1)}${R+1}"/>`] as unknown as string[]);
  const allMerges=merges.map((m:unknown[])=>m[0]).join('');
  const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${HDR+1}" topLeftCell="A${HDR+2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols.map(c=>`<col min="1" max="1" width="${c.width}" customWidth="1"/>`).join('')}</cols><sheetData>${cellRows.join('')}</sheetData><mergeCells count="${merges.length}">${allMerges}</mergeCells></worksheet>`;
  const ssXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strs.length}" uniqueCount="${strs.length}">${strs.map(s=>`<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`;
  const wbXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xe(sheetName.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  function crc32(d:Uint8Array){const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}let crc=0xFFFFFFFF;for(const b of d)crc=t[(crc^b)&0xFF]^(crc>>>8);return(crc^0xFFFFFFFF)>>>0;}
  const te=new TextEncoder();
  function entry(name:string,data:Uint8Array){const nb=te.encode(name),crc=crc32(data),l=new Uint8Array(30+nb.length+data.length),dv=new DataView(l.buffer);dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0,true);dv.setUint16(8,0,true);dv.setUint16(10,0,true);dv.setUint16(12,0,true);dv.setUint32(14,crc,true);dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);dv.setUint16(26,nb.length,true);dv.setUint16(28,0,true);l.set(nb,30);l.set(data,30+nb.length);return l;}
  const zipFiles=[{name:'[Content_Types].xml',data:te.encode(ct)},{name:'_rels/.rels',data:te.encode(rootRels)},{name:'xl/workbook.xml',data:te.encode(wbXml)},{name:'xl/_rels/workbook.xml.rels',data:te.encode(wbRels)},{name:'xl/worksheets/sheet1.xml',data:te.encode(sheetXml)},{name:'xl/sharedStrings.xml',data:te.encode(ssXml)},{name:'xl/styles.xml',data:te.encode(stylesXml)}];
  const lp:Uint8Array[]=[],cdArr:Uint8Array[]=[];let off=0;
  for(const f of zipFiles){const nb=te.encode(f.name),crc=crc32(f.data),loc=entry(f.name,f.data);lp.push(loc);const c=new Uint8Array(46+nb.length),dv=new DataView(c.buffer);dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0,true);dv.setUint16(10,0,true);dv.setUint16(12,0,true);dv.setUint16(14,0,true);dv.setUint32(16,crc,true);dv.setUint32(20,f.data.length,true);dv.setUint32(24,f.data.length,true);dv.setUint16(28,nb.length,true);dv.setUint16(30,0,true);dv.setUint16(32,0,true);dv.setUint16(34,0,true);dv.setUint16(36,0,true);dv.setUint32(38,0,true);dv.setUint32(42,off,true);c.set(nb,46);cdArr.push(c);off+=loc.length;}
  const cdSize=cdArr.reduce((s,c)=>s+c.length,0),eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,zipFiles.length,true);ev.setUint16(10,zipFiles.length,true);ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);ev.setUint16(20,0,true);
  const parts=[...lp,...cdArr,eocd],total=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(total);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;
}

function emailHtml(label:string,msg:string|null,date:string,count:number,isTest:boolean):string{
  const testBadge=isTest?`<div style="background:#FAEEDA;border:1px solid #F5A623;border-radius:6px;padding:10px 14px;margin-bottom:20px;"><p style="font-size:13px;color:#854F0B;margin:0;font-weight:600;">&#9888; TEST RUN &#8212; this is a test delivery, not a scheduled send</p></div>`:'';
  const msgBlock=msg?`<div style="background:#F8F9FB;border-left:3px solid ${NAVY};border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:20px;"><p style="font-size:13px;color:#374151;margin:0;white-space:pre-line;">${msg}</p></div>`:'';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#EEF2F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px 40px;"><table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,52,140,0.13);"><tr><td style="background:${NAVY};padding:28px 32px 0;text-align:center;"><img src="${LOGO}" width="100" alt="Mmela Financial Services" style="display:block;margin:0 auto 20px;max-width:100px;height:auto;"/><div style="line-height:0;font-size:0;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 40" width="480" height="40" preserveAspectRatio="none" style="display:block;"><path d="M0,20 C80,40 160,0 240,20 C320,40 400,0 480,20 L480,40 L0,40 Z" fill="${BLUE}" opacity="0.4"/><path d="M0,28 C80,8 160,40 240,28 C320,16 400,40 480,28 L480,40 L0,40 Z" fill="#FFFFFF"/></svg></div></td></tr><tr><td style="background:#FFFFFF;padding:28px 36px 24px;">${testBadge}<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.3px;">Report Ready</h1><div style="width:40px;height:3px;background:${NAVY};border-radius:2px;margin-bottom:20px;"></div><div style="background:#F8F9FB;border:1px solid #E5E7EB;border-left:4px solid ${NAVY};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:18px;"><p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111827;">${label}</p><p style="margin:0;font-size:13px;color:#6B7280;">${count} records &nbsp;&middot;&nbsp; ${date}</p></div><p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.7;">Your scheduled report is attached as a formatted Excel file (.xlsx). Open it in Microsoft Excel or Google Sheets.</p>${msgBlock}<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border-top:1px solid #F1F3F5;height:1px;font-size:0;">&nbsp;</td></tr></table><p style="margin:0;font-size:12px;color:#9CA3AF;">This report was generated automatically by Mmela Hub. Do not reply.</p></td></tr><tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 36px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" align="center" style="border-right:1px solid #E5E7EB;padding:2px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 5px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg><p style="margin:0;font-size:11px;color:#6B7280;">Secure</p></td><td width="33%" align="center" style="border-right:1px solid #E5E7EB;padding:2px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 5px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg><p style="margin:0;font-size:11px;color:#6B7280;">Trusted</p></td><td width="33%" align="center" style="padding:2px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 5px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><p style="margin:0;font-size:11px;color:#6B7280;">People First</p></td></tr></table></td></tr><tr><td style="background:#FFFFFF;border-top:1px solid #E5E7EB;padding:14px 36px;text-align:center;"><p style="margin:0 0 3px;font-size:12px;color:#374151;font-weight:500;">Mmela Financial Services (Pty) Ltd</p><p style="margin:0;font-size:12px;color:${NAVY};font-weight:600;">FSP 20557</p></td></tr><tr><td style="background:${NAVY};height:5px;font-size:0;">&nbsp;</td></tr></table></td></tr></table></body></html>`;
}

serve(async (req) => {
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  try{
    const authHeader=req.headers.get('Authorization')??'';
    const internalSecret=req.headers.get('x-internal-secret')??'';
    const isInternal=internalSecret===INTERNAL_SECRET&&INTERNAL_SECRET.length>10;
    if(!isInternal){
      const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{'apikey':Deno.env.get('SUPABASE_ANON_KEY')??'','Authorization':authHeader}});
      const userData=await userRes.json();
      if(!userData?.id)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
      const profileRes=await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userData.id}&select=role&limit=1`,{headers:{'apikey':SERVICE_KEY,'Authorization':`Bearer ${SERVICE_KEY}`}});
      const profiles=await profileRes.json();
      if(!profiles?.[0]||profiles[0].role!=='Admin')return new Response(JSON.stringify({error:'Admin only'}),{status:403,headers:{...cors,'Content-Type':'application/json'}});
    }
    const body=await req.json();
    const{mailing_id,test_email}=body;
    const isTest=!!test_email;
    const mailingRes=await fetch(`${SUPABASE_URL}/rest/v1/report_mailings?id=eq.${mailing_id}&limit=1`,{headers:{'apikey':SERVICE_KEY,'Authorization':`Bearer ${SERVICE_KEY}`}});
    const mailings=await mailingRes.json();
    if(!mailings?.[0])return new Response(JSON.stringify({error:'Mailing not found'}),{status:404,headers:{...cors,'Content-Type':'application/json'}});
    const mailing=mailings[0];
    const range:ReportDateRange=(mailing.date_range as ReportDateRange)??'all';
    const since=rangeToSince(range,mailing.last_sent_at??null);
    const rangeLabel=RANGE_LABELS[range]??'All data';
    const{cols,rows,label:reportLabel,sheetName,subtitle}=await fetchReportData(mailing.report_type,since,rangeLabel);
    const dateStr=new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});
    const filename=`mmela-${mailing.report_type.replace(/_/g,'-')}-${new Date().toISOString().slice(0,10)}.xlsx`;
    const subject=mailing.subject||`${reportLabel} — ${dateStr}`;
    const xlsxBytes=buildXlsx(sheetName,reportLabel,subtitle,cols,rows);
    const xlsxBase64=encodeBase64(xlsxBytes);
    const html=emailHtml(reportLabel,mailing.message??null,dateStr,rows.length,isTest);
    const recipients:string[]=isTest?[test_email]:(mailing.recipients as string[]);
    let sent=0,failed=0;const errors:string[]=[];
    for(const to of recipients){
      const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${RESEND_KEY}`},body:JSON.stringify({from:FROM,to,subject:isTest?`[TEST] ${subject}`:subject,html,attachments:[{filename,content:xlsxBase64}]}),});
      if(res.ok){sent++;}else{failed++;const err=await res.text();errors.push(err);console.error('Resend:',err);}
    }
    // Only record a successful send if at least one recipient actually
    // received the email — stamping this unconditionally (as the old
    // version did) made a total delivery failure look identical to
    // success in the UI.
    if(!isTest&&sent>0)await fetch(`${SUPABASE_URL}/rest/v1/report_mailings?id=eq.${mailing_id}`,{method:'PATCH',headers:{'apikey':SERVICE_KEY,'Authorization':`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({last_sent_at:new Date().toISOString()})});
    if(!isTest&&sent===0&&recipients.length>0){
      console.error(`send-report: mailing ${mailing_id} — all ${recipients.length} recipient(s) failed`,errors);
      return new Response(JSON.stringify({ok:false,sent,failed,errors,rows:rows.length,format:'xlsx',test:isTest}),{status:502,headers:{...cors,'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({ok:true,sent,failed,errors,rows:rows.length,format:'xlsx',test:isTest}),{headers:{...cors,'Content-Type':'application/json'}});
  }catch(err){
    console.error('send-report error:',err);
    return new Response(JSON.stringify({error:String(err)}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
  }
});
