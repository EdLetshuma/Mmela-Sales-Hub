"use client";

import React, { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { SalesPolicy } from "@/lib/sales-api";

interface PolicyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: SalesPolicy;
  clientName: string;
  onEdit: () => void;
  onUpdatePolicy: (updates: Partial<SalesPolicy>) => Promise<void>;
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

export default function PolicyDetailModal({
  isOpen,
  onClose,
  policy,
  clientName,
  onEdit,
  onUpdatePolicy,
}: PolicyDetailModalProps) {
  const [tab, setTab] = useState<Tab>("details");
  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState(policy.document_link ?? "");
  const [savingLink, setSavingLink] = useState(false);

  async function handleSaveLink() {
    setSavingLink(true);
    try {
      await onUpdatePolicy({
        document_link: linkValue,
        documentation_status: "Complete",
      });
      setEditingLink(false);
      onClose();
    } finally {
      setSavingLink(false);
    }
  }

  async function handleRemoveLink() {
    if (!window.confirm("Remove this document link?")) return;
    await onUpdatePolicy({ document_link: undefined, documentation_status: "Pending" });
    setLinkValue("");
    setEditingLink(false);
    onClose();
  }

  const retentionDetails = policy.retention_details as Record<string, string> | null;
  const vaps = (policy.vaps as { id: string; name: string; premium: number; underwriter?: string }[]) ?? [];
  const docCount = (policy.documents as unknown[])?.length ?? 0;

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="badge" style={{ background: "#EEF4FD", color: "#1A348C", marginBottom: 6, display: "inline-block" }}>Policy</span>
            <h2 className="text-xl font-semibold text-gray-900 font-mono">{policy.policy_number}</h2>
            <p className="text-xs text-gray-400 mt-0.5">for {clientName}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs" onClick={onEdit}>Edit</button>
            <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
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

        {/* Tab content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {tab === "details" && (
            <div>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <DetailRow label="Status" value={undefined} />
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

              {/* VAPs */}
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

              {/* Retention details */}
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

          {tab === "documents" && (
            <div className="space-y-4">
              {/* SharePoint link */}
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
                    <div className="flex gap-2 flex-shrink-0">
                      <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setEditingLink(true)}>Edit</button>
                      <button className="text-xs text-red-500 hover:text-red-700" onClick={handleRemoveLink}>Remove</button>
                      <a href={policy.document_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-xs py-1 px-2">View</a>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Legacy uploaded docs */}
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
        </div>

        <div className="flex justify-end mt-4 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
