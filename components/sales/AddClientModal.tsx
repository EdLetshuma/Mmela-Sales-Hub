"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { X } from "lucide-react";
import type { ClientSegment } from "@/types";

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string; email: string; phone?: string; id_number?: string;
    address?: string; segment: ClientSegment; title?: string; occupation?: string;
  }) => Promise<void>;
  segment: ClientSegment;
}

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof"];

export default function AddClientModal({ isOpen, onClose, onSave, segment }: AddClientModalProps) {
  const emptyForm = () => ({
    title: "", name: "", email: "", phone: "", id_number: "",
    address: "", occupation: "", segment,
  });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.title ? `${form.title} ${form.name.trim()}` : form.name.trim(),
        email: form.email.trim() || `no-email-${Date.now()}@placeholder.com`,
        phone: form.phone.trim() || undefined,
        id_number: form.id_number.trim() || undefined,
        address: form.address.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        segment: form.segment,
      });
      setForm(emptyForm());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add client</h2>
            <p className="text-xs text-gray-400 mt-0.5">Capture an existing or walk-in client directly — no lead required.</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <select className="input-field" name="title" value={form.title} onChange={handleChange}>
                <option value="">—</option>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
              <input className="input-field" name="name" value={form.name} onChange={handleChange} required placeholder="Client's full name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input className="input-field" type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <input className="input-field" name="phone" value={form.phone} onChange={handleChange} placeholder="e.g. 082 123 4567" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ID number</label>
              <input className="input-field" name="id_number" value={form.id_number} onChange={handleChange} placeholder="South African ID number" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Segment</label>
              <select className="input-field" name="segment" value={form.segment} onChange={handleChange}>
                <option value="Individual">Individual</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input className="input-field" name="address" value={form.address} onChange={handleChange} placeholder="Street, suburb, city" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Occupation <span className="text-gray-400">(optional)</span></label>
            <input className="input-field" name="occupation" value={form.occupation} onChange={handleChange} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim() || saving}>
              {saving ? "Adding…" : "Add client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
