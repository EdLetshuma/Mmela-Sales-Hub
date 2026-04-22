"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Download } from "lucide-react";

type ReportType = "leads" | "policies" | "agents";

function formatCurrency(val?: number | string | null) {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map((r) =>
    r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HubReporting() {
  const [reportType, setReportType] = useState<ReportType>("leads");
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [policies, setPolicies] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [leadsRes, policiesRes, usersRes] = await Promise.all([
          supabase.from("leads").select("*").order("created_at", { ascending: false }),
          supabase.from("policies").select("*").order("inception_date", { ascending: false }),
          supabase.from("users").select("id, name, role, status").eq("status", "Active").order("name"),
        ]);
        setLeads(leadsRes.data ?? []);
        setPolicies(policiesRes.data ?? []);
        setUsers(usersRes.data ?? []);
      } catch {
        setError("Failed to load report data.");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const agentName = (id?: string | null) =>
    (users.find((u) => u.id === id)?.name as string) ?? "—";

  const filteredLeads = leads.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    return true;
  });

  const filteredPolicies = policies.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  // Agent summary across all units
  const agentSummary = users
    .filter((u) => ["Sales Agent", "Team Leader", "Manager", "Concierge Agent", "Credit Health Agent"].includes(u.role as string))
    .map((u) => {
      const agentLeads = leads.filter((l) => l.assigned_to_user_id === u.id);
      const agentPolicies = policies.filter((p) => p.sold_by_user_id === u.id);
      const activePremium = agentPolicies
        .filter((p) => p.status === "Active")
        .reduce((s, p) => s + Number(p.premium ?? 0), 0);
      const won = agentLeads.filter((l) => l.status === "Won").length;
      return {
        name: u.name as string,
        role: u.role as string,
        leads: agentLeads.length,
        won,
        conversion: agentLeads.length > 0 ? Math.round((won / agentLeads.length) * 1000) / 10 : 0,
        policies: agentPolicies.length,
        activePremium,
      };
    })
    .sort((a, b) => b.activePremium - a.activePremium);

  function handleExport() {
    const date = new Date().toISOString().slice(0, 10);
    if (reportType === "leads") {
      downloadCSV(
        `hub-leads-${date}.csv`,
        filteredLeads.slice(0, 5000).map((l) => [
          String(l.name ?? ""),
          (l.email as string ?? "").includes("@placeholder.com") ? "" : String(l.email ?? ""),
          String(l.phone ?? ""),
          String(l.status ?? ""),
          String(l.source ?? ""),
          String(l.segment ?? ""),
          agentName(l.assigned_to_user_id as string),
          l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
        ]),
        ["Name", "Email", "Phone", "Status", "Source", "Segment", "Assigned to", "Date added"]
      );
    } else if (reportType === "policies") {
      downloadCSV(
        `hub-policies-${date}.csv`,
        filteredPolicies.slice(0, 5000).map((p) => [
          String(p.policy_number ?? ""),
          String(p.product_name ?? ""),
          String(p.product_category ?? ""),
          String(p.insurer ?? ""),
          String(p.premium ?? ""),
          String(p.inception_date ?? ""),
          String(p.status ?? ""),
          String(p.documentation_status ?? ""),
          agentName(p.sold_by_user_id as string),
        ]),
        ["Policy #", "Product", "Category", "Insurer", "Premium", "Inception", "Status", "Docs", "Sold by"]
      );
    } else {
      downloadCSV(
        `hub-agents-${date}.csv`,
        agentSummary.map((a) => [
          a.name, a.role, String(a.leads), String(a.won),
          `${a.conversion}%`, String(a.policies), formatCurrency(a.activePremium),
        ]),
        ["Agent", "Role", "Leads", "Won", "Conversion", "Policies", "Active premium"]
      );
    }
  }

  const LEAD_STATUSES = ["Prospect", "Contacted", "Quoted", "Won", "Lost"];
  const POLICY_STATUSES = ["Active", "Pending", "Canceled", "Retained", "Expired"];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reporting</h1>
          <p className="text-sm text-gray-500 mt-1">Export data across all business units</p>
        </div>
        <button className="btn btn-primary gap-2" onClick={handleExport} disabled={loading}>
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Report type */}
      <div className="flex gap-2">
        {(["leads", "policies", "agents"] as ReportType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setReportType(t); setStatusFilter(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${
              reportType === t
                ? "bg-brand-900 text-white border-brand-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {t === "agents" ? "Agent summary" : t}
          </button>
        ))}
      </div>

      {/* Filters */}
      {reportType !== "agents" && (
        <div className="flex gap-2">
          <select
            className="input-field"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {(reportType === "leads" ? LEAD_STATUSES : POLICY_STATUSES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(statusFilter) && (
            <button className="btn btn-ghost text-xs" onClick={() => setStatusFilter("")}>Clear</button>
          )}
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <p className="text-sm text-gray-500">
          {reportType === "leads" && `${filteredLeads.length.toLocaleString()} leads`}
          {reportType === "policies" && `${filteredPolicies.length.toLocaleString()} policies`}
          {reportType === "agents" && `${agentSummary.length} agents`}
          {" · Showing first 50 rows — export for full dataset"}
        </p>
      )}

      {/* Table */}
      {error ? (
        <div className="card text-center py-10"><p className="text-sm text-red-500">{error}</p></div>
      ) : loading ? (
        <div className="card space-y-3 py-4">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {reportType === "leads" && (
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {["Name", "Status", "Source", "Segment", "Assigned to", "Added"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.slice(0, 50).map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{String(l.name ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(l.status ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(l.source ?? l.source_type ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(l.segment ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{agentName(l.assigned_to_user_id as string)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === "policies" && (
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {["Policy #", "Product", "Insurer", "Premium", "Status", "Docs", "Sold by"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPolicies.slice(0, 50).map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-800 font-medium">{String(p.policy_number ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-900">{String(p.product_name ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(p.insurer ?? "—")}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{formatCurrency(p.premium as number)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(p.status ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{String(p.documentation_status ?? "—")}</td>
                    <td className="px-4 py-2.5 text-gray-500">{agentName(p.sold_by_user_id as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === "agents" && (
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {["Agent", "Role", "Leads", "Won", "Conversion", "Policies", "Active premium"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {agentSummary.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{a.role}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.leads}</td>
                    <td className="px-4 py-2.5 text-emerald-700 font-medium">{a.won}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.conversion}%</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.policies}</td>
                    <td className="px-4 py-2.5 font-medium text-brand-900">{formatCurrency(a.activePremium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
