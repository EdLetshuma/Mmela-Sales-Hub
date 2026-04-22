"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import {
  getPoliciesForRetention, getClients, updatePolicy, markRetentionFailed,
  type SalesPolicy, type SalesClient,
} from "@/lib/sales-api";
import { getSystemSettings, type SystemSettings } from "@/lib/settings-api";
import type { ClientSegment } from "@/types";
import RetainPolicyModal, { type RetentionUpdateData } from "@/components/sales/RetainPolicyModal";
import { useAuth } from "@/components/providers/AuthProvider";

interface SalesRetentionsProps {
  segment: ClientSegment;
  onViewClient?: (clientId: string) => void;
}

const PAGE_SIZE = 20;

function formatCurrency(val?: number | string | null) {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RetentionBadge({ policy }: { policy: SalesPolicy }) {
  if (policy.status === "Retained") return <span className="badge" style={{ background: "#E1F5EE", color: "#085041" }}>Retained</span>;
  if (policy.retention_attempt_failed) return <span className="badge" style={{ background: "#FCEBEB", color: "#791F1F" }}>Failed</span>;
  return <span className="badge" style={{ background: "#FAEEDA", color: "#633806" }}>Needs action</span>;
}

export default function SalesRetentions({ segment, onViewClient }: SalesRetentionsProps) {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const [retainPolicy, setRetainPolicy] = useState<SalesPolicy | null>(null);
  const [failConfirm, setFailConfirm] = useState<SalesPolicy | null>(null);
  const [failSaving, setFailSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c, s] = await Promise.all([
        getPoliciesForRetention(segment),
        getClients({ segment }),
        getSystemSettings(),
      ]);
      setPolicies(p); setClients(c); setSettings(s);
      setPage(1);
    } catch { setError("Failed to load retention data."); }
    finally { setLoading(false); }
  }, [segment]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const clientId = (policyClientId?: string | null) => policyClientId ?? null;

  const filtered = policies.filter((p) => {
    const matchSearch = !search || (p.policy_number ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      !filter ||
      (filter === "retained" && p.status === "Retained") ||
      (filter === "failed" && p.retention_attempt_failed && p.status !== "Retained") ||
      (filter === "needs_action" && !p.retention_attempt_failed && p.status !== "Retained");
    return matchSearch && matchFilter;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const retainedCount = policies.filter((p) => p.status === "Retained").length;
  const failedCount = policies.filter((p) => p.retention_attempt_failed && p.status !== "Retained").length;
  const needsCount = policies.filter((p) => !p.retention_attempt_failed && p.status !== "Retained").length;
  const retainedPremium = policies.filter((p) => p.status === "Retained").reduce((s, p) => s + Number(p.premium ?? 0), 0);

  async function handleRetainSave(policyId: string, data: RetentionUpdateData) {
    await updatePolicy(policyId, {
      policy_number: data.policyNumber,
      base_premium: data.base_premium,
      premium: data.premium,
      vaps: data.vaps as unknown as SalesPolicy["vaps"],
      inception_date: data.inceptionDate,
      sale_date: data.saleDate,
      insurer: data.insurer,
      status: "Retained",
      retention_attempt_failed: false,
      retention_details: {
        previousPolicyNumber: retainPolicy?.policy_number ?? "",
        previousPremium: Number(retainPolicy?.premium ?? 0),
        retainedAt: new Date().toISOString(),
        retainedBy: user?.id ?? "",
      },
    });
    setRetainPolicy(null);
    await fetchAll();
  }

  async function handleMarkFailed(policy: SalesPolicy) {
    setFailSaving(true);
    try {
      await markRetentionFailed(policy.id);
      setFailConfirm(null);
      await fetchAll();
    } finally { setFailSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Retentions</h1>
        <p className="text-sm text-gray-500 mt-1">Canceled and expired policies requiring retention action</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card py-3"><p className="text-xs text-gray-400 mb-1">Needs action</p><p className="text-lg font-semibold text-amber-600">{needsCount}</p></div>
        <div className="card py-3"><p className="text-xs text-gray-400 mb-1">Retained</p><p className="text-lg font-semibold text-emerald-700">{retainedCount}</p></div>
        <div className="card py-3"><p className="text-xs text-gray-400 mb-1">Failed</p><p className="text-lg font-semibold text-red-600">{failedCount}</p></div>
        <div className="card py-3"><p className="text-xs text-gray-400 mb-1">Retained premium</p><p className="text-lg font-semibold text-brand-900">{formatCurrency(retainedPremium)}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" style={{ width: 200 }} placeholder="Search policy number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field" style={{ width: 160 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All records</option>
          <option value="needs_action">Needs action</option>
          <option value="retained">Retained</option>
          <option value="failed">Failed</option>
        </select>
        {(search || filter) && <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setFilter(""); }}>Clear</button>}
      </div>

      {error ? (
        <div className="card text-center py-10"><p className="text-sm text-red-500">{error}</p><button className="btn btn-secondary mt-3" onClick={fetchAll}>Retry</button></div>
      ) : loading ? (
        <div className="card space-y-3 py-4">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12"><p className="text-sm text-gray-400">No retention records match your filters.</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Policy #", "Client", "Product", "Insurer", "Premium", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((policy) => {
                const canAct = policy.status !== "Retained" && !policy.retention_attempt_failed;
                return (
                  <tr key={policy.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand-800 font-medium">{policy.policy_number?.trim()}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{clientName(policy.client_id)}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{policy.product_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{policy.product_category ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{policy.insurer ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(policy.premium)}</td>
                    <td className="px-4 py-3"><RetentionBadge policy={policy} /></td>
                    <td className="px-4 py-3">
                      {canAct && (
                        <div className="flex gap-2">
                          <button className="btn btn-secondary text-xs py-1 px-2" onClick={() => setRetainPolicy(policy)}>Mark retained</button>
                          <button className="text-xs text-red-500 hover:text-red-700 font-medium" onClick={() => setFailConfirm(policy)}>Failed</button>
                        </div>
                      )}
                      {!canAct && policy.status !== "Retained" && onViewClient && (
                        <button className="text-xs text-brand-700 hover:underline" onClick={() => { const cid = clientId(policy.client_id); if (cid) onViewClient(cid); }}>View client</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Retain modal */}
      {retainPolicy && settings && (
        <RetainPolicyModal
          isOpen={!!retainPolicy}
          onClose={() => setRetainPolicy(null)}
          onSave={handleRetainSave}
          policy={retainPolicy}
          clientName={clientName(retainPolicy.client_id)}
          settings={settings}
          onViewClient={() => {
            const cid = clientId(retainPolicy.client_id);
            if (cid && onViewClient) onViewClient(cid);
          }}
        />
      )}

      {/* Fail confirm */}
      {failConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setFailConfirm(null)}>
          <div className="card" style={{ width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Mark retention as failed?</h3>
            <p className="text-sm text-gray-500 mb-4">Policy {failConfirm.policy_number?.trim()} · {formatCurrency(failConfirm.premium)}<br />This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setFailConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "#A32D2D" }} disabled={failSaving} onClick={() => handleMarkFailed(failConfirm)}>
                {failSaving ? "Saving…" : "Confirm failed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
