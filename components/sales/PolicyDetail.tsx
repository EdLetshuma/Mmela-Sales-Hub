"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPolicy, getClient, updatePolicy, type SalesPolicy } from "@/lib/sales-api";
import { useAuth } from "@/components/providers/AuthProvider";
import { Permission } from "@/types";
import CancelPolicyModal from "@/components/sales/CancelPolicyModal";

interface PolicyDetailProps {
  policyId: string;
  onBack: () => void;
}

type Tab = "details" | "documents";

function formatCurrency(val?: number | string | null) {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-4 py-2" style={{ borderBottom: "1px solid #F1F3F5" }}>
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
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

export default function PolicyDetail({ policyId, onBack }: PolicyDetailProps) {
  const { user } = useAuth();
  const canEdit = user?.role === "Admin" || (user?.permissions ?? []).includes(Permission.EditPolicies);

  const [policy, setPolicy] = useState<SalesPolicy | null>(null);
  const [clientName, setClientName] = useState<string>("—");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SalesPolicy>>({});
  const [saving, setSaving] = useState(false);

  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPolicy(policyId)
      .then(async (p) => {
        setPolicy(p);
        setLinkValue(p?.document_link ?? "");
        if (p?.client_id) {
          const c = await getClient(p.client_id);
          setClientName(c?.name ?? "—");
        }
      })
      .catch(() => setError("Failed to load policy."))
      .finally(() => setLoading(false));
  }, [policyId]);

  async function applyUpdate(updates: Partial<SalesPolicy>) {
    if (!policy) return;
    const updated = await updatePolicy(policy.id, updates);
    setPolicy(updated);
    return updated;
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await applyUpdate(editForm);
      setEditing(false);
      setEditForm({});
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLink() {
    setSavingLink(true);
    try {
      await applyUpdate({ document_link: linkValue, documentation_status: "Complete" });
      setEditingLink(false);
    } finally {
      setSavingLink(false);
    }
  }

  async function handleRemoveLink() {
    if (!window.confirm("Remove this document link?")) return;
    await applyUpdate({ document_link: undefined, documentation_status: "Pending" });
    setLinkValue("");
    setEditingLink(false);
  }

  async function handleCancelPolicy(reason: string, notes: string) {
    if (!policy) return;
    setCancelling(true);
    try {
      const existingNotes = Array.isArray(policy.notes) ? policy.notes : [];
      await applyUpdate({
        status: "Canceled",
        cancellation_date: new Date().toISOString().slice(0, 10),
        notes: [
          ...existingNotes,
          {
            text: `Policy cancelled — ${reason}${notes ? `: ${notes}` : ""}`,
            timestamp: new Date().toISOString(),
          },
        ] as unknown as SalesPolicy["notes"],
      });
      setCancelModalOpen(false);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="card h-48 animate-pulse bg-gray-50" />
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error ?? "Policy not found."}</p>
        <button className="btn btn-secondary mt-3" onClick={onBack}>Go back</button>
      </div>
    );
  }

  const retentionDetails = policy.retention_details as Record<string, string> | null;
  const vaps = (policy.vaps as { id: string; name: string; premium: number; underwriter?: string }[]) ?? [];
  const docCount = (policy.documents as unknown[])?.length ?? 0;
  const canCancel = canEdit && (policy.status === "Active" || policy.status === "Pending");

  return (
    <div className="space-y-4">
      {/* Back */}
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back to policies
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <span className="badge" style={{ background: "#EEF4FD", color: "#1A348C", marginBottom: 6, display: "inline-block" }}>Policy</span>
            <h1 className="text-lg font-semibold text-gray-900 font-mono">{policy.policy_number}</h1>
            <p className="text-xs text-gray-400 mt-0.5">for {clientName}</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {!editing && (
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => {
                    setEditForm({
                      insurer: policy.insurer,
                      product_name: policy.product_name,
                      product_category: policy.product_category,
                      premium: policy.premium,
                      base_premium: policy.base_premium,
                      inception_date: policy.inception_date,
                      sale_date: policy.sale_date,
                    });
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              )}
              {canCancel && (
                <button
                  className="btn text-xs text-white"
                  style={{ background: "#A32D2D" }}
                  onClick={() => setCancelModalOpen(true)}
                >
                  Cancel policy
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
          {(["details", "documents"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors relative ${
                tab === t ? "text-brand-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              {t === "documents" && (
                <span className="ml-1.5 text-xs text-gray-400">({docCount + (policy.document_link ? 1 : 0)})</span>
              )}
              {tab === t && (
                <span style={{ position: "absolute", bottom: 0, left: 12, right: 12, height: 2, background: "#1A348C", borderRadius: 2 }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "details" && (
        <div className="card">
          {editing ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Edit policy</h2>
              {([
                { key: "insurer", label: "Insurer", type: "text" },
                { key: "product_name", label: "Product name", type: "text" },
                { key: "product_category", label: "Category", type: "text" },
                { key: "premium", label: "Premium", type: "number" },
                { key: "base_premium", label: "Base premium", type: "number" },
                { key: "inception_date", label: "Inception date", type: "date" },
                { key: "sale_date", label: "Sale date", type: "date" },
              ] as { key: keyof SalesPolicy; label: string; type: string }[]).map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    className="input-field"
                    type={type}
                    value={(editForm[key] as string | number) ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
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
            <div>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <div className="flex gap-4 py-2" style={{ borderBottom: "1px solid #F1F3F5" }}>
                    <span className="text-xs text-gray-400 w-36 flex-shrink-0 mt-0.5">Status</span>
                    <StatusBadge status={policy.status} />
                  </div>
                  <DetailRow label="Insurer" value={policy.insurer} />
                  <DetailRow label="Product" value={policy.product_name} />
                  <DetailRow label="Category" value={policy.product_category} />
                  <DetailRow label="Premium" value={formatCurrency(policy.premium)} />
                  <DetailRow label="Base premium" value={formatCurrency(policy.base_premium)} />
                </div>
                <div>
                  <DetailRow label="Inception date" value={policy.inception_date ?? undefined} />
                  <DetailRow label="Sale date" value={policy.sale_date ?? undefined} />
                  {policy.cancellation_date && (
                    <DetailRow label="Cancellation date" value={policy.cancellation_date} />
                  )}
                  <DetailRow label="Client segment" value={policy.client_segment} />
                  <div className="flex gap-4 py-2" style={{ borderBottom: "1px solid #F1F3F5" }}>
                    <span className="text-xs text-gray-400 w-36 flex-shrink-0 mt-0.5">Docs status</span>
                    <span className="badge" style={
                      policy.documentation_status === "Complete"
                        ? { background: "#EAF3DE", color: "#27500A" }
                        : { background: "#FAEEDA", color: "#633806" }
                    }>
                      {policy.documentation_status ?? "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {vaps.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Value-added products</p>
                  <div className="space-y-1.5">
                    {vaps.map((v) => (
                      <div key={v.id} className="flex justify-between items-center py-1.5 px-3 rounded-lg" style={{ background: "#F8F9FB" }}>
                        <span className="text-sm text-gray-700">{v.name} {v.underwriter && <span className="text-xs text-gray-400">({v.underwriter})</span>}</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(v.premium)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {policy.status === "Canceled" && Array.isArray(policy.notes) && policy.notes.length > 0 && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: "#FCEBEB", border: "1px solid #F3B4B4" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#791F1F" }}>Cancellation reason</p>
                  <p className="text-xs" style={{ color: "#791F1F" }}>
                    {(policy.notes[policy.notes.length - 1] as { text?: string })?.text ?? "—"}
                  </p>
                </div>
              )}

              {policy.status === "Retained" && retentionDetails && (
                <div className="mt-4 p-3 rounded-lg" style={{ background: "#E1F5EE", border: "1px solid #9FE1CB" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#085041" }}>Retention details</p>
                  <p className="text-xs" style={{ color: "#085041" }}>
                    Retained on {new Date(retentionDetails.retainedAt).toLocaleDateString("en-ZA")}
                    {retentionDetails.retainedBy && ` · Previous policy: ${retentionDetails.previousPolicyNumber} · Previous premium: ${formatCurrency(retentionDetails.previousPremium)}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="card space-y-4">
          <div className="p-4 rounded-lg" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
            <p className="text-xs font-medium text-gray-700 mb-2">Policy document link</p>
            {policy.document_link && !editingLink ? (
              <div className="flex items-center justify-between gap-3">
                <a
                  href={policy.document_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-700 hover:underline truncate flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {policy.document_link}
                </a>
                {canEdit && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setEditingLink(true)}>Edit</button>
                    <button className="text-xs text-red-500 hover:text-red-700" onClick={handleRemoveLink}>Remove</button>
                    <a href={policy.document_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-xs py-1 px-2">View</a>
                  </div>
                )}
              </div>
            ) : canEdit ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  {editingLink ? "Edit the link below." : "Add the SharePoint or document URL to mark documentation as complete."}
                </p>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 text-xs"
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    placeholder="Paste SharePoint link here…"
                  />
                  <button className="btn btn-primary text-xs" disabled={!linkValue || savingLink} onClick={handleSaveLink}>
                    {savingLink ? "Saving…" : "Save"}
                  </button>
                  {editingLink && (
                    <button className="btn btn-secondary text-xs" onClick={() => setEditingLink(false)}>Cancel</button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No document link on record.</p>
            )}
          </div>

          {docCount > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Previously uploaded files</p>
              <div className="space-y-1.5">
                {(policy.documents as { id: string; name: string; url: string }[]).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#F8F9FB" }}>
                    <span className="text-xs text-gray-700 truncate">{doc.name}</span>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline ml-3 flex-shrink-0">View</a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CancelPolicyModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onSave={handleCancelPolicy}
        policyNumber={policy.policy_number}
        saving={cancelling}
      />
    </div>
  );
}
