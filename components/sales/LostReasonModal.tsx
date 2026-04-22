"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

const LOSS_REASONS = [
  "Price",
  "Competitor Offer",
  "Not Interested",
  "Uncontactable",
  "Service Quality",
  "Other",
];

interface LostReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reason: string, notes: string) => void;
  leadName: string;
}

export default function LostReasonModal({
  isOpen,
  onClose,
  onSave,
  leadName,
}: LostReasonModalProps) {
  const [reason, setReason] = useState("Other");
  const [notes, setNotes] = useState("");

  function handleSave() {
    onSave(reason, notes);
    setReason("Other");
    setNotes("");
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Reason for loss</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Please provide a reason for marking "{leadName}" as lost.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason category</label>
            <select
              className="input-field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Additional notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Competitor offered a lower premium…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save reason
          </button>
        </div>
      </div>
    </div>
  );
}
