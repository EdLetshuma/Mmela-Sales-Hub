"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string;
  user_email: string;
  summary: string | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  clients: "Client",
  policies: "Policy",
  leads: "Lead",
  users: "User",
  report_mailings: "Report Mailing",
};

const ACTION_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  INSERT: { bg: "#EAF3DE", color: "#27500A", label: "Created" },
  UPDATE: { bg: "#EEF4FD", color: "#1A348C", label: "Updated" },
  DELETE: { bg: "#FCEBEB", color: "#791F1F", label: "Deleted" },
};

// Fields that are internal/technical and shouldn't show in the diff
const SKIP_FIELDS = new Set([
  "updated_at", "created_at", "audit_trail", "policy_ids",
  "raw_app_meta_data", "raw_user_meta_data", "confirmation_token",
  "recovery_token", "id", "instance_id",
]);

function isJsonObject(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object" && !Array.isArray(val)) return true;
  if (typeof val === "string" && (val === "[object Object]" || val.startsWith("{"))) return true;
  return false;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString("en-ZA");
  if (typeof val === "string") {
    // Looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      try { return new Date(val).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); }
      catch { return val; }
    }
    // UUID
    if (/^[0-9a-f-]{36}$/.test(val)) return val.slice(0, 8) + "…";
    return val;
  }
  if (Array.isArray(val)) return val.length === 0 ? "—" : `${val.length} items`;
  return String(val);
}

function DiffView({ entry }: { entry: AuditEntry }) {
  if (entry.action === "DELETE") {
    const data = entry.old_data;
    if (!data) return <p className="text-xs text-gray-400">Record deleted.</p>;
    const fields = Object.entries(data).filter(([k]) => !SKIP_FIELDS.has(k) && !isJsonObject(data[k]));
    return (
      <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "#FCEBEB" }}>
        <p className="font-semibold text-red-700 mb-2">Record deleted</p>
        {fields.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-red-400 font-medium w-32 flex-shrink-0">{k.replace(/_/g, " ")}</span>
            <span className="text-red-700">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (entry.action === "INSERT") {
    const data = entry.new_data;
    if (!data) return <p className="text-xs text-gray-400">Record created.</p>;
    const fields = Object.entries(data).filter(([k, v]) => !SKIP_FIELDS.has(k) && !isJsonObject(v) && v !== null && v !== "");
    return (
      <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "#EAF3DE" }}>
        <p className="font-semibold text-green-700 mb-2">New record created</p>
        {fields.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-green-600 font-medium w-32 flex-shrink-0">{k.replace(/_/g, " ")}</span>
            <span className="text-green-800">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // UPDATE — show changed fields only, skip objects/arrays
  const changed = (entry.changed_fields ?? []).filter(
    (f) => !SKIP_FIELDS.has(f) && !isJsonObject(entry.old_data?.[f]) && !isJsonObject(entry.new_data?.[f])
  );

  if (changed.length === 0) {
    return <p className="text-xs text-gray-400">Internal fields updated (no user-visible changes).</p>;
  }

  return (
    <div className="space-y-2">
      {changed.map((field) => {
        const before = entry.old_data?.[field];
        const after  = entry.new_data?.[field];
        return (
          <div key={field} className="rounded-lg overflow-hidden text-xs">
            <p className="font-semibold text-gray-600 px-3 py-1.5 capitalize" style={{ background: "#F8F9FB" }}>
              {field.replace(/_/g, " ")}
            </p>
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              <div className="p-2.5" style={{ background: "#FEF2F2" }}>
                <p className="text-[10px] text-red-400 font-bold mb-1">BEFORE</p>
                <p className="text-red-700 break-all">{formatValue(before)}</p>
              </div>
              <div className="p-2.5" style={{ background: "#F0FDF4" }}>
                <p className="text-[10px] text-green-600 font-bold mb-1">AFTER</p>
                <p className="text-green-700 break-all">{formatValue(after)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (tableFilter) q = q.eq("table_name", tableFilter);
    if (actionFilter) q = q.eq("action", actionFilter);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");

    const { data, count } = await q;
    setEntries((data as AuditEntry[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, tableFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { setPage(0); }, [tableFilter, actionFilter, dateFrom, dateTo, search]);

  const filtered = search
    ? entries.filter(e =>
        (e.summary ?? "").toLowerCase().includes(search.toLowerCase()) ||
        e.user_email?.toLowerCase().includes(search.toLowerCase()) ||
        TABLE_LABELS[e.table_name]?.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Audit trail</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Every change to clients, policies, leads and users — who did what and when.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" style={{ width: 220 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 130 }} value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
          <option value="">All tables</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-field" style={{ width: 130 }} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
        <input className="input-field" type="date" style={{ width: 140 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-gray-400">to</span>
        <input className="input-field" type="date" style={{ width: 140 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(tableFilter || actionFilter || dateFrom || dateTo || search) && (
          <button className="btn btn-ghost text-xs" onClick={() => { setTableFilter(""); setActionFilter(""); setDateFrom(""); setDateTo(""); setSearch(""); }}>Clear</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{totalCount.toLocaleString()} entries</span>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12"><p className="text-sm text-gray-400">No entries match your filters.</p></div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(entry => {
            const style = ACTION_STYLES[entry.action] ?? ACTION_STYLES.UPDATE;
            const isExp = expanded === entry.id;
            const summary = entry.summary ?? `${style.label} ${TABLE_LABELS[entry.table_name] ?? entry.table_name}`;

            return (
              <div key={entry.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                  onClick={() => setExpanded(isExp ? null : entry.id)}
                >
                  <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: style.bg, color: style.color, minWidth: 64, textAlign: "center" }}>
                    {style.label}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 w-14">{TABLE_LABELS[entry.table_name] ?? entry.table_name}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1 truncate">{summary}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 hide-tablet">{entry.user_email?.split("@")[0] ?? "system"}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isExp ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                </button>

                {isExp && (
                  <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 pb-2" style={{ borderBottom: "1px solid #F1F3F5" }}>
                      <span><span className="font-medium text-gray-700">By:</span> {entry.user_email ?? "system"}</span>
                      <span><span className="font-medium text-gray-700">When:</span> {new Date(entry.created_at).toLocaleString("en-ZA")}</span>
                      <span><span className="font-medium text-gray-700">Record:</span> {entry.record_id?.slice(0, 8)}…</span>
                    </div>
                    <DiffView entry={entry} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <button className="btn btn-secondary text-xs" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
