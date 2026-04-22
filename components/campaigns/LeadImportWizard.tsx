"use client";

import React, { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { checkDuplicateLeads } from "@/lib/sales-api";
import { normaliseContact } from "@/lib/normalise";
import { Upload, ChevronRight, ChevronLeft, Check, X, AlertCircle, Download } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface ImportRow { [key: string]: string; }

interface MappedRow {
  name?: string;
  email?: string;
  phone?: string;
  segment?: string;
  source?: string;
  status?: string;
  notes?: string;
  referred_by?: string;
  id_number?: string;
  date_of_birth?: string;
  product_interest?: string;
  raw: ImportRow;
  error?: string;
  duplicate?: boolean;
}

interface BusinessUnit { id: string; name: string; slug: string; }

const SYSTEM_FIELDS = [
  { key: "name",            label: "Full name *",                    required: true },
  { key: "email",           label: "Email address",                  required: false },
  { key: "phone",           label: "Phone number",                   required: false },
  { key: "segment",         label: "Segment (Individual/Commercial)", required: false },
  { key: "source",          label: "Lead source",                    required: false },
  { key: "referred_by",     label: "Referred by",                    required: false },
  { key: "id_number",       label: "ID number",                      required: false },
  { key: "date_of_birth",   label: "Date of birth",                  required: false },
  { key: "product_interest",label: "Product interest",               required: false },
  { key: "notes",           label: "Notes / additional info",        required: false },
  { key: "__skip",          label: "— Skip this column —",           required: false },
];

const STEP_LABELS = ["Upload file", "Map fields", "Review", "Import"];

// ── Utilities ─────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: ImportRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: ImportRow = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    if (Object.values(row).some(v => v)) rows.push(row);
  }
  return { headers, rows };
}

async function parseXLSX(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: ImportRow[] }> {
  // Dynamically load SheetJS from CDN
  if (!(window as unknown as { XLSX: unknown }).XLSX) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.setAttribute("data-xlsx", "true");
      s.onload = () => res(); s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const XLSX = (window as unknown as { XLSX: { read: Function; utils: { sheet_to_json: Function } } }).XLSX;
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (data.length < 2) return { headers: [], rows: [] };
  const headers = (data[0] as string[]).map(h => String(h).trim());
  const rows: ImportRow[] = data.slice(1).map((row: string[]) => {
    const obj: ImportRow = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  headers.forEach(h => {
    const hl = h.toLowerCase().replace(/[_\s-]/g, "");
    if (/^(fullname|name)/.test(hl) && !map.name) map[h] = "name";
    else if (/email/.test(hl) && !map.email) map[h] = "email";
    else if (/phone|cell|mobile|contact/.test(hl) && !map.phone) map[h] = "phone";
    else if (/segment|type/.test(hl) && !map.segment) map[h] = "segment";
    else if (/source|channel/.test(hl) && !map.source) map[h] = "source";
    else if (/refer/.test(hl) && !map.referred_by) map[h] = "referred_by";
    else if (/(id.?number|idno|rsa.?id|identity)/.test(hl) && !map.id_number) map[h] = "id_number";
    else if (/(dob|dateofbirth|birthdate|birth)/.test(hl) && !map.date_of_birth) map[h] = "date_of_birth";
    else if (/(product|interest|cover|policy.?type)/.test(hl) && !map.product_interest) map[h] = "product_interest";
    else if (/note|comment|message|additional/.test(hl) && !map.notes) map[h] = "notes";
    else map[h] = "__skip";
  });
  return map;
}

function validateRow(row: ImportRow, mapping: Record<string, string>): MappedRow {
  const mapped: MappedRow = { raw: row };
  let nameFound = false;

  Object.entries(mapping).forEach(([col, field]) => {
    if (field === "__skip") return;
    const val = row[col]?.trim();
    if (field === "name") { (mapped as unknown as Record<string, unknown>)[field] = val; if (val) nameFound = true; }
    else if (val) (mapped as unknown as Record<string, unknown>)[field] = val;
  });

  if (!nameFound || !mapped.name) mapped.error = "Name is required";
  else if (mapped.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) mapped.error = "Invalid email format";
  return mapped;
}

// ── Main component ─────────────────────────────────────────────

export default function LeadImportWizard({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [source, setSource] = useState("Import");
  const [segment, setSegment] = useState("Individual");
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false); // DB duplicate check in progress
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    Promise.all([
      supabase.from("business_units").select("id, name, slug").order("name"),
      supabase.from("campaigns").select("id, name").eq("is_active", true).order("name"),
    ]).then(([ur, cr]) => {
      setUnits((ur.data as BusinessUnit[]) ?? []);
      setCampaigns((cr.data as { id: string; name: string }[]) ?? []);
    });
  }, []);

  async function handleFile(f: File) {
    setFile(f);
    let parsed: { headers: string[]; rows: ImportRow[] };
    if (f.name.endsWith(".csv")) {
      const text = await f.text();
      parsed = parseCSV(text);
    } else {
      const buf = await f.arrayBuffer();
      parsed = await parseXLSX(buf);
    }
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    setMapping(autoMap(parsed.headers));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function buildMappedRows() {
    setChecking(true);
    // Map and validate locally first
    const rows = rawRows.map(r => validateRow(r, mapping));

    // Batch DB duplicate check — check each unique phone/email against the DB
    const checked = await Promise.all(rows.map(async (row) => {
      if (row.error) return row; // Already has a validation error
      const dupes = await checkDuplicateLeads(row.phone, row.email);
      if (dupes.length > 0) {
        return {
          ...row,
          duplicate: true,
          error: `Already exists — ${dupes[0].name} (${dupes[0].status}${dupes[0].assigned_to ? `, ${dupes[0].assigned_to}` : ""})`,
        };
      }
      return row;
    }));

    setMappedRows(checked);
    setChecking(false);
    setStep(2);
  }

  async function runImport() {
    setImporting(true);
    const toImport = mappedRows.filter(r => !r.error && !r.duplicate);
    let imported = 0, errors = 0;

    for (const row of toImport) {
      // Build notes combining all extra fields
      const noteParts: string[] = [];
      if (row.notes) noteParts.push(row.notes);
      if (row.product_interest) noteParts.push(`Product Interest: ${row.product_interest}`);
      if (row.id_number) noteParts.push(`ID Number: ${row.id_number}`);
      if (row.date_of_birth) noteParts.push(`Date of Birth: ${row.date_of_birth}`);

      const { error } = await supabase.from("leads").insert({
        name: row.name,
        email: row.email || `no-email-${Date.now()}-${Math.random().toString(36).slice(2)}@placeholder.com`,
        phone: row.phone || null,
        segment: row.segment || segment,
        source: row.source || source,
        referred_by: row.referred_by || null,
        notes: noteParts.join("\n") || null,
        status: "Prospect",
        source_type: "import",
        business_unit_id: selectedUnit || null,
        campaign_id: selectedCampaign || null,
        assigned_to_user_id: null,
        // Store full raw row as captured_data so nothing is lost
        captured_data: Object.keys(row.raw).length > 0 ? row.raw : null,
      });
      if (error) errors++; else imported++;
    }

    setResult({ imported, skipped: mappedRows.filter(r => r.error || r.duplicate).length, errors });
    setStep(3);
    setImporting(false);
  }

  const valid = mappedRows.filter(r => !r.error && !r.duplicate);
  const invalid = mappedRows.filter(r => r.error || r.duplicate);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: "#fff", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #E5E7EB" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button className="btn btn-ghost p-1 text-gray-400 hover:text-gray-700" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-semibold text-gray-900">Import leads</h2>
              </div>
              <p className="text-xs text-gray-400 ml-7">Import from CSV or Excel. We'll map your columns, validate and preview before anything is saved.</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-0 mb-5">
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: i < step ? "#EAF3DE" : i === step ? "#1A348C" : "#F1F3F5", color: i < step ? "#27500A" : i === step ? "#fff" : "#9CA3AF" }}>
                    {i < step ? <Check style={{ width: 12, height: 12 }} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium" style={{ color: i === step ? "#111827" : "#9CA3AF" }}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: 1, background: "#E5E7EB", margin: "0 8px" }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ height: 1, background: "#E5E7EB" }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "#1A348C" : file ? "#0F6E56" : "#E5E7EB"}`,
                  borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer",
                  background: dragOver ? "#EEF4FD" : file ? "#EAF3DE" : "#F8F9FB", transition: "all 0.2s",
                }}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {file ? (
                  <>
                    <Check className="w-8 h-8 mx-auto mb-2" style={{ color: "#27500A" }} />
                    <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{rawRows.length} rows detected · Click to change file</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-700">Drop your file here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Supports CSV, Excel (.xlsx, .xls)</p>
                  </>
                )}
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Business unit *</label>
                  <select className="input-field" value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
                    <option value="">Select unit…</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Which unit should these leads go to?</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Campaign (optional)</label>
                  <select className="input-field" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                    <option value="">No campaign</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Default source</label>
                  <select className="input-field" value={source} onChange={e => setSource(e.target.value)}>
                    {["Import","Campaign","Referral","Incoming Call","Manual","Website","Other"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Used for rows without a source column</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Default segment</label>
                  <select className="input-field" value={segment} onChange={e => setSegment(e.target.value)}>
                    <option value="Individual">Individual</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Used for rows without a segment column</p>
                </div>
              </div>

              {/* Template download */}
              <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">Need a template?</p>
                  <p className="text-xs text-gray-400">Download a CSV template with all supported columns.</p>
                </div>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => {
                    const rows = [
                      // Headers
                      "Full name,Email address,Phone number,Segment,Source,Referred by,ID number,Date of birth,Product interest,Notes",
                      // Example rows
                      "John Smith,john@example.com,0821234567,Individual,Referral,Sipho Dlamini,,Life Cover",
                      "Priya Naidoo,priya@email.com,0731234567,Commercial,Campaign,,,Motor Fleet,Needs fleet cover for 5 vehicles",
                      "Themba Mokoena,,0641234567,Individual,Import,,8501015800082,1985-01-01,Funeral Cover",
                    ];
                    const csv = rows.join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mmela-leads-template.csv"; a.click();
                  }}
                >
                  Download CSV template
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Map fields */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg text-xs" style={{ background: "#EEF4FD", color: "#1A348C" }}>
                We detected <strong>{headers.length} columns</strong> and <strong>{rawRows.length} rows</strong>. Map each column to a lead field below. Columns marked "Skip" won't be imported.
              </div>
              <div className="space-y-2">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{h}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        Sample: {rawRows.slice(0, 2).map(r => r[h]).filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <select
                      className="input-field flex-shrink-0"
                      style={{ width: 220 }}
                      value={mapping[h] ?? "__skip"}
                      onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                    >
                      {SYSTEM_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {!Object.values(mapping).includes("name") && (
                <div className="p-3 rounded-lg flex items-center gap-2 text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  You must map at least one column to "Full name" before continuing.
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ready to import", value: valid.length, color: "#27500A", bg: "#EAF3DE" },
                  { label: "Will be skipped", value: invalid.length, color: "#791F1F", bg: "#FCEBEB" },
                  { label: "Total rows", value: mappedRows.length, color: "#1A348C", bg: "#EEF4FD" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: bg }}>
                    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Invalid rows */}
              {invalid.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Rows with issues ({invalid.length})</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {invalid.map((row, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#FCEBEB" }}>
                        <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="font-medium text-red-700">{row.name || "(no name)"}</span>
                        <span className="text-red-500">— {row.error || "duplicate"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid preview */}
              {valid.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Preview (first 10 valid rows)</p>
                  <div className="card p-0 overflow-hidden">
                    <div className="table-scroll">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {["Name","Email","Phone","Segment","Source"].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {valid.slice(0, 10).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                              <td className="px-3 py-2 text-gray-500">{row.email || "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{row.phone || "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{row.segment || segment}</td>
                              <td className="px-3 py-2 text-gray-500">{row.source || source}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && result && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Import complete</p>
                <p className="text-sm text-gray-500 mt-1">Your leads have been imported successfully.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                {[
                  { label: "Imported", value: result.imported, color: "#27500A", bg: "#EAF3DE" },
                  { label: "Skipped", value: result.skipped, color: "#633806", bg: "#FAEEDA" },
                  { label: "Errors", value: result.errors, color: "#791F1F", bg: "#FCEBEB" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: bg }}>
                    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={onDone}>View imported leads</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
            <button className="btn btn-secondary gap-1.5" onClick={() => step === 0 ? onBack() : setStep(s => s - 1)} disabled={importing || checking}>
              <ChevronLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
            </button>
            <button
              className="btn btn-primary gap-1.5"
              disabled={
                (step === 0 && (!file || !selectedUnit)) ||
                (step === 1 && !Object.values(mapping).includes("name")) ||
                (step === 2 && valid.length === 0) ||
                importing || checking
              }
              onClick={() => {
                if (step === 0) setStep(1);
                else if (step === 1) buildMappedRows();
                else if (step === 2) runImport();
              }}
            >
              {checking ? "Checking…" : importing ? "Importing…" : step === 2 ? `Import ${valid.length} leads` : "Continue"}
              {!importing && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}