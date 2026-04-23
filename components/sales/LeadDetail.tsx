"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, UserCheck } from "lucide-react";
import { getLead, updateLead, convertLeadToClient, getSalesUsers, assignLead, type SalesLead, type SalesUser } from "@/lib/sales-api";
import { getSystemSettings, type SystemSettings } from "@/lib/settings-api";
import QuoteModal, { type SavedQuote, type QuoteFormData } from "@/components/sales/QuoteModal";
import AcceptQuoteModal from "@/components/sales/AcceptQuoteModal";
import LostReasonModal from "@/components/sales/LostReasonModal";
import AppointmentModal from "@/components/sales/AppointmentModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserSpecialization } from "@/types";

interface LeadDetailProps {
  leadId: string;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

const STATUSES = ["Prospect", "Contacted", "Quoted", "Won", "Lost"];

// Status flow order (index = rank)
const STATUS_RANK: Record<string, number> = {
  Prospect: 0, Contacted: 1, Quoted: 2, Won: 3, Lost: 4,
};

// Which transitions are allowed from each status
// Rules:
//   - Can always move forward in the pipeline
//   - Can always mark Lost from any status
//   - If Lost, can only re-open to Contacted (re-engage)
//   - Cannot go back to Prospect once Quoted or Won
//   - Cannot go to Won without at least one accepted quote
function getAllowedTransitions(current: string, hasAcceptedQuote: boolean): string[] {
  if (current === "Won") return ["Lost"];          // Won is terminal except for loss
  if (current === "Lost") return ["Contacted"];    // Can only re-engage, not restart
  const currentRank = STATUS_RANK[current] ?? 0;
  return STATUSES.filter(s => {
    if (s === current) return false;               // Already this status
    if (s === "Lost") return true;                 // Always can lose
    if (s === "Prospect" && currentRank >= 2) return false; // No back to Prospect once Quoted
    if (s === "Contacted" && currentRank >= 3) return false; // No back to Contacted once Won
    if (s === "Won" && !hasAcceptedQuote) return false; // Need accepted quote to Win
    return true;
  });
}

function getStatusTooltip(target: string, current: string, hasAcceptedQuote: boolean): string {
  if (target === "Won" && !hasAcceptedQuote) return "Requires an accepted quote first";
  if (target === "Prospect" && STATUS_RANK[current] >= 2) return "Cannot return to Prospect once Quoted";
  if (target === "Contacted" && current === "Won") return "Cannot return to Contacted from Won";
  return "";
}

function getInitials(name: string) {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function isPlaceholderEmail(email: string) {
  return email.includes("@placeholder.com");
}

function extractFromNotes(notes: string | undefined, key: string): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(new RegExp(`${key}:\\s*(.*)`, "i"));
  return match ? match[1].trim() : undefined;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="flex gap-4 py-2" style={{ borderBottom: "1px solid #F1F3F5" }}>
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-900 break-words">{value}</span>
    </div>
  );
}

function QuoteBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Pending: { bg: "#FAEEDA", color: "#633806" },
    Accepted: { bg: "#EAF3DE", color: "#27500A" },
    Rejected: { bg: "#FCEBEB", color: "#791F1F" },
  };
  const s = map[status] ?? map.Pending;
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

export default function LeadDetail({ leadId, onBack, onNavigate }: LeadDetailProps) {
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Segment awareness
  const { user } = useAuth();
  const isCommercial = lead?.segment === "Commercial";
  const canSeeAppointments =
    isCommercial &&
    (user?.specialization === UserSpecialization.Commercial ||
     user?.specialization === UserSpecialization.Both);

  // Modals
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SavedQuote | undefined>();
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [acceptingQuote, setAcceptingQuote] = useState<SavedQuote | null>(null);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [converting, setConverting] = useState(false);
  const [apptModalOpen, setApptModalOpen] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SalesLead>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getLead(leadId), getSalesUsers(), getSystemSettings()])
      .then(([l, u, s]) => { setLead(l); setUsers(u); setSettings(s); })
      .catch(() => setError("Failed to load lead."))
      .finally(() => setLoading(false));
  }, [leadId]);

  async function refreshLead() {
    const l = await getLead(leadId);
    setLead(l);
  }

  // Derived: quotes and accepted quote check
  // Quotes stored in lead.quotes (jsonb array)
  const quotes: SavedQuote[] = (lead?.quotes as SavedQuote[]) ?? [];
  const hasAcceptedQuote = quotes.some(q => q.status === "accepted");

  async function handleStatusChange(status: string) {
    if (!lead) return;
    const allowed = getAllowedTransitions(lead.status ?? "Prospect", hasAcceptedQuote);
    if (!allowed.includes(status)) return;
    if (status === "Lost") { setLostModalOpen(true); return; }
    const updated = await updateLead(lead.id, { status });
    setLead(updated);
  }

  async function handleLostSave(reason: string, notes: string) {
    if (!lead) return;
    const updated = await updateLead(lead.id, {
      status: "Lost",
      loss_reason: reason,
      notes: notes || lead.notes,
    });
    setLead(updated);
    setLostModalOpen(false);
  }

  async function handleSaveQuote(data: QuoteFormData) {
    if (!lead) return;
    if (editingQuote) {
      const updated = quotes.map((q) =>
        q.id === editingQuote.id ? { ...q, ...data } : q
      );
      const l = await updateLead(lead.id, { quotes: updated as unknown as SalesLead["quotes"] });
      setLead(l);
    } else {
      const newQuote: SavedQuote = {
        ...data,
        id: `Q${Date.now()}`,
        status: "Pending",
        createdAt: new Date().toISOString(),
      };
      const payload: Partial<SalesLead> = {
        quotes: [...quotes, newQuote] as unknown as SalesLead["quotes"],
      };
      if (lead.segment === "Commercial") payload.status = "Quoted";
      const l = await updateLead(lead.id, payload);
      setLead(l);
    }
    setEditingQuote(undefined);
  }

  async function handleAcceptQuote(quote: SavedQuote) {
    if (!lead) return;
    const updated = quotes.map((q) =>
      q.id === quote.id ? { ...q, status: "Accepted" as const } : q
    );
    const l = await updateLead(lead.id, {
      quotes: updated as unknown as SalesLead["quotes"],
      status: "Won",
    });
    setLead(l);
    setAcceptModalOpen(false);
    setAcceptingQuote(null);
  }

  async function handleRejectQuote(quoteId: string) {
    if (!lead) return;
    const updated = quotes.map((q) =>
      q.id === quoteId ? { ...q, status: "Rejected" as const } : q
    );
    const l = await updateLead(lead.id, { quotes: updated as unknown as SalesLead["quotes"] });
    setLead(l);
  }

  async function handleConvert() {
    if (!lead) return;
    setConverting(true);
    try {
      await convertLeadToClient(lead.id);
      setConvertConfirm(false);
      onNavigate("/sales/clients");
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  }

  async function handleSaveEdit() {
    if (!lead) return;
    setSaving(true);
    try {
      const l = await updateLead(lead.id, editForm);
      setLead(l);
      setEditing(false);
      setEditForm({});
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(userId: string) {
    if (!lead || !userId) return;
    await assignLead(lead.id, userId);
    await refreshLead();
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
      <div className="card h-40 animate-pulse bg-gray-50" />
    </div>
  );

  if (error || !lead) return (
    <div className="card text-center py-12">
      <p className="text-sm text-red-500">{error ?? "Lead not found."}</p>
      <button className="btn btn-secondary mt-3" onClick={onBack}>Go back</button>
    </div>
  );

  const agentName = users.find((u) => u.id === lead.assigned_to_user_id)?.name ?? null;
  const displayEmail = isPlaceholderEmail(lead.email) ? null : lead.email;
  const displayIdNumber = lead.notes ? extractFromNotes(lead.notes, "ID Number") : undefined;
  const displayDob = lead.notes ? extractFromNotes(lead.notes, "Date of Birth") : undefined;
  const productInterest = lead.source === "Referral" ? extractFromNotes(lead.notes, "Product Interest") : undefined;
  const isTerminal = lead.status === "Won" || lead.status === "Lost";
  const isConverted = !!lead.client_id;
  const canConvert = lead.status === "Won" && !isConverted;
  const schemeDetails = lead.scheme_details as Record<string, string> | null;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back to leads
      </button>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-sm font-semibold text-brand-800 flex-shrink-0">
              {getInitials(lead.name)}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">{lead.name}</h1>
              {displayEmail && <p className="text-sm text-gray-500 mt-0.5">{displayEmail}</p>}
              {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isConverted && (
              <>
                <span className="badge" style={{ background: "#EAF3DE", color: "#27500A" }}>
                  <UserCheck className="w-3 h-3 mr-1" /> Converted to client
                </span>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => onNavigate(`/sales/clients?id=${lead.client_id}`)}
                >
                  View client profile →
                </button>
              </>
            )}
            {canConvert && (
              <button className="btn btn-primary text-xs" onClick={() => setConvertConfirm(true)}>
                Convert to client
              </button>
            )}
            {!editing && (
              <button
                className="btn btn-secondary text-xs"
                onClick={() => {
                  setEditForm({ name: lead.name, email: displayEmail ?? "", phone: lead.phone ?? "", notes: lead.notes ?? "", referred_by: lead.referred_by ?? "" });
                  setEditing(true);
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Loss banner */}
        {lead.status === "Lost" && lead.loss_reason && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "#FCEBEB", borderLeft: "4px solid #A32D2D" }}>
            <p className="text-sm font-medium" style={{ color: "#791F1F" }}>
              Reason for loss: {lead.loss_reason}
            </p>
          </div>
        )}

        {/* Status selector */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid #F1F3F5" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Change status</span>
            {lead.status === "Won" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#EAF3DE", color: "#27500A" }}>
                Won — only loss is possible from here
              </span>
            )}
            {lead.status === "Lost" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#FCEBEB", color: "#791F1F" }}>
                Lost — can re-engage to Contacted
              </span>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map((s) => {
              const isCurrent = lead.status === s;
              const allowed = getAllowedTransitions(lead.status ?? "Prospect", hasAcceptedQuote);
              const isAllowed = allowed.includes(s);
              const tooltip = getStatusTooltip(s, lead.status ?? "Prospect", hasAcceptedQuote);

              return (
                <button
                  key={s}
                  onClick={() => isAllowed && handleStatusChange(s)}
                  disabled={!isAllowed && !isCurrent}
                  title={tooltip || undefined}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                  style={
                    isCurrent
                      ? { background: "#1A348C", color: "#fff", borderColor: "#1A348C" }
                      : isAllowed
                      ? { background: "#fff", color: "#374151", borderColor: "#D1D5DB", cursor: "pointer" }
                      : { background: "#F8F9FB", color: "#D1D5DB", borderColor: "#E5E7EB", cursor: "not-allowed", textDecoration: "line-through" }
                  }
                >
                  {s}
                  {!isAllowed && !isCurrent && tooltip && (
                    <span style={{ fontSize: 9, marginLeft: 4, color: "#F5A623" }}>⚠</span>
                  )}
                </button>
              );
            })}
          </div>
          {!hasAcceptedQuote && (lead.status === "Contacted" || lead.status === "Quoted") && (
            <p className="text-[10px] text-amber-600 mt-2">
              ⚠ Accept a quote to unlock Won status
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left col: details / edit + quotes */}
        <div className="col-span-2 space-y-4">
          {editing ? (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Edit lead</h2>
              {([
                { key: "name", label: "Full name", type: "text" },
                { key: "email", label: "Email", type: "email" },
                { key: "phone", label: "Phone", type: "text" },
                { key: "referred_by", label: "Referred by", type: "text" },
              ] as { key: keyof SalesLead; label: string; type: string }[]).map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    className="input-field"
                    type={type}
                    value={(editForm[key] as string) ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* Commercial-only edit fields */}
              {isCommercial && (
                <>
                  <div style={{ borderTop: "1px solid #F1F3F5", paddingTop: 12 }}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Company details</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Company name</label>
                    <input
                      className="input-field"
                      type="text"
                      value={(editForm as Record<string, string>).company_name ?? (lead.company_name ?? "")}
                      onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value } as Partial<SalesLead>))}
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">Primary contact person</p>
                  {[
                    { key: "pc_name",  label: "Contact name"  },
                    { key: "pc_title", label: "Title / role"  },
                    { key: "pc_phone", label: "Direct phone"  },
                    { key: "pc_email", label: "Direct email"  },
                  ].map(({ key, label }) => {
                    const pcKey = key.replace("pc_", "") as string;
                    const pcVal = ((lead.primary_contact as Record<string, string> | null)?.[pcKey]) ?? "";
                    return (
                      <div key={key}>
                        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                        <input
                          className="input-field"
                          type="text"
                          defaultValue={pcVal}
                          onChange={(e) => {
                            const current = (editForm as Record<string, unknown>).primary_contact as Record<string, string> ?? {};
                            setEditForm((f) => ({ ...f, primary_contact: { ...current, [pcKey]: e.target.value } } as Partial<SalesLead>));
                          }}
                        />
                      </div>
                    );
                  })}
                </>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea
                  className="input-field"
                  rows={4}
                  value={editForm.notes ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button className="btn btn-primary" disabled={saving} onClick={handleSaveEdit}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditForm({}); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Details</h2>
              <FieldRow label="Source"     value={lead.source} />
              <FieldRow label="Segment"    value={lead.segment} />
              <FieldRow label="Referred by" value={lead.referred_by} />
              <FieldRow label="Campaign"   value={lead.campaign} />
              {/* Commercial: company + primary contact */}
              {isCommercial && (
                <>
                  <FieldRow label="Company"   value={(lead as Record<string, unknown>).company_name as string} />
                  {lead.primary_contact && (
                    <div className="mt-3 p-3 rounded-lg space-y-1" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Primary contact</p>
                      <FieldRow label="Name"  value={(lead.primary_contact as Record<string, string>).name} />
                      <FieldRow label="Title" value={(lead.primary_contact as Record<string, string>).title} />
                      <FieldRow label="Phone" value={(lead.primary_contact as Record<string, string>).phone} />
                      <FieldRow label="Email" value={(lead.primary_contact as Record<string, string>).email} />
                    </div>
                  )}
                </>
              )}
              <FieldRow label="ID number" value={displayIdNumber} />
              <FieldRow label="Date of birth" value={displayDob} />
              {productInterest && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: "#EEF4FD" }}>
                  <p className="text-xs text-gray-500 mb-0.5">Product interest</p>
                  <p className="text-sm font-medium text-brand-800">{productInterest}</p>
                </div>
              )}
            </div>
          )}

          {/* Scheme / asset details */}
          {schemeDetails && Object.keys(schemeDetails).length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Asset & scheme details</h2>
              {Object.entries(schemeDetails).map(([k, v]) =>
                v ? <FieldRow key={k} label={k.replace(/_/g, " ")} value={String(v)} /> : null
              )}
            </div>
          )}

          {/* Appointment — Commercial only */}
          {canSeeAppointments && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Appointment</h2>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => setApptModalOpen(true)}
                >
                  {lead.appointment_details ? "Edit appointment" : "+ Schedule appointment"}
                </button>
              </div>
              {lead.appointment_details ? (
                <>
                  <FieldRow label="Date"     value={(lead.appointment_details as unknown as Record<string, string>).date} />
                  <FieldRow label="Time"     value={(lead.appointment_details as unknown as Record<string, string>).time} />
                  <FieldRow label="Location" value={(lead.appointment_details as unknown as Record<string, string>).location} />
                  {(lead.appointment_details as unknown as Record<string, string>).outcome && (
                    <div className="mt-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: "#EAF3DE", color: "#27500A" }}>
                      Outcome: {(lead.appointment_details as unknown as Record<string, string>).outcome}
                    </div>
                  )}
                  {(lead.appointment_details as unknown as Record<string, string>).notes && (
                    <FieldRow label="Notes" value={(lead.appointment_details as unknown as Record<string, string>).notes} />
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">No appointment scheduled yet.</p>
              )}
            </div>
          )}

          {/* Quotations panel */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <h2 className="text-sm font-semibold text-gray-900">
                Quotations ({quotes.length})
              </h2>
              {!isTerminal && settings && (
                <button
                  className="btn btn-primary text-xs gap-1"
                  onClick={() => { setEditingQuote(undefined); setQuoteModalOpen(true); }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add quote
                </button>
              )}
            </div>

            {quotes.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No quotes yet.</p>
                {!isTerminal && (
                  <button
                    className="btn btn-secondary mt-3 text-xs"
                    onClick={() => { setEditingQuote(undefined); setQuoteModalOpen(true); }}
                  >
                    Add first quote
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...quotes].reverse().map((quote) => {
                  const total = (quote.basePremium || 0) + (quote.vaps || []).reduce((s, v) => s + v.premium, 0);
                  return (
                    <div key={quote.id} className="px-5 py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{quote.underwriter}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {quote.productCategory}: {quote.productName}
                          </p>
                          {quote.quoteNumber && (
                            <p className="text-xs text-gray-400 mt-0.5">Ref: {quote.quoteNumber}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-brand-900">
                            R {total.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <QuoteBadge status={quote.status} />
                        </div>
                      </div>

                      {/* VAPs */}
                      {(quote.vaps ?? []).length > 0 && (
                        <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid #F1F3F5" }}>
                          <p className="text-xs font-medium text-gray-500">Value-added products</p>
                          {quote.vaps.map((v) => (
                            <div key={v.id} className="flex justify-between text-xs text-gray-500">
                              <span>
                                {v.name}
                                {v.underwriter && (
                                  <span className="text-gray-400 ml-1">({v.underwriter})</span>
                                )}
                              </span>
                              <span>+ R {v.premium.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {quote.status === "Pending" && !isTerminal && (
                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                          <button
                            className="btn btn-secondary text-xs"
                            onClick={() => { setEditingQuote(quote); setQuoteModalOpen(true); }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-primary text-xs"
                            style={{ background: "#0F6E56" }}
                            onClick={() => { setAcceptingQuote(quote); setAcceptModalOpen(true); }}
                          >
                            Accept
                          </button>
                          <button
                            className="btn text-xs text-red-600 border border-red-200 hover:bg-red-50"
                            onClick={() => handleRejectQuote(quote.id)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Assignment */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Assigned to</h2>
            {agentName ? (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800">
                  {getInitials(agentName)}
                </div>
                <span className="text-sm text-gray-900">{agentName}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">Unassigned</p>
            )}
            <select
              className="input-field text-xs"
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleAssign(e.target.value); }}
            >
              <option value="">Reassign…</option>
              {users
                .filter((u) => ["Sales Agent", "Team Leader", "Manager"].includes(u.role))
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
            </select>
          </div>

          {/* Notes */}
          {lead.notes && !editing && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {settings && (
        <QuoteModal
          isOpen={quoteModalOpen}
          onClose={() => { setQuoteModalOpen(false); setEditingQuote(undefined); }}
          onSave={handleSaveQuote}
          subjectName={lead.name}
          prefillIdNumber={displayIdNumber}
          quoteToEdit={editingQuote}
          settings={settings}
        />
      )}

      {acceptingQuote && (
        <AcceptQuoteModal
          isOpen={acceptModalOpen}
          onClose={() => { setAcceptModalOpen(false); setAcceptingQuote(null); }}
          onConfirm={() => handleAcceptQuote(acceptingQuote)}
          onEditClient={() => { setAcceptModalOpen(false); setEditing(true); setEditForm({ name: lead.name, email: displayEmail ?? "", phone: lead.phone ?? "" }); }}
          onEditQuote={() => { setAcceptModalOpen(false); setEditingQuote(acceptingQuote); setQuoteModalOpen(true); }}
          leadName={lead.name}
          leadPhone={lead.phone}
          leadEmail={lead.email}
          leadIdNumber={displayIdNumber}
          quote={acceptingQuote}
        />
      )}

      <LostReasonModal
        isOpen={lostModalOpen}
        onClose={() => setLostModalOpen(false)}
        onSave={handleLostSave}
        leadName={lead.name}
      />

      {/* Appointment modal — Commercial leads only */}
      {canSeeAppointments && (
        <AppointmentModal
          isOpen={apptModalOpen}
          clientName={lead.name}
          existing={lead.appointment_details as unknown as Record<string, string> | null ?? undefined}
          onClose={() => setApptModalOpen(false)}
          onSave={async (details) => {
            const updated = await updateLead(lead.id, { appointment_details: details as unknown as SalesLead["appointment_details"] });
            setLead(updated);
            setApptModalOpen(false);
          }}
        />
      )}

      {convertConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setConvertConfirm(false)}
        >
          <div className="card" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Convert to client?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will create a new client record for <strong>{lead.name}</strong> and mark this lead as Won.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setConvertConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={converting} onClick={handleConvert}>
                {converting ? "Converting…" : "Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}