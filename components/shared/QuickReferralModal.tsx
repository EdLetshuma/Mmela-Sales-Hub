"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { checkDuplicateLeads } from "@/lib/sales-api";
import DuplicateLeadWarning, { type DuplicateLead } from "@/components/shared/DuplicateLeadWarning";
import { X, CheckCircle } from "lucide-react";

const SELF_ASSIGN_ROLES = ["Sales Agent", "Team Leader", "Concierge Agent", "Credit Health Agent"];
const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof"];
const SEGMENTS = ["Individual", "Commercial"];
const UNITS: Record<string, string> = {
  "75299d6f-408d-4f5c-8e91-63ac5d965866": "Insurance Sales",
  "07cb16ec-34bb-4731-a5b2-94cf33ce85a5": "Concierge",
  "62a86026-af4f-47c2-8498-d1c3bb0a1ad3": "Credit Health",
};

interface Props {
  onClose: () => void;
}

export default function QuickReferralModal({ onClose }: Props) {
  const { user } = useAuth();
  const isSelfAssign = user && SELF_ASSIGN_ROLES.includes(user.role);

  // Pre-select unit based on role
  const defaultUnit =
    user?.role === "Concierge Agent"     ? "07cb16ec-34bb-4731-a5b2-94cf33ce85a5" :
    user?.role === "Credit Health Agent" ? "62a86026-af4f-47c2-8498-d1c3bb0a1ad3" :
    "75299d6f-408d-4f5c-8e91-63ac5d965866"; // Default: Sales

  const [form, setForm] = useState({
    title: "",
    name: "",
    email: "",
    phone: "",
    segment: "Individual",
    referred_by: user?.name ?? "",
    notes: "",
    business_unit_id: defaultUnit,
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [pendingSave, setPendingSave] = useState(false);

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }

    // Check for duplicates before saving
    const rawPhone = form.phone.trim() || null;
    const rawEmail = form.email.trim() || null;
    const dupes = await checkDuplicateLeads(rawPhone, rawEmail);
    if (dupes.length > 0) {
      setDuplicates(dupes);
      setPendingSave(true);
      return;
    }

    await doSave();
  }

  async function doSave() {
    setSaving(true); setError(null);
    const rawName = form.title ? `${form.title} ${form.name.trim()}` : form.name.trim();
    const { error: dbErr } = await supabase.from("leads").insert({
      name: rawName,
      email: form.email.trim() || `no-email-${Date.now()}@placeholder.com`,
      phone: form.phone.trim() || null,
      segment: form.segment,
      referred_by: form.referred_by.trim() || null,
      notes: form.notes.trim() || null,
      source: "Referral",
      source_type: "referral_portal",
      status: "Prospect",
      business_unit_id: form.business_unit_id || null,
      assigned_to_user_id: isSelfAssign ? (user?.id ?? null) : null,
    });
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    setDuplicates([]); setPendingSave(false);
    setDone(true);
  }

  if (pendingSave && duplicates.length > 0) {
    return (
      <DuplicateLeadWarning
        duplicates={duplicates}
        newName={form.title ? `${form.title} ${form.name}` : form.name}
        onProceed={doSave}
        onCancel={() => { setDuplicates([]); setPendingSave(false); }}
        onViewExisting={(id) => { onClose(); window.location.href = `/?lead=${id}`; }}
        saving={saving}
      />
    );
  }

  if (done) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }} onClick={onClose}>
        <div className="card text-center" style={{ maxWidth: 380, width: "100%", margin: 16 }} onClick={e => e.stopPropagation()}>
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#27500A" }} />
          <p className="text-base font-semibold text-gray-900 mb-1">Referral captured</p>
          <p className="text-sm text-gray-500 mb-4">
            {isSelfAssign
              ? "The lead has been added and assigned to you."
              : "The lead has been added to the distribution queue for routing."}
          </p>
          <button className="btn btn-primary w-full" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 500, maxHeight: "92vh", background: "#fff", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Add referral</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isSelfAssign
                  ? "This lead will be assigned to you."
                  : "This lead will go to the distribution queue for routing."}
              </p>
            </div>
            <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Form */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {error && (
            <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>
          )}
          <form id="referral-form" onSubmit={handleSubmit} className="space-y-4">

            {/* Name */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Title</label>
                <select className="input-field" value={form.title} onChange={e => set("title", e.target.value)}>
                  <option value="">—</option>
                  {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
                <input className="input-field" placeholder="e.g. Sipho Dlamini" value={form.name} onChange={e => set("name", e.target.value)} required />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input className="input-field" type="email" placeholder="email@example.com" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <input className="input-field" placeholder="0821234567" value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
            </div>

            {/* Segment + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Segment</label>
                <select className="input-field" value={form.segment} onChange={e => set("segment", e.target.value)}>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Business unit</label>
                <select className="input-field" value={form.business_unit_id} onChange={e => set("business_unit_id", e.target.value)}>
                  {Object.entries(UNITS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
            </div>

            {/* Referred by */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Referred by</label>
              <input className="input-field" placeholder="Who referred this lead?" value={form.referred_by} onChange={e => set("referred_by", e.target.value)} />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes <span className="text-gray-400">(optional)</span></label>
              <textarea className="input-field" rows={2} placeholder="Product interest, background, context…" value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize: "none" }} />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button form="referral-form" type="submit" className="btn btn-primary flex-1" disabled={saving}>
            {saving ? "Saving…" : "Add referral"}
          </button>
        </div>
      </div>
    </div>
  );
}
