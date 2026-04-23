"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, ChevronRight, Trash2 } from "lucide-react";
import {
  getPolicies, getClients, getSalesUsers, createPolicy,
  updatePolicy, deletePolicy, type SalesPolicy, type SalesClient, type SalesUser,
} from "@/lib/sales-api";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSystemSettings, type SystemSettings } from "@/lib/settings-api";
import type { ClientSegment } from "@/types";
import AddPolicyModal, { type NewPolicyData } from "@/components/sales/AddPolicyModal";
import PolicyDetailModal from "@/components/sales/PolicyDetailModal";

interface SalesPoliciesProps {
  segment: ClientSegment;
  onViewPolicy?: (policyId: string) => void;
}

const STATUSES = ["Active", "Pending", "Canceled", "Retained", "Expired"];
const INSURERS = ["Absa","Affinity","Auto & General","Auto and General","Brightrock","Budget","Budget Insurance","Envi Africa","King Price","MiWay","Profusion","Quicksure","Santam","SAU"];
const PAGE_SIZE = 20;

function formatCurrency(val?: number | string | null) {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PolicyStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Active:   { bg: "#EAF3DE", color: "#27500A" },
    Pending:  { bg: "#FAEEDA", color: "#633806" },
    Canceled: { bg: "#FCEBEB", color: "#791F1F" },
    Expired:  { bg: "#FCEBEB", color: "#791F1F" },
    Retained: { bg: "#E1F5EE", color: "#085041" },
  };
  const s = map[status ?? ""] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{status ?? "—"}</span>;
}

export default function SalesPolicies({ segment, onViewPolicy }: SalesPoliciesProps) {
  const { user } = useAuth();
  const canDelete = user?.role === "Admin" || user?.role === "Manager";
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeletePolicy(e: React.MouseEvent, policy: SalesPolicy) {
    e.stopPropagation();
    if (!window.confirm(`Delete policy ${policy.policy_number ?? policy.id.slice(0,8)}? This cannot be undone.`)) return;
    setDeletingId(policy.id);
    try {
      await deletePolicy(policy.id);
      setPolicies(prev => prev.filter(p => p.id !== policy.id));
    } catch { /* silent */ }
    setDeletingId(null);
  }
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [insurerFilter, setInsurerFilter] = useState("");
  const [docsFilter, setDocsFilter] = useState("");
  const [page, setPage] = useState(1);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailPolicy, setDetailPolicy] = useState<SalesPolicy | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c, u, s] = await Promise.all([
        getPolicies({ segment, status: statusFilter || undefined, insurer: insurerFilter || undefined, documentation_status: docsFilter || undefined }),
        getClients({ segment }),
        getSalesUsers(),
        getSystemSettings(),
      ]);
      setPolicies(p); setClients(c); setUsers(u); setSettings(s);
      setPage(1);
    } catch { setError("Failed to load policies."); }
    finally { setLoading(false); }
  }, [segment, statusFilter, insurerFilter, docsFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = policies.filter((p) =>
    !search || (p.policy_number ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const active = policies.filter((p) => p.status === "Active").length;
  const pending = policies.filter((p) => p.status === "Pending").length;
  const canceled = policies.filter((p) => p.status === "Canceled").length;
  const docsPending = policies.filter((p) => p.documentation_status === "Pending").length;
  const totalPremium = policies.filter((p) => p.status === "Active").reduce((s, p) => s + Number(p.premium ?? 0), 0);

  const soldByName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? "—";
  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  async function handleAddPolicy(data: NewPolicyData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createPolicy(data as any);
    await fetchAll();
  }

  async function handleUpdatePolicy(updates: Partial<SalesPolicy>) {
    if (!detailPolicy) return;
    const updated = await updatePolicy(detailPolicy.id, updates);
    setDetailPolicy(updated);
    await fetchAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Policies</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {policies.length} policies</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ New policy</button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Active", value: active, color: "#0F6E56" },
          { label: "Pending", value: pending, color: "#854F0B" },
          { label: "Canceled", value: canceled, color: "#A32D2D" },
          { label: "Docs pending", value: docsPending, color: "#854F0B" },
          { label: "Monthly premium", value: formatCurrency(totalPremium), color: "#1A348C" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-semibold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" style={{ width: 200 }} placeholder="Search policy number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field" style={{ width: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field" style={{ width: 150 }} value={insurerFilter} onChange={(e) => setInsurerFilter(e.target.value)}>
          <option value="">All insurers</option>
          {INSURERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field" style={{ width: 140 }} value={docsFilter} onChange={(e) => setDocsFilter(e.target.value)}>
          <option value="">All docs</option>
          <option value="Complete">Complete</option>
          <option value="Pending">Pending</option>
        </select>
        {(search || statusFilter || insurerFilter || docsFilter) && (
          <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setStatusFilter(""); setInsurerFilter(""); setDocsFilter(""); }}>Clear</button>
        )}
      </div>

      {error ? (
        <div className="card text-center py-10"><p className="text-sm text-red-500">{error}</p><button className="btn btn-secondary mt-3" onClick={fetchAll}>Retry</button></div>
      ) : loading ? (
        <div className="card space-y-3 py-4">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12"><p className="text-sm text-gray-400">No policies match your filters.</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Policy #", "Client", "Product", "Insurer", "Premium", "Inception", "Sold by", "Status", "Docs", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setDetailPolicy(policy)}>
                  <td className="px-4 py-3 font-mono text-xs text-brand-800 font-medium">{policy.policy_number}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{clientName(policy.client_id)}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{policy.product_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{policy.product_category ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{policy.insurer ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(policy.premium)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {policy.inception_date ? new Date(policy.inception_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{soldByName(policy.sold_by_user_id)}</td>
                  <td className="px-4 py-3"><PolicyStatusBadge status={policy.status} /></td>
                  <td className="px-4 py-3">
                    <span className="badge" style={policy.documentation_status === "Complete" ? { background: "#EAF3DE", color: "#27500A" } : { background: "#FAEEDA", color: "#633806" }}>
                      {policy.documentation_status ?? "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canDelete && (
                        <button
                          onClick={(e) => handleDeletePolicy(e, policy)}
                          disabled={deletingId === policy.id}
                          className="btn btn-ghost p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete policy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Add policy modal */}
      {settings && (
        <AddPolicyModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSave={handleAddPolicy}
          clients={clients}
          users={users}
          settings={settings}
          segment={segment}
        />
      )}

      {/* Policy detail modal */}
      {detailPolicy && (
        <PolicyDetailModal
          isOpen={!!detailPolicy}
          onClose={() => setDetailPolicy(null)}
          policy={detailPolicy}
          clientName={clientName(detailPolicy.client_id)}
          onEdit={() => { /* edit inline in modal */ }}
          onUpdatePolicy={handleUpdatePolicy}
        />
      )}
    </div>
  );
}
