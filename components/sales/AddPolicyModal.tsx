"use client";

import React, { useState, useEffect, useMemo, ChangeEvent, FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { SystemSettings } from "@/lib/settings-api";
import type { SalesClient } from "@/lib/sales-api";
import type { SalesUser } from "@/lib/sales-api";
import { useAuth } from "@/components/providers/AuthProvider";
import { notifyDocsPending } from "@/lib/email-api";

export interface NewPolicyData {
  policy_number: string;
  client_id: string;
  client_segment: string;
  product_category: string;
  product_name: string;
  insurer: string;
  base_premium: number;
  premium: number;
  vaps: { id: string; name: string; premium: number; underwriter?: string }[];
  inception_date: string;
  sale_date: string;
  status: string;
  sold_by_user_id?: string;
  category: string;
}

interface AddPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewPolicyData) => Promise<void>;
  clients: SalesClient[];
  users: SalesUser[];
  settings: SystemSettings;
  defaultClientId?: string;
  segment: string;
}

const POLICY_STATUSES = ["Pending", "Active", "Canceled", "Expired"];
const CATEGORY_MAP: Record<string, string> = {
  Mobility: "Short Term",
  Commercial: "General",
  "Life & Credit Life": "Long Term",
  "Liabilities & Guarantees": "General",
};

export default function AddPolicyModal({
  isOpen,
  onClose,
  onSave,
  clients,
  users,
  settings,
  defaultClientId,
  segment,
}: AddPolicyModalProps) {
  const { user } = useAuth();
  const isSalesAgent = user?.role === "Sales Agent";

  const defaultCategory = segment === "Individual" ? "Life & Credit Life" : "Mobility";

  const emptyForm = (): NewPolicyData => ({
    policy_number: "",
    client_id: defaultClientId ?? clients[0]?.id ?? "",
    client_segment: segment,
    product_category: defaultCategory,
    product_name: settings.productCatalog[defaultCategory]?.[0] ?? "",
    insurer: "",
    base_premium: 0,
    premium: 0,
    vaps: [],
    inception_date: new Date().toISOString().split("T")[0],
    sale_date: new Date().toISOString().split("T")[0],
    status: "Pending",
    sold_by_user_id: isSalesAgent && user ? user.id : "",
    category: CATEGORY_MAP[defaultCategory] ?? "General",
  });

  const [form, setForm] = useState<NewPolicyData>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(emptyForm());
  }, [isOpen, defaultClientId, segment]);

  const totalPremium = useMemo(
    () => (form.base_premium || 0) + form.vaps.reduce((s, v) => s + (v.premium || 0), 0),
    [form.base_premium, form.vaps]
  );

  const productNames = settings.productCatalog[form.product_category] ?? [];

  const salesAgents = users.filter((u) =>
    ["Sales Agent", "Team Leader", "Manager"].includes(u.role)
  );

  const canPickAgent = user && ["Admin", "Policy Admin", "Manager", "Team Leader"].includes(user.role);

  const selectedClient = clients.find((c) => c.id === form.client_id);

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "base_premium") return { ...prev, base_premium: Number(value) };
      if (name === "product_category") {
        const names = settings.productCatalog[value] ?? [];
        return {
          ...prev,
          product_category: value,
          product_name: names[0] ?? "",
          category: CATEGORY_MAP[value] ?? "General",
        };
      }
      return { ...prev, [name]: value };
    });
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
      await onSave({ ...form, premium: totalPremium });
      // Notify Policy Admins that documentation is pending
      const policyAdmins = users.filter((u) =>
        u.role === "Policy Admin" || u.role === "Admin"
      );
      if (policyAdmins.length > 0 && selectedClient) {
        await Promise.all(
          policyAdmins.map((admin) =>
            notifyDocsPending({
              recipientEmail: admin.email!,
              recipientName: admin.name,
              clientName: selectedClient.name,
              policyNumber: form.policy_number,
              agentName: user?.name,
            })
          )
        );
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add new policy</h2>
            {selectedClient && (
              <p className="text-xs text-gray-400 mt-0.5">For: {selectedClient.name}</p>
            )}
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
            <div className="space-y-4">

              {/* Client selector — only show if no defaultClientId */}
              {!defaultClientId && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client</label>
                  <select className="input-field" name="client_id" value={form.client_id} onChange={handleChange} required>
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Policy number + Insurer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Policy number</label>
                  <input className="input-field" name="policy_number" value={form.policy_number} onChange={handleChange} required placeholder="e.g. QS-701718" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Insurer</label>
                  <select className="input-field" name="insurer" value={form.insurer} onChange={handleChange} required>
                    <option value="">Select insurer…</option>
                    {settings.underwriters.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Product category + Product name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Product category</label>
                  <select className="input-field" name="product_category" value={form.product_category} onChange={handleChange}>
                    {Object.keys(settings.productCatalog).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Product name</label>
                  <select className="input-field" name="product_name" value={form.product_name} onChange={handleChange}>
                    {productNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Base premium */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Base premium</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13 }}>R</span>
                  <input
                    className="input-field"
                    style={{ paddingLeft: 24 }}
                    type="number" step="0.01" min="0"
                    name="base_premium"
                    value={form.base_premium}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    required
                  />
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
                        <input className="input-field" style={{ paddingLeft: 20, width: 100 }} type="number" step="0.01" min="0" placeholder="Premium" value={vap.premium} onChange={(e) => handleVapChange(vap.id, "premium", Number(e.target.value))} onFocus={(e) => e.target.select()} />
                      </div>
                      <button type="button" className="btn btn-ghost p-1.5 text-red-400 hover:text-red-600" onClick={() => removeVap(vap.id)}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost text-xs text-brand-700 mt-2 gap-1" onClick={addVap}>
                  <Plus className="w-3.5 h-3.5" /> Add VAP
                </button>
              </div>

              {/* Sold by */}
              {canPickAgent && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sold by</label>
                  <select className="input-field" name="sold_by_user_id" value={form.sold_by_user_id ?? ""} onChange={handleChange}>
                    <option value="">Select agent…</option>
                    {salesAgents.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                  </select>
                </div>
              )}

              {/* Dates + Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sale date</label>
                  <input className="input-field" type="date" name="sale_date" value={form.sale_date} onChange={handleChange} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Inception date</label>
                  <input className="input-field" type="date" name="inception_date" value={form.inception_date} onChange={handleChange} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Status</label>
                  <select className="input-field" name="status" value={form.status} onChange={handleChange}>
                    {POLICY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid #E5E7EB" }}>
            <div>
              <p className="text-xs text-gray-400">Total premium</p>
              <p className="text-xl font-semibold text-brand-900">
                R {totalPremium.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Add policy"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
