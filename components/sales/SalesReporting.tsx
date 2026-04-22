"use client";

import React, { useEffect, useState } from "react";
import { getPolicies, getLeads, getSalesUsers, type SalesPolicy, type SalesUser } from "@/lib/sales-api";
import type { ClientSegment } from "@/types";
import { Download } from "lucide-react";

interface SalesReportingProps {
  segment: ClientSegment;
}

type ReportType = "policies" | "leads" | "agent_summary";

function formatCurrency(val?: number | string | null): string {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map((r) =>
    r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesReporting({ segment }: SalesReportingProps) {
  const [reportType, setReportType] = useState<ReportType>("policies");
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [insurerFilter, setInsurerFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getPolicies({ segment }),
      getLeads({ segment }),
      getSalesUsers(),
    ])
      .then(([p, l, u]) => { setPolicies(p); setLeads(l); setUsers(u); })
      .catch(() => setError("Failed to load report data."))
      .finally(() => setLoading(false));
  }, [segment]);

  const soldByName = (id?: string | null) =>
    users.find((u) => u.id === id)?.name ?? "—";

  // Filtered policies
  const filteredPolicies = policies.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (insurerFilter && p.insurer !== insurerFilter) return false;
    if (agentFilter && p.sold_by_user_id !== agentFilter) return false;
    return true;
  });

  // Filtered leads
  const filteredLeads = leads.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (agentFilter && l.assigned_to_user_id !== agentFilter) return false;
    return true;
  });

  // Agent summary
  const agentSummary = users
    .filter((u) => ["Sales Agent", "Team Leader", "Manager"].includes(u.role))
    .map((u) => {
      const agentPolicies = policies.filter((p) => p.sold_by_user_id === u.id);
      const agentLeads = leads.filter((l) => l.assigned_to_user_id === u.id);
      const activePremium = agentPolicies
        .filter((p) => p.status === "Active")
        .reduce((sum, p) => sum + Number(p.premium ?? 0), 0);
      return {
        name: u.name,
        role: u.role,
        leadsAssigned: agentLeads.length,
        leadsWon: agentLeads.filter((l) => l.status === "Won").length,
        policiesSold: agentPolicies.length,
        activePolicies: agentPolicies.filter((p) => p.status === "Active").length,
        activePremium,
        conversionRate:
          agentLeads.length > 0
            ? Math.round((agentLeads.filter((l) => l.status === "Won").length / agentLeads.length) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.activePremium - a.activePremium);

  function handleExport() {
    if (reportType === "policies") {
      downloadCSV(
        `policies-report-${new Date().toISOString().slice(0, 10)}.csv`,
        filteredPolicies.map((p) => [
          p.policy_number ?? "",
          p.product_name ?? "",
          p.product_category ?? "",
          p.insurer ?? "",
          String(p.premium ?? ""),
          p.inception_date ?? "",
          p.status ?? "",
          p.documentation_status ?? "",
          soldByName(p.sold_by_user_id),
        ]),
        ["Policy #", "Product", "Category", "Insurer", "Premium", "Inception", "Status", "Docs", "Sold by"]
      );
    } else if (reportType === "leads") {
      downloadCSV(
        `leads-report-${new Date().toISOString().slice(0, 10)}.csv`,
        filteredLeads.map((l) => [
          l.name ?? "",
          l.email?.includes("@placeholder.com") ? "" : (l.email ?? ""),
          l.phone ?? "",
          l.status ?? "",
          l.source ?? "",
          soldByName(l.assigned_to_user_id),
          l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA") : "",
        ]),
        ["Name", "Email", "Phone", "Status", "Source", "Assigned to", "Date added"]
      );
    } else {
      downloadCSV(
        `agent-summary-${new Date().toISOString().slice(0, 10)}.csv`,
        agentSummary.map((a) => [
          a.name,
          a.role,
          String(a.leadsAssigned),
          String(a.leadsWon),
          `${a.conversionRate}%`,
          String(a.policiesSold),
          String(a.activePolicies),
          formatCurrency(a.activePremium),
        ]),
        ["Agent", "Role", "Leads assigned", "Leads won", "Conversion", "Policies sold", "Active policies", "Active premium"]
      );
    }
  }

  const INSURERS = [...new Set(policies.map((p) => p.insurer).filter(Boolean))].sort();
  const POLICY_STATUSES = ["Active", "Pending", "Canceled", "Retained", "Expired"];
  const LEAD_STATUSES = ["Prospect", "Contacted", "Quoted", "Won", "Lost"];
  const salesAgents = users.filter((u) => ["Sales Agent", "Team Leader", "Manager"].includes(u.role));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reporting</h1>
          <p className="text-sm text-gray-500 mt-1">{segment} segment</p>
        </div>
        <button className="btn btn-primary gap-2" onClick={handleExport} disabled={loading}>
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Report type selector */}
      <div className="flex gap-2">
        {(["policies", "leads", "agent_summary"] as ReportType[]).map((type) => (
          <button
            key={type}
            onClick={() => { setReportType(type); setStatusFilter(""); setInsurerFilter(""); setAgentFilter(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              reportType === type
                ? "bg-brand-900 text-white border-brand-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {type === "policies" ? "Policies" : type === "leads" ? "Leads" : "Agent summary"}
          </button>
        ))}
      </div>

      {/* Filters */}
      {reportType !== "agent_summary" && (
        <div className="flex flex-wrap gap-2">
          <select
            className="input-field"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {(reportType === "policies" ? POLICY_STATUSES : LEAD_STATUSES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {reportType === "policies" && (
            <select
              className="input-field"
              style={{ width: 160 }}
              value={insurerFilter}
              onChange={(e) => setInsurerFilter(e.target.value)}
            >
              <option value="">All insurers</option>
              {INSURERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select
            className="input-field"
            style={{ width: 160 }}
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">All agents</option>
            {salesAgents.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {(statusFilter || insurerFilter || agentFilter) && (
            <button
              className="btn btn-ghost text-xs"
              onClick={() => { setStatusFilter(""); setInsurerFilter(""); setAgentFilter(""); }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Summary bar */}
      {!loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {reportType === "policies" && (
            <>
              <span>{filteredPolicies.length} policies</span>
              <span>·</span>
              <span>
                {formatCurrency(
                  filteredPolicies
                    .filter((p) => p.status === "Active")
                    .reduce((s, p) => s + Number(p.premium ?? 0), 0)
                )} active premium
              </span>
            </>
          )}
          {reportType === "leads" && <span>{filteredLeads.length} leads</span>}
          {reportType === "agent_summary" && <span>{agentSummary.length} agents</span>}
        </div>
      )}

      {/* Table */}
      {error ? (
        <div className="card text-center py-10">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : loading ? (
        <div className="card space-y-3 py-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {reportType === "policies" && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Policy #", "Product", "Insurer", "Premium", "Inception", "Sold by", "Status", "Docs"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPolicies.slice(0, 50).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-800 font-medium">{p.policy_number}</td>
                    <td className="px-4 py-2.5 text-gray-900">{p.product_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.insurer ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{formatCurrency(p.premium)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {p.inception_date ? new Date(p.inception_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{soldByName(p.sold_by_user_id)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.status}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.documentation_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === "leads" && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Name", "Phone", "Status", "Source", "Assigned to", "Added"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.slice(0, 50).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{l.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{l.phone ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{l.status}</td>
                    <td className="px-4 py-2.5 text-gray-500">{l.source ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{soldByName(l.assigned_to_user_id)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {l.created_at ? new Date(l.created_at as string).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === "agent_summary" && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Agent", "Role", "Leads", "Won", "Conversion", "Policies sold", "Active", "Active premium"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agentSummary.map((a) => (
                  <tr key={a.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{a.role}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.leadsAssigned}</td>
                    <td className="px-4 py-2.5 text-emerald-700 font-medium">{a.leadsWon}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.conversionRate}%</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.policiesSold}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.activePolicies}</td>
                    <td className="px-4 py-2.5 font-medium text-brand-900">{formatCurrency(a.activePremium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && reportType !== "agent_summary" && (
        <p className="text-xs text-gray-400">
          Showing first 50 rows. Use Export CSV to download the full dataset.
        </p>
      )}
    </div>
  );
}
