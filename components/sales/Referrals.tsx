"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import {
  createLead, getSalesUsers, checkDuplicateLeads, checkDuplicateClients,
  type DuplicateClientMatch,
} from "@/lib/sales-api";
import { notifyNewReferral } from "@/lib/email-api";
import type { ClientSegment } from "@/types";
import type { SalesUser } from "@/lib/sales-api";
import DuplicateLeadWarning, { type DuplicateLead } from "@/components/shared/DuplicateLeadWarning";
import { UserCheck } from "lucide-react";

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof"];

interface ReferralsProps {
  onSuccess?: () => void;
}

export default function Referrals({ onSuccess }: ReferralsProps) {
  const [form, setForm] = useState({
    title: "",
    name: "",
    email: "",
    phone: "",
    segment: "Individual" as ClientSegment,
    referred_by: "",
    product_interest: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [leadAdmins, setLeadAdmins] = useState<SalesUser[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const [clientMatch, setClientMatch] = useState<DuplicateClientMatch | null>(null);
  const [pendingClientConfirm, setPendingClientConfirm] = useState(false);

  useEffect(() => {
    getSalesUsers().then((users) =>
      setLeadAdmins(users.filter((u) => u.role === "Lead Admin" || u.role === "Admin"))
    );
  }, []);

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const rawPhone = form.phone.trim() || null;
    const rawEmail = form.email.trim() || null;
    const [dupes, clientDupes] = await Promise.all([
      checkDuplicateLeads(rawPhone, rawEmail),
      checkDuplicateClients(rawPhone, rawEmail),
    ]);
    const match = clientDupes[0] ?? null;
    if (match) setClientMatch(match);

    if (dupes.length > 0) {
      setDuplicates(dupes);
      setPendingSave(true);
      return;
    }
    if (match && !pendingClientConfirm) {
      setPendingClientConfirm(true);
      return;
    }

    await doSave(match);
  }

  async function doSave(matchOverride?: DuplicateClientMatch | null) {
    setSaving(true);
    const linkClientId = (matchOverride !== undefined ? matchOverride : clientMatch)?.id ?? null;
    try {
      const notes = form.product_interest
        ? `Product Interest: ${form.product_interest}`
        : undefined;
      const leadName = form.title ? `${form.title} ${form.name}` : form.name;

      await createLead({
        name: leadName,
        email: form.email || `no-email-${Date.now()}@placeholder.com`,
        phone: form.phone,
        segment: form.segment,
        referred_by: form.referred_by || undefined,
        source: "Referral",
        source_type: "referral_portal",
        status: "Prospect",
        notes,
        client_id: linkClientId ?? undefined,
      });

      // Notify Lead Admins
      await Promise.all(
        leadAdmins.map((admin) =>
          notifyNewReferral({
            recipientEmail: admin.email!,
            recipientName: admin.name,
            leadName,
            referredBy: form.referred_by || undefined,
            productInterest: form.product_interest || undefined,
          })
        )
      );

      setForm({ title: "", name: "", email: "", phone: "", segment: "Individual", referred_by: "", product_interest: "" });
      setDuplicates([]); setPendingSave(false); setPendingClientConfirm(false); setClientMatch(null);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      onSuccess?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (pendingSave && duplicates.length > 0) {
    return (
      <DuplicateLeadWarning
        duplicates={duplicates}
        newName={form.title ? `${form.title} ${form.name}` : form.name}
        onProceed={() => doSave()}
        onCancel={() => { setDuplicates([]); setPendingSave(false); setClientMatch(null); }}
        onViewExisting={(id) => { window.location.href = `/?lead=${id}`; }}
        saving={saving}
      />
    );
  }

  if (pendingClientConfirm && clientMatch) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}>
        <div className="card" style={{ maxWidth: 460, width: "100%" }}>
          <div className="flex items-start gap-3 mb-3">
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EEF4FD", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <UserCheck className="w-4 h-4" style={{ color: "#1A348C" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Existing client found</p>
              <p className="text-xs text-gray-500 mt-0.5">
                <strong>{clientMatch.name}</strong> is already a client. This referral isn&apos;t a duplicate —
                it&apos;ll be saved as a new lead and linked to their existing client record so it isn&apos;t isolated.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => { setPendingClientConfirm(false); setClientMatch(null); }}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => doSave()}>
              {saving ? "Saving…" : "Continue & link"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Capture a referral</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the details of the new lead referred to you.
        </p>
      </div>

      {done && (
        <div className="card py-3 px-4" style={{ background: "#EAF3DE", border: "1px solid #9FE1CB" }}>
          <p className="text-sm font-medium" style={{ color: "#085041" }}>
            Referral added to leads successfully.
          </p>
        </div>
      )}

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title + Name */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <select className="input-field" name="title" value={form.title} onChange={handleChange}>
                <option value="">—</option>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Full name</label>
              <input className="input-field" name="name" value={form.name} onChange={handleChange} required placeholder="Lead's full name" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Email <span className="text-gray-400">(optional)</span>
              </label>
              <input className="input-field" type="email" name="email" value={form.email} onChange={handleChange} placeholder="e.g. john@email.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone number</label>
              <input className="input-field" type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="e.g. 082 123 4567" />
            </div>
          </div>

          {/* Product interest */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Product interest</label>
            <textarea
              className="input-field"
              name="product_interest"
              value={form.product_interest}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. Comprehensive cover for 2 vehicles (BMW X5 & Polo Vivo)"
            />
            <p className="text-xs text-gray-400 mt-1">
              Helps the agent prepare for the call.
            </p>
          </div>

          {/* Segment + Referred by */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Segment</label>
              <select className="input-field" name="segment" value={form.segment} onChange={handleChange}>
                <option value="Individual">Individual</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Referred by <span className="text-gray-400">(optional)</span>
              </label>
              <input className="input-field" name="referred_by" value={form.referred_by} onChange={handleChange} placeholder="e.g. Jane Doe (existing client)" />
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={saving}>
              {saving ? "Adding referral…" : "Add referral to leads"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
