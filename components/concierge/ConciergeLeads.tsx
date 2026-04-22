"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getConciergeLeads, createConciergeLead, updateConciergeLead,
  CONCIERGE_STATUSES, type ConciergeLead,
} from "@/lib/concierge-api";
import { getSalesUsers, type SalesUser } from "@/lib/sales-api";
import { Search, ChevronRight, ArrowLeft, X, Plus } from "lucide-react";

const SOURCES = ["Manual", "Referral", "Website", "Campaign", "WhatsApp", "Walk-in", "Other"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "New":        { bg: "#EEF4FD", color: "#1A348C" },
  "Contacted":  { bg: "#E1F5EE", color: "#085041" },
  "Sourcing":   { bg: "#FAEEDA", color: "#633806" },
  "Quote Sent": { bg: "#E6F1FB", color: "#0C447C" },
  "Won":        { bg: "#EAF3DE", color: "#27500A" },
  "Lost":       { bg: "#FCEBEB", color: "#791F1F" },
  "On Hold":    { bg: "#F1EFE8", color: "#5F5E5A" },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_COLORS[status ?? "New"] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{status ?? "New"}</span>;
}

function getInitials(name: string) {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const PAGE_SIZE = 20;

// ── Add/Edit modal ───────────────────────────────────────────

interface LeadModalProps {
  lead?: ConciergeLead;
  onClose: () => void;
  onSave: (data: Partial<ConciergeLead>) => Promise<void>;
  users: SalesUser[];
}

function LeadModal({ lead, onClose, onSave, users }: LeadModalProps) {
  const [form, setForm] = useState({
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "Manual",
    vehicle_make: lead?.vehicle_make ?? "",
    vehicle_model: lead?.vehicle_model ?? "",
    vehicle_year: lead?.vehicle_year ?? "",
    vehicle_price: lead?.vehicle_price ?? "",
    unit_status: lead?.unit_status ?? "New",
    unit_notes: lead?.unit_notes ?? "",
    assigned_to_user_id: lead?.assigned_to_user_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        vehicle_price: form.vehicle_price ? Number(form.vehicle_price) : undefined,
        assigned_to_user_id: form.assigned_to_user_id || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const conciergeUsers = users.filter((u) =>
    ["Concierge Agent", "Admin", "Manager"].includes(u.role)
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{lead ? "Edit lead" : "Capture new lead"}</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1 }}>
          <div className="space-y-4">
            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <input className="input-field" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email <span className="text-gray-400">(optional)</span></label>
                <input className="input-field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source</label>
                <select className="input-field" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Vehicle */}
            <div style={{ borderTop: "1px solid #F1F3F5", paddingTop: 12 }}>
              <p className="text-xs font-medium text-gray-500 mb-2">Vehicle interest</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Make</label>
                  <input className="input-field" value={form.vehicle_make} onChange={(e) => setForm((f) => ({ ...f, vehicle_make: e.target.value }))} placeholder="e.g. Toyota" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Model</label>
                  <input className="input-field" value={form.vehicle_model} onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))} placeholder="e.g. Fortuner" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Year</label>
                  <input className="input-field" value={form.vehicle_year} onChange={(e) => setForm((f) => ({ ...f, vehicle_year: e.target.value }))} placeholder="e.g. 2024" />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-1 block">Budget / Price (R)</label>
                <input className="input-field" type="number" min="0" value={form.vehicle_price} onChange={(e) => setForm((f) => ({ ...f, vehicle_price: e.target.value }))} placeholder="e.g. 450000" />
              </div>
            </div>

            {/* Status + Assignment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <select className="input-field" value={form.unit_status} onChange={(e) => setForm((f) => ({ ...f, unit_status: e.target.value }))}>
                  {CONCIERGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Assigned to</label>
                <select className="input-field" value={form.assigned_to_user_id} onChange={(e) => setForm((f) => ({ ...f, assigned_to_user_id: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {conciergeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <textarea className="input-field" rows={3} value={form.unit_notes} onChange={(e) => setForm((f) => ({ ...f, unit_notes: e.target.value }))} placeholder="Any additional details…" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : lead ? "Save changes" : "Capture lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead detail ───────────────────────────────────────────────

function ConciergeLeadDetail({ lead, users, onBack, onUpdate }: { lead: ConciergeLead; users: SalesUser[]; onBack: () => void; onUpdate: (updated: ConciergeLead) => void }) {
  const [editing, setEditing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function handleStatusChange(status: string) {
    setUpdatingStatus(true);
    try {
      const updated = await updateConciergeLead(lead.id, { unit_status: status, closed_at: ["Won", "Lost"].includes(status) ? new Date().toISOString() : undefined });
      onUpdate(updated);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const agentName = users.find((u) => u.id === lead.assigned_to_user_id)?.name;

  return (
    <div className="space-y-4">
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to leads
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-sm font-semibold text-brand-800 flex-shrink-0">
              {getInitials(lead.name)}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{lead.name}</h1>
              {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
              {lead.email && !lead.email.includes("@placeholder.com") && (
                <p className="text-sm text-gray-500">{lead.email}</p>
              )}
            </div>
          </div>
          <button className="btn btn-secondary text-xs" onClick={() => setEditing(true)}>Edit</button>
        </div>

        {/* Status pills */}
        <div className="mt-4 pt-4 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid #F1F3F5" }}>
          <span className="text-xs text-gray-400">Status</span>
          <div className="flex gap-1.5 flex-wrap">
            {CONCIERGE_STATUSES.map((s) => (
              <button
                key={s}
                disabled={updatingStatus}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  lead.unit_status === s
                    ? "bg-brand-900 text-white border-brand-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Vehicle details */}
          {(lead.vehicle_make || lead.vehicle_model || lead.vehicle_price) && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Vehicle interest</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {lead.vehicle_make && <><span className="text-gray-400">Make</span><span className="text-gray-900">{lead.vehicle_make}</span></>}
                {lead.vehicle_model && <><span className="text-gray-400">Model</span><span className="text-gray-900">{lead.vehicle_model}</span></>}
                {lead.vehicle_year && <><span className="text-gray-400">Year</span><span className="text-gray-900">{lead.vehicle_year}</span></>}
                {lead.vehicle_price && <><span className="text-gray-400">Budget</span><span className="text-gray-900 font-medium">R {Number(lead.vehicle_price).toLocaleString("en-ZA")}</span></>}
              </div>
            </div>
          )}

          {lead.unit_notes && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.unit_notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3"><span className="text-gray-400 w-20 flex-shrink-0">Source</span><span className="text-gray-700">{lead.source ?? "—"}</span></div>
              <div className="flex gap-3"><span className="text-gray-400 w-20 flex-shrink-0">Assigned</span><span className="text-gray-700">{agentName ?? <span className="text-gray-400 italic">Unassigned</span>}</span></div>
              <div className="flex gap-3"><span className="text-gray-400 w-20 flex-shrink-0">Added</span><span className="text-gray-700">{lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <LeadModal
          lead={lead}
          users={users}
          onClose={() => setEditing(false)}
          onSave={async (data) => { const updated = await updateConciergeLead(lead.id, data); onUpdate(updated); setEditing(false); }}
        />
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────

export default function ConciergeLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<ConciergeLead[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<ConciergeLead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [l, u] = await Promise.all([
        getConciergeLeads({ status: statusFilter || undefined }),
        getSalesUsers(),
      ]);
      setLeads(l);
      setUsers(u);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  if (viewingLead) {
    return (
      <ConciergeLeadDetail
        lead={viewingLead}
        users={users}
        onBack={() => setViewingLead(null)}
        onUpdate={(updated) => {
          setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
          setViewingLead(updated);
        }}
      />
    );
  }

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.phone ?? "").includes(q) ||
      (l.vehicle_make ?? "").toLowerCase().includes(q) ||
      (l.vehicle_model ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const agentName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {leads.length} leads</p>
        </div>
        <button className="btn btn-primary gap-1.5" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" /> Capture lead
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" style={{ width: 220 }} placeholder="Search name, phone, vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {CONCIERGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setStatusFilter(""); }}>Clear</button>}
      </div>

      {loading ? (
        <div className="card space-y-3 py-4">{[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-400">No leads yet.</p>
          <button className="btn btn-primary mt-3" onClick={() => setShowAddModal(true)}>Capture first lead</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Name", "Vehicle", "Budget", "Source", "Assigned to", "Status", "Added", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingLead(lead)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                        {getInitials(lead.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 leading-tight">{lead.name}</p>
                        {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {[lead.vehicle_make, lead.vehicle_model, lead.vehicle_year].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-medium">
                    {lead.vehicle_price ? `R ${Number(lead.vehicle_price).toLocaleString("en-ZA")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{agentName(lead.assigned_to_user_id) ?? <span className="text-amber-600">Unassigned</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.unit_status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
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

      {showAddModal && (
        <LeadModal
          users={users}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => { await createConciergeLead(data as ConciergeLead); await fetchLeads(); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
