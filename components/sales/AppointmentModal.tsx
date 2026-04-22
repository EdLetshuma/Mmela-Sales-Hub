"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { X } from "lucide-react";

export interface AppointmentDetails {
  date: string;
  time: string;
  location: string;
  outcome?: string;
  notes?: string;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: AppointmentDetails) => void;
  clientName: string;
  existing?: AppointmentDetails;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  clientName,
  existing,
}: AppointmentModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<AppointmentDetails>(
    existing ?? { date: today, time: "", location: "" }
  );

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Schedule appointment</h2>
            <p className="text-xs text-gray-400 mt-0.5">For: {clientName}</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input className="input-field" type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Time</label>
              <input className="input-field" type="time" name="time" value={form.time} onChange={handleChange} required />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Location</label>
            <input className="input-field" name="location" value={form.location} onChange={handleChange} required placeholder="e.g. Client office, Zoom link" />
          </div>
          {existing && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Outcome</label>
                <input className="input-field" name="outcome" value={form.outcome ?? ""} onChange={handleChange} placeholder="e.g. Client interested, follow up next week" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <textarea className="input-field" name="notes" rows={3} value={form.notes ?? ""} onChange={handleChange} placeholder="Additional meeting notes…" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save appointment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
