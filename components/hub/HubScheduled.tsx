"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit2, Trash2, Mail, X, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getReportMailings, createReportMailing, updateReportMailing, deleteReportMailing,
  REPORT_TYPES, type ReportMailing,
} from "@/lib/catalog-api";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${String(i).padStart(2,"0")}:00` }));

function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v-20)%10] ?? s[v] ?? s[0]);
}

function scheduleLabel(m: ReportMailing) {
  const hour = HOURS[m.send_hour]?.label ?? "07:00";
  if (m.frequency === "weekly") return `Every ${DAYS[m.day_of_week ?? 1]} at ${hour}`;
  return `Monthly on the ${ordinal(m.day_of_month ?? 1)} at ${hour}`;
}

// ── Mailing modal ─────────────────────────────────────────────

interface ExtendedMailing extends ReportMailing {
  subject?: string;
  message?: string;
}

function MailingModal({
  mailing, onClose, onSave,
}: { mailing?: ExtendedMailing; onClose: () => void; onSave: (data: Partial<ExtendedMailing>) => Promise<void> }) {
  const [form, setForm] = useState({
    name:         mailing?.name ?? "",
    report_type:  mailing?.report_type ?? REPORT_TYPES[0].value,
    frequency:    (mailing?.frequency ?? "weekly") as "weekly"|"monthly",
    day_of_week:  mailing?.day_of_week ?? 1,
    day_of_month: mailing?.day_of_month ?? 1,
    send_hour:    mailing?.send_hour ?? 7,
    recipients:   (mailing?.recipients ?? []).join(", "),
    subject:      (mailing as ExtendedMailing)?.subject ?? "",
    message:      (mailing as ExtendedMailing)?.message ?? "",
    active:       mailing?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const recipients = form.recipients.split(",").map((r) => r.trim()).filter(Boolean);
    if (!recipients.length) { setError("Add at least one recipient."); return; }
    setSaving(true);
    try {
      await onSave({ ...form, recipients });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  const selectedReport = REPORT_TYPES.find((r) => r.value === form.report_type);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16 }} onClick={onClose}>
      <div className="card" style={{ width:"100%",maxWidth:560,maxHeight:"90vh",display:"flex",flexDirection:"column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mailing ? "Edit mailing" : "New scheduled mailing"}</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background:"#FCEBEB",color:"#791F1F" }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ overflowY:"auto",flex:1 }}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mailing name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Weekly agent summary" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Report</label>
              <select className="input-field" value={form.report_type} onChange={(e) => setForm((f) => ({ ...f, report_type: e.target.value }))}>
                {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {selectedReport && <p className="text-xs text-gray-400 mt-1">Unit: {selectedReport.unit === "all" ? "All units" : selectedReport.unit}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
                <select className="input-field" value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as "weekly"|"monthly" }))}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{form.frequency === "weekly" ? "Day" : "Day of month"}</label>
                {form.frequency === "weekly" ? (
                  <select className="input-field" value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                ) : (
                  <select className="input-field" value={form.day_of_month} onChange={(e) => setForm((f) => ({ ...f, day_of_month: Number(e.target.value) }))}>
                    {Array.from({ length: 28 }, (_, i) => <option key={i+1} value={i+1}>{ordinal(i+1)}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Send at</label>
                <select className="input-field" value={form.send_hour} onChange={(e) => setForm((f) => ({ ...f, send_hour: Number(e.target.value) }))}>
                  {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Recipients</label>
              <textarea className="input-field" rows={2} value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))} placeholder="email1@example.com, email2@example.com" required />
              <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email subject <span className="text-gray-400">(optional — auto-generated if blank)</span></label>
              <input className="input-field" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="e.g. Weekly Sales Performance Report" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Message <span className="text-gray-400">(optional — appears in the email body)</span></label>
              <textarea className="input-field" rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="e.g. Hi team, please review this week's performance summary. Key focus areas: retention rate and new policy conversions. Any questions, reach out directly." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4" style={{ borderTop:"1px solid #E5E7EB" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : mailing ? "Save changes" : "Create mailing"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Test run modal ────────────────────────────────────────────

function TestRunModal({ mailing, onClose }: { mailing: ExtendedMailing; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  async function handleTest() {
    if (!email.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://tslovjdrcbnewcajawiq.supabase.co/functions/v1/send-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ mailing_id: mailing.id, test_email: email.trim() }),
        }
      );
      const data = await res.json();
      setResult(data.ok ? { ok: true, sent: data.sent } : { ok: false, error: data.error ?? "Unknown error" });
    } catch (err: unknown) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:60,padding:16 }} onClick={onClose}>
      <div className="card" style={{ width:"100%",maxWidth:420 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Test run</h2>
            <p className="text-xs text-gray-400 mt-0.5">{mailing.name}</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Send a test version of this mailing to a single email address. Recipients won't be notified and the last-sent date won't update.
        </p>

        {result && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={result.ok ? { background:"#EAF3DE",color:"#085041" } : { background:"#FCEBEB",color:"#791F1F" }}>
            {result.ok ? `✓ Test email sent successfully to ${email}` : `✕ Failed: ${result.error}`}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Send test to</label>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button
              className="btn btn-primary gap-1.5"
              disabled={running || !email.trim()}
              onClick={handleTest}
              style={{ background: "#0F6E56" }}
            >
              <Play className="w-3.5 h-3.5" />
              {running ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function HubScheduled() {
  const [mailings, setMailings] = useState<ExtendedMailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMailing, setEditingMailing] = useState<ExtendedMailing | undefined>();
  const [showModal, setShowModal] = useState(false);
  const [testMailing, setTestMailing] = useState<ExtendedMailing | null>(null);

  const fetchMailings = useCallback(async () => {
    const m = await getReportMailings();
    setMailings(m as ExtendedMailing[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMailings(); }, [fetchMailings]);

  async function handleSave(data: Partial<ExtendedMailing>) {
    if (editingMailing) {
      await updateReportMailing(editingMailing.id, data as Partial<ReportMailing>);
    } else {
      await createReportMailing(data as Omit<ReportMailing, "id"|"created_at"|"last_sent_at">);
    }
    await fetchMailings();
  }

  async function handleDelete(m: ExtendedMailing) {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    await deleteReportMailing(m.id);
    await fetchMailings();
  }

  async function handleToggle(m: ExtendedMailing) {
    await updateReportMailing(m.id, { active: !m.active });
    await fetchMailings();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Scheduled mailings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure which reports get sent to who and when. Use test run to verify before going live.</p>
        </div>
        <button className="btn btn-primary gap-1.5" onClick={() => { setEditingMailing(undefined); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New mailing
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="card h-16 animate-pulse bg-gray-50" />)}</div>
      ) : mailings.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><Mail className="w-5 h-5 text-gray-400" /></div>
          <p className="text-sm font-medium text-gray-700">No scheduled mailings yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Set up automatic report delivery to your team or stakeholders</p>
          <button className="btn btn-primary" onClick={() => { setEditingMailing(undefined); setShowModal(true); }}>Create first mailing</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Name","Report","Schedule","Recipients","Message","Last sent","Status",""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mailings.map((m) => {
                const report = REPORT_TYPES.find((r) => r.value === m.report_type);
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{report?.label ?? m.report_type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{scheduleLabel(m)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.recipients.length} recipient{m.recipients.length !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
                      {m.message ? (
                        <span className="truncate block" style={{ maxWidth: 160 }} title={m.message}>{m.message}</span>
                      ) : <span className="italic">None</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {m.last_sent_at ? new Date(m.last_sent_at).toLocaleDateString("en-ZA", { day:"numeric",month:"short",year:"numeric" }) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge" style={m.active ? { background:"#EAF3DE",color:"#27500A" } : { background:"#F1F3F5",color:"#6B7280" }}>
                        {m.active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                          className="btn btn-ghost p-1 text-gray-400 hover:text-gray-700"
                          title="Edit"
                          onClick={() => { setEditingMailing(m); setShowModal(true); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color:"#0F6E56" }}
                          title="Test run"
                          onClick={() => setTestMailing(m)}
                        >
                          <Play className="w-3 h-3" /> Test
                        </button>
                        <button
                          className="text-xs font-medium"
                          style={{ color: m.active ? "#854F0B" : "#0F6E56" }}
                          onClick={() => handleToggle(m)}
                        >
                          {m.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          className="btn btn-ghost p-1 text-red-400 hover:text-red-600"
                          onClick={() => handleDelete(m)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <MailingModal
          mailing={editingMailing}
          onClose={() => { setShowModal(false); setEditingMailing(undefined); }}
          onSave={handleSave}
        />
      )}

      {testMailing && (
        <TestRunModal
          mailing={testMailing}
          onClose={() => setTestMailing(null)}
        />
      )}
    </div>
  );
}
