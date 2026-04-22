"use client";

import React, { useState, useEffect, useMemo, ChangeEvent, FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { SystemSettings } from "@/lib/settings-api";

export interface VAP {
  id: string;
  name: string;
  premium: number;
  underwriter?: string;
}

export interface QuoteFormData {
  quoteNumber: string;
  underwriter: string;
  productCategory: string;
  productName: string;
  basePremium: number;
  vaps: VAP[];
  clientIdNumber?: string;
}

export interface SavedQuote extends QuoteFormData {
  id: string;
  status: "Pending" | "Accepted" | "Rejected";
  createdAt: string;
}

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: QuoteFormData) => Promise<void>;
  subjectName: string;
  prefillIdNumber?: string;
  quoteToEdit?: SavedQuote;
  settings: SystemSettings;
}

export default function QuoteModal({
  isOpen,
  onClose,
  onSave,
  subjectName,
  prefillIdNumber,
  quoteToEdit,
  settings,
}: QuoteModalProps) {
  const defaultCategory = Object.keys(settings.productCatalog)[0] ?? "Mobility";

  const emptyForm = (): QuoteFormData => ({
    quoteNumber: "",
    underwriter: "",
    productCategory: defaultCategory,
    productName: settings.productCatalog[defaultCategory]?.[0] ?? "",
    basePremium: 0,
    vaps: [],
    clientIdNumber: prefillIdNumber ?? "",
  });

  const [form, setForm] = useState<QuoteFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (quoteToEdit) {
      setForm({
        quoteNumber: quoteToEdit.quoteNumber,
        underwriter: quoteToEdit.underwriter,
        productCategory: quoteToEdit.productCategory,
        productName: quoteToEdit.productName,
        basePremium: quoteToEdit.basePremium,
        vaps: quoteToEdit.vaps.map((v, i) => ({ ...v, id: v.id || `VAP_${i}` })),
        clientIdNumber: quoteToEdit.clientIdNumber ?? prefillIdNumber ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [isOpen, quoteToEdit]);

  const totalPremium = useMemo(
    () =>
      (form.basePremium || 0) +
      form.vaps.reduce((s, v) => s + (v.premium || 0), 0),
    [form.basePremium, form.vaps]
  );

  const productNames = settings.productCatalog[form.productCategory] ?? [];

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "basePremium") return { ...prev, basePremium: Number(value) };
      if (name === "productCategory") {
        const names = settings.productCatalog[value] ?? [];
        return { ...prev, productCategory: value, productName: names[0] ?? "" };
      }
      return { ...prev, [name]: value };
    });
  }

  function handleVapChange(
    id: string,
    field: "name" | "premium" | "underwriter",
    value: string | number
  ) {
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
      await onSave(form);
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
        style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {quoteToEdit ? "Edit quote" : "Add new quote"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">For: {subjectName}</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
            <div className="space-y-4">

              {/* Row 1: Quote ref + Client ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">External ref / quote #</label>
                  <input
                    className="input-field"
                    name="quoteNumber"
                    value={form.quoteNumber}
                    onChange={handleChange}
                    placeholder="e.g. QT-00123"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Client ID number</label>
                  <input
                    className="input-field"
                    name="clientIdNumber"
                    value={form.clientIdNumber ?? ""}
                    onChange={handleChange}
                    placeholder="Capture for conversion"
                  />
                </div>
              </div>

              {/* Row 2: Underwriter + Base premium */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Underwriter</label>
                  <select
                    className="input-field"
                    name="underwriter"
                    value={form.underwriter}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select underwriter…</option>
                    {settings.underwriters.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Base premium</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13 }}>R</span>
                    <input
                      className="input-field"
                      style={{ paddingLeft: 24 }}
                      type="number"
                      step="0.01"
                      min="0"
                      name="basePremium"
                      value={form.basePremium}
                      onChange={handleChange}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Product category + Product name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Product category</label>
                  <select
                    className="input-field"
                    name="productCategory"
                    value={form.productCategory}
                    onChange={handleChange}
                  >
                    {Object.keys(settings.productCatalog).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Product name</label>
                  <select
                    className="input-field"
                    name="productName"
                    value={form.productName}
                    onChange={handleChange}
                  >
                    {productNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* VAPs */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Value-added products (VAPs)</p>
                <div className="space-y-2">
                  {form.vaps.map((vap, i) => (
                    <div key={vap.id} className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr auto auto" }}>
                      <input
                        className="input-field"
                        placeholder={`VAP ${i + 1} name`}
                        value={vap.name}
                        onChange={(e) => handleVapChange(vap.id, "name", e.target.value)}
                      />
                      <select
                        className="input-field"
                        value={vap.underwriter ?? ""}
                        onChange={(e) => handleVapChange(vap.id, "underwriter", e.target.value)}
                      >
                        <option value="">Same as quote</option>
                        {settings.underwriters.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 12 }}>R</span>
                        <input
                          className="input-field"
                          style={{ paddingLeft: 20, width: 100 }}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Premium"
                          value={vap.premium}
                          onChange={(e) => handleVapChange(vap.id, "premium", Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost p-1.5 text-red-400 hover:text-red-600"
                        onClick={() => removeVap(vap.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-brand-700 mt-2 gap-1"
                  onClick={addVap}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add VAP
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between mt-4 pt-4"
            style={{ borderTop: "1px solid #E5E7EB" }}
          >
            <div>
              <p className="text-xs text-gray-400">Total premium</p>
              <p className="text-xl font-semibold text-brand-900">
                R {totalPremium.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : quoteToEdit ? "Save changes" : "Save quote"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
