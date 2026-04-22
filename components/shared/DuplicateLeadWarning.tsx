"use client";

import React from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

export interface DuplicateLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface DuplicateLeadWarningProps {
  duplicates: DuplicateLead[];
  newName: string;
  onProceed: () => void;       // Save anyway
  onCancel: () => void;        // Go back and fix
  onViewExisting: (id: string) => void; // Navigate to existing lead
  saving?: boolean;
}

function statusStyle(status: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    Won:       { bg: "#EAF3DE", color: "#27500A" },
    Active:    { bg: "#EAF3DE", color: "#27500A" },
    Lost:      { bg: "#FCEBEB", color: "#791F1F" },
    Quoted:    { bg: "#EEF4FD", color: "#1A348C" },
    Contacted: { bg: "#FAEEDA", color: "#633806" },
    Prospect:  { bg: "#F1F3F5", color: "#444441" },
  };
  return map[status] ?? { bg: "#F1F3F5", color: "#444441" };
}

export default function DuplicateLeadWarning({
  duplicates,
  newName,
  onProceed,
  onCancel,
  onViewExisting,
  saving,
}: DuplicateLeadWarningProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 80, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, maxWidth: 520, width: "100%",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
          <div className="flex items-start gap-3">
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "#854F0B" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Possible duplicate detected</p>
              <p className="text-xs text-gray-500 mt-0.5">
                A lead matching <strong>{newName}</strong>'s phone or email already exists in the system.
                Review before saving to avoid duplicate records.
              </p>
            </div>
            <button className="btn btn-ghost p-1 ml-auto" onClick={onCancel}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Existing records */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Existing record{duplicates.length > 1 ? "s" : ""} found
          </p>
          <div className="space-y-2">
            {duplicates.map((dup) => {
              const st = statusStyle(dup.status);
              return (
                <div key={dup.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{dup.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>
                          {dup.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {dup.phone && <p className="text-xs text-gray-500">{dup.phone}</p>}
                        {dup.email && !dup.email.includes("@placeholder.com") && (
                          <p className="text-xs text-gray-500">{dup.email}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Source: {dup.source ?? "—"} · Agent: {dup.assigned_to ?? "Unassigned"}
                      </p>
                    </div>
                    <button
                      onClick={() => onViewExisting(dup.id)}
                      className="btn btn-secondary text-xs gap-1 whitespace-nowrap flex-shrink-0"
                      style={{ fontSize: 11 }}
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Decision guidance */}
          <div style={{ background: "#F8F9FB", borderRadius: 8, padding: "10px 12px", marginTop: 14 }}>
            <p className="text-xs text-gray-600">
              <strong>If this is the same person:</strong> open the existing lead and update it instead of creating a new one.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>If this is a different person:</strong> proceed — the system will save this as a separate lead.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn btn-secondary flex-1" onClick={onCancel}>
            Go back
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={onProceed}
            disabled={saving}
            style={{ background: "#854F0B", borderColor: "#854F0B" }}
          >
            {saving ? "Saving…" : "Save anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
