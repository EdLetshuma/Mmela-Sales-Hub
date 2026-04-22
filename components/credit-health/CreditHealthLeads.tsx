"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getCreditHealthLeads, createCreditHealthLead, updateCreditHealthLead,
  CREDIT_HEALTH_STATUSES, type CreditHealthLead,
} from "@/lib/credit-health-api";
import { getSalesUsers, type SalesUser } from "@/lib/sales-api";
import { Search, ChevronRight, ArrowLeft, X, Plus } from "lucide-react";

const SOURCES = ["Manual", "Referral", "Website", "Campaign", "WhatsApp", "Walk-in", "Other"];
const EMPLOYMENT_STATUSES = ["Employed", "Self-employed", "Contract", "Unemployed", "Other"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "New":        { bg: "#EEF4FD", color: "#1A348C" },
  "Contacted":  { bg: "#E1F5EE", color: "#085041" },
  "Assessment": { bg: "#FAEEDA", color: "#633806" },
  "Submitted":  { bg: "#E6F1FB", color: "#0C447C" },
  "Approved":   { bg: "#EAF3DE", color: "#27500A" },
  "Declined":   { bg: "#FCEBEB", color: "#791F1F" },
  "On Hold":    { bg: "#F1EFE8", color: "#5F5E5A" },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_COLORS[status ?? "New"] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{status ?? "New"}</span>;
}

function getInitials(name: string) {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatCurrency(val?: number | null) {
  if (!val) return "—";
  return `R ${Number(val).toLocaleString("en-ZA")}`;
}

const PAGE_SIZE = 20;

interface LeadModalProps {
  lead?: CreditHealthLead;
  onClose: () => void;
  onSave: (data: Partial<CreditHealthLead>) => Promise<void>;
  users: SalesUser[];
}

function LeadModal({ lead, onClose, onSave, users }: LeadModalProps) {
  const [form, setForm] = useState({
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "Manual",
    employment_status: lead?.employment_status ?? "",
    monthly_income: lead?.monthly_income ?? "",
    loan_amount: lead?.loan_amount ?? "",
    credit_score: lead?.credit_score ?? "",
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
        monthly_income: form.monthly_income ? Number(form.monthly_income) : undefined,
        loan_amount: form.loan_amount ? Number(form.loan_amount) : undefined,
        assigned_to_user_id: form.assigned_to_user_id || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const chUsers = users.filter((u) => ["Credit Health Agent", "Admin", "Manager"].includes(u.role));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{lead ? "Edit lead" : "Capture new lead"}</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1 }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Full name</label><input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input className="input-field" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Email <span className="text-gray-400">(optional)</span></label><input className="input-field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Source</label><select className="input-field" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>

            {/* Financial profile */}
            <div style={{ borderTop: "1px solid #F1F3F5", paddingTop: 12 }}>
              <p className="text-xs font-medium text-gray-500 mb-2">Financial profile</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Employment status</label><select className="input-field" value={form.employment_status} onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}><option value="">Select…</option>{EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Monthly income (R)</label><input className="input-field" type="number" min="0" value={form.monthly_income} onChange={(e) => setForm((f) => ({ ...f, monthly_income: e.target.value }))} placeholder="e.g. 25000" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Loan amount requested (R)</label><input className="input-field" type="number" min="0" value={form.loan_amount} onChange={(e) => setForm((f) => ({ ...f, loan_amount: e.target.value }))} placeholder="e.g. 150000" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Credit score <span className="text-gray-400">(optional)</span></label><input className="input-field" value={form.credit_score} onChange={(e) => setForm((f) => ({ ...f, credit_score: e.target.value }))} placeholder="e.g. 680" /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Status</label><select className="input-field" value={form.unit_status} onChange={(e) => setForm((f) => ({ ...f, unit_status: e.target.value }))}>{CREDIT_HEALTH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Assigned to</label><select className="input-field" value={form.assigned_to_user_id} onChange={(e) => setForm((f) => ({ ...f, assigned_to_user_id: e.target.value }))}><option value="">Unassigned</option>{chUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><textarea className="input-field" rows={3} value={form.unit_notes} onChange={(e) => setForm((f) => ({ ...f, unit_notes: e.target.value }))} placeholder="Additional details…" /></div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : lead ? "Save changes" : "Capture lead"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreditHealthLeadDetail({ lead, users, onBack, onUpdate }: { lead: CreditHealthLead; users: SalesUser[]; onBack: () => void; onUpdate: (u: CreditHealthLead) => void }) {
  const [editing, setEditing] = useState(false);
  const agentName = users.find((u) => u.id === lead.assigned_to_user_id)?.name;

  async function handleStatus(status: string) {
    const updated = await updateCreditHealthLead(lead.id, { unit_status: status, closed_at: ["Approved", "Declined"].includes(status) ? new Date().toISOString() : undefined });
    onUpdate(updated);
  }

  return (
    <div className="space-y-4">
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}><ArrowLeft className="w-4 h-4" />Back to leads</button>
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-sm font-semibold text-brand-800 flex-shrink-0">{getInitials(lead.name)}</div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{lead.name}</h1>
              {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
              {lead.email && !lead.email.includes("@placeholder.com") && <p className="text-sm text-gray-500">{lead.email}</p>}
            </div>
          </div>
          <button className="btn btn-secondary text-xs" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className="mt-4 pt-4 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid #F1F3F5" }}>
          <span className="text-xs text-gray-400">Status</span>
          <div className="flex gap-1.5 flex-wrap">
            {CREDIT_HEALTH_STATUSES.map((s) => (
              <button key={s} onClick={() => handleStatus(s)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${lead.unit_status === s ? "bg-brand-900 text-white border-brand-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {(lead.employment_status || lead.monthly_income || lead.loan_amount || lead.credit_score) && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Financial profile</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {lead.employment_status && <><span className="text-gray-400">Employment</span><span className="text-gray-900">{lead.employment_status}</span></>}
                {lead.monthly_income && <><span className="text-gray-400">Monthly income</span><span className="text-gray-900 font-medium">{formatCurrency(lead.monthly_income)}</span></>}
                {lead.loan_amount && <><span className="text-gray-400">Loan requested</span><span className="text-gray-900 font-medium">{formatCurrency(lead.loan_amount)}</span></>}
                {lead.credit_score && <><span className="text-gray-400">Credit score</span><span className="text-gray-900">{lead.credit_score}</span></>}
              </div>
            </div>
          )}
          {lead.unit_notes && <div className="card"><h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2><p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.unit_notes}</p></div>}
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3"><span className="text-gray-400 w-20">Source</span><span className="text-gray-700">{lead.source ?? "—"}</span></div>
            <div className="flex gap-3"><span className="text-gray-400 w-20">Assigned</span><span className="text-gray-700">{agentName ?? <span className="text-gray-400 italic">Unassigned</span>}</span></div>
            <div className="flex gap-3"><span className="text-gray-400 w-20">Added</span><span className="text-gray-700">{lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
          </div>
        </div>
      </div>

      {editing && <LeadModal lead={lead} users={users} onClose={() => setEditing(false)} onSave={async (data) => { const u = await updateCreditHealthLead(lead.id, data); onUpdate(u); setEditing(false); }} />}
    </div>
  );
}

export default function CreditHealthLeads() {
  const [leads, setLeads] = useState<CreditHealthLead[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<CreditHealthLead | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [l, u] = await Promise.all([getCreditHealthLeads({ status: statusFilter || undefined }), getSalesUsers()]);
      setLeads(l); setUsers(u); setPage(1);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  if (viewingLead) return <CreditHealthLeadDetail lead={viewingLead} users={users} onBack={() => setViewingLead(null)} onUpdate={(u) => { setLeads((p) => p.map((l) => l.id === u.id ? u : l)); setViewingLead(u); }} />;

  const filtered = leads.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.phone ?? "").includes(search));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const agentName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div><h1 className="text-xl font-semibold text-gray-900">Leads</h1><p className="text-sm text-gray-500 mt-1">{filtered.length} of {leads.length} leads</p></div>
        <button className="btn btn-primary gap-1.5" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" />Capture lead</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input className="input-field pl-8" style={{ width: 220 }} placeholder="Search name, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <select className="input-field" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{CREDIT_HEALTH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {(search || statusFilter) && <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setStatusFilter(""); }}>Clear</button>}
      </div>

      {loading ? (
        <div className="card space-y-3 py-4">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12"><p className="text-sm text-gray-400">No leads yet.</p><button className="btn btn-primary mt-3" onClick={() => setShowAdd(true)}>Capture first lead</button></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-50 border-b border-gray-200">{["Name", "Employment", "Income", "Loan", "Source", "Assigned", "Status", "Added", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingLead(lead)}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">{getInitials(lead.name)}</div><div><p className="font-medium text-gray-900 leading-tight">{lead.name}</p>{lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}</div></div></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.employment_status ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-medium">{formatCurrency(lead.monthly_income)}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-medium">{formatCurrency(lead.loan_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{agentName(lead.assigned_to_user_id) ?? <span className="text-amber-600">Unassigned</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.unit_status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—"}</td>
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
          <div className="flex gap-2"><button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div>
        </div>
      )}

      {showAdd && <LeadModal users={users} onClose={() => setShowAdd(false)} onSave={async (data) => { await createCreditHealthLead(data as CreditHealthLead); await fetchLeads(); setShowAdd(false); }} />}
    </div>
  );
}
