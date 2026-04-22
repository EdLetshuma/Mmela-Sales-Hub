"use client";

import React, { useState, useEffect, useMemo, ChangeEvent, FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { SalesPolicy } from "@/lib/sales-api";
import type { SystemSettings } from "@/lib/settings-api";

export interface RetentionUpdateData {
  policyNumber: string;
  base_premium: number;
  vaps: { id: string; name: string; premium: number; underwriter?: string }[];
  inceptionDate: string;
  saleDate: string;
  insurer: string;
  premium: number;
}

interface RetainPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (originalPolicyId: string, data: RetentionUpdateData) => Promise<void>;
  policy: SalesPolicy;
  clientName: string;
  settings: SystemSettings;
  onViewClient: () => void;
}

export default function RetainPolicyModal({
  isOpen,
  onClose,
  onSave,
  policy,
  clientName,
  settings,
  onViewClient,
}: RetainPolicyModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const emptyForm = () => ({
    policyNumber: policy.policy_number ?? "",
    base_premium: Number(policy.base_premium ?? policy.premium ?? 0),
    vaps: ((policy.vaps as { id: string; name: string; premium: number; underwriter?: string }[]) ?? []).map(
      (v, i) => ({ ...v, id: v.id || `VAP_${i}` })
    ),
    inceptionDate: today,
    saleDate: today,
    insurer: policy.insurer ?? "",
  });

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(emptyForm());
  }, [isOpen, policy]);

  const totalPremium = useMemo(
    () => (form.base_premium || 0) + form.vaps.reduce((s, v) => s + (v.premium || 0), 0),
    [form.base_premium, form.vaps]
  );

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "base_premium" ? Number(value) : value,
    }));
  }

  function handleVapChange(id: string, field: "name" | "premium" | "underwriter", value: string | number) {
    setForm((prev) => ({
      ...prev,
      vaps: prev.vaps.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    }));
  }

  function addVap() {
    setForm((prev) => ({
      ...prev,
      vaps: [...prev.vaps, { id: `VAP_${Date.now()}`, name: "", premium: 0 }],
    }));
  }

  function removeVap(id: string) {
    setForm((prev) => ({ ...prev, vaps: prev.vaps.filter((v) => v.id !== id) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(policy.id, { ...form, premium: totalPremium });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const prevPremium = Number(policy.premium ?? 0);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Update retained policy</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {clientName} · Policy {policy.policy_number?.trim()}
            </p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
            <div className="space-y-4">

              {/* View client link */}
              <div className="flex justify-end">
                <button type="button" className="btn btn-ghost text-xs text-brand-700" onClick={onViewClient}>
                  View client profile
                </button>
              </div>

              {/* Info banner */}
              <div className="p-3 rounded-lg text-xs text-gray-600" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                Check if any policy details have changed and update below before confirming retention.
              </div>

              {/* Insurer */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Underwriter</label>
                <select className="input-field" name="insurer" value={form.insurer} onChange={handleChange} required>
                  <option value="">Select underwriter…</option>
                  {settings.underwriters.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Policy number + Base premium */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Policy number
                    <span className="text-gray-300 ml-1">(was: {policy.policy_number?.trim()})</span>
                  </label>
                  <input className="input-field" name="policyNumber" value={form.policyNumber} onChange={handleChange} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Base premium
                    <span className="text-gray-300 ml-1">(was: R{prevPremium.toLocaleString()})</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13 }}>R</span>
                    <input className="input-field" style={{ paddingLeft: 24 }} type="number" step="0.01" min="0" name="base_premium" value={form.base_premium} onChange={handleChange} onFocus={(e) => e.target.select()} />
                  </div>
                </div>
              </div>

              {/* VAPs */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Value-added products (VAPs)</p>
                <div className="space-y-2">
                  {form.vaps.map((vap, i) => (
                    <div key={vap.id} className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr auto auto" }}>
                      <input className="input-field" placeholder={`VAP ${i + 1} name`} value={vap.name} onChange={(e) => handleVapChange(vap.id, "name", e.target.value)} />
                      <select className="input-field" value={vap.underwriter ?? ""} onChange={(e) => handleVapChange(vap.id, "underwriter", e.target.value)}>
                        <option value="">Same as policy</option>
                        {settings.underwriters.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 12 }}>R</span>
                        <input className="input-field" style={{ paddingLeft: 20, width: 100 }} type="number" step="0.01" min="0" value={vap.premium} onChange={(e) => handleVapChange(vap.id, "premium", Number(e.target.value))} onFocus={(e) => e.target.select()} />
                      </div>
                      <button type="button" className="btn btn-ghost p-1.5 text-red-400 hover:text-red-600" onClick={() => removeVap(vap.id)}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost text-xs text-brand-700 mt-2 gap-1" onClick={addVap}>
                  <Plus className="w-3.5 h-3.5" /> Add VAP
                </button>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">New sale date</label>
                  <input className="input-field" type="date" name="saleDate" value={form.saleDate} onChange={handleChange} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">New inception date</label>
                  <input className="input-field" type="date" name="inceptionDate" value={form.inceptionDate} onChange={handleChange} required />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
            <div>
              <p className="text-xs text-gray-400">New total premium</p>
              <p className="text-xl font-semibold text-brand-900">
                R {totalPremium.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save retention"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
