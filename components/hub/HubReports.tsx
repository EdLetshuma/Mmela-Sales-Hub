"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Download, Mail, Plus, Trash2, Edit2, X, Toggle } from "lucide-react";
import {
  getReportMailings, createReportMailing, updateReportMailing, deleteReportMailing,
  REPORT_TYPES, type ReportMailing, type ReportTypeValue,
} from "@/lib/catalog-api";
import { generateReport, downloadReport } from "@/lib/excel-reports";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2,"0")}:00`,
}));

function MailingModal({
  mailing,
  onClose,
  onSave,
}: {
  mailing?: ReportMailing;
  onClose: () => void;
  onSave: (data: Partial<ReportMailing>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: mailing?.name ?? "",
    report_type: mailing?.report_type ?? REPORT_TYPES[0].value,
    frequency: mailing?.frequency ?? "weekly",
    day_of_week: mailing?.day_of_week ?? 1,
    day_of_month: mailing?.day_of_month ?? 1,
    send_hour: mailing?.send_hour ?? 7,
    recipients: (mailing?.recipients ?? []).join(", "),
    active: mailing?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const recipients = form.recipients.split(",").map(r => r.trim()).filter(Boolean);
    if (recipients.length === 0) { setError("Add at least one recipient email."); return; }
    setSaving(true);
    try {
      await onSave({ ...form, recipients });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const selectedReport = REPORT_TYPES.find(r => r.value === form.report_type);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16 }} onClick={onClose}>
      <div className="card" style={{ width:"100%",maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{mailing ? "Edit mailing" : "New report mailing"}</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background:"#FCEBEB",color:"#791F1F" }}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mailing name</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Weekly sales summary" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Report type</label>
            <select className="input-field" value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
              {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {selectedReport && <p className="text-xs text-gray-400 mt-1">Unit: {selectedReport.unit === "all" ? "All units" : selectedReport.unit}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
              <select className="input-field" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as "weekly" | "monthly" }))}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {form.frequency === "weekly" ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Day</label>
                <select className="input-field" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Day of month</label>
                <select className="input-field" value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: Number(e.target.value) }))}>
                  {Array.from({ length: 28 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Send at</label>
              <select className="input-field" value={form.send_hour} onChange={e => setForm(f => ({ ...f, send_hour: Number(e.target.value) }))}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Recipients</label>
            <textarea
              className="input-field"
              rows={3}
              value={form.recipients}
              onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))}
              placeholder="email1@example.com, email2@example.com"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : mailing ? "Save changes" : "Create mailing"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HubReports() {
  const [mailings, setMailings] = useState<ReportMailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [editingMailing, setEditingMailing] = useState<ReportMailing | undefined>();
  const [showMailingModal, setShowMailingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"reports" | "mailings">("reports");

  const fetchMailings = useCallback(async () => {
    const m = await getReportMailings();
    setMailings(m);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMailings(); }, [fetchMailings]);

  async function handleDownload(reportType: string, label: string) {
    setGenerating(reportType);
    try {
      const data = await generateReport(reportType);
      const date = new Date().toISOString().slice(0, 10);
      downloadReport(data, `mmela-${reportType.replace(/_/g, "-")}-${date}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate report. Please try again.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleSaveMailing(data: Partial<ReportMailing>) {
    if (editingMailing) {
      await updateReportMailing(editingMailing.id, data);
    } else {
      await createReportMailing(data as Omit<ReportMailing, "id" | "created_at" | "last_sent_at">);
    }
    await fetchMailings();
  }

  async function handleToggleMailing(m: ReportMailing) {
    await updateReportMailing(m.id, { active: !m.active });
    await fetchMailings();
  }

  async function handleDeleteMailing(m: ReportMailing) {
    if (!window.confirm(`Delete mailing "${m.name}"?`)) return;
    await deleteReportMailing(m.id);
    await fetchMailings();
  }

  const reportByUnit = {
    sales: REPORT_TYPES.filter(r => r.unit === "sales"),
    concierge: REPORT_TYPES.filter(r => r.unit === "concierge"),
    "credit-health": REPORT_TYPES.filter(r => r.unit === "credit-health"),
    all: REPORT_TYPES.filter(r => r.unit === "all"),
  };

  const UNIT_LABELS: Record<string, string> = {
    sales: "Insurance Sales",
    concierge: "Concierge",
    "credit-health": "Credit Health",
    all: "Cross-unit",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and schedule Excel reports across all business units</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {(["reports","mailings"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm font-medium capitalize relative transition-colors ${activeTab === t ? "text-brand-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "mailings" ? `Scheduled mailings (${mailings.length})` : "Generate reports"}
            {activeTab === t && <span style={{ position:"absolute",bottom:0,left:16,right:16,height:2,background:"#1A348C",borderRadius:2 }} />}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {Object.entries(reportByUnit).map(([unit, reports]) => (
            <div key={unit} className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">{UNIT_LABELS[unit]}</h2>
              <div className="grid grid-cols-2 gap-3">
                {reports.map(r => (
                  <div key={r.value} className="flex items-center justify-between p-3 rounded-lg" style={{ background:"#F8F9FB",border:"1px solid #E5E7EB" }}>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Excel · .xlsx</p>
                    </div>
                    <button
                      className="btn btn-primary text-xs gap-1.5 flex-shrink-0"
                      disabled={generating === r.value}
                      onClick={() => handleDownload(r.value, r.label)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {generating === r.value ? "Generating…" : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mailings tab */}
      {activeTab === "mailings" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn btn-primary gap-1.5" onClick={() => { setEditingMailing(undefined); setShowMailingModal(true); }}>
              <Plus className="w-4 h-4" /> New mailing
            </button>
          </div>

          {loading ? (
            <div className="card h-32 animate-pulse bg-gray-50" />
          ) : mailings.length === 0 ? (
            <div className="card text-center py-12">
              <Mail className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No scheduled mailings yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a mailing to automatically send reports to your team</p>
              <button className="btn btn-primary mt-4" onClick={() => { setEditingMailing(undefined); setShowMailingModal(true); }}>Create first mailing</button>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Name","Report","Frequency","Recipients","Last sent","Status",""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mailings.map(m => {
                    const report = REPORT_TYPES.find(r => r.value === m.report_type);
                    const schedule = m.frequency === "weekly"
                      ? `${DAYS[m.day_of_week ?? 1]}s at ${HOURS[m.send_hour]?.label}`
                      : `Monthly on the ${m.day_of_month}${["st","nd","rd"][((m.day_of_month ?? 1) - 1) % 10] ?? "th"} at ${HOURS[m.send_hour]?.label}`;
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{report?.label ?? m.report_type}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{schedule}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{m.recipients.length} recipient{m.recipients.length !== 1 ? "s" : ""}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{m.last_sent_at ? new Date(m.last_sent_at).toLocaleDateString("en-ZA") : "Never"}</td>
                        <td className="px-4 py-3">
                          <span className="badge" style={m.active ? { background:"#EAF3DE",color:"#27500A" } : { background:"#F1F3F5",color:"#6B7280" }}>
                            {m.active ? "Active" : "Paused"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="btn btn-ghost p-1 text-gray-400 hover:text-gray-700" onClick={() => { setEditingMailing(m); setShowMailingModal(true); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button className="text-xs font-medium" style={{ color: m.active ? "#854F0B" : "#0F6E56" }} onClick={() => handleToggleMailing(m)}>
                              {m.active ? "Pause" : "Resume"}
                            </button>
                            <button className="btn btn-ghost p-1 text-red-400 hover:text-red-600" onClick={() => handleDeleteMailing(m)}>
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
        </div>
      )}

      {showMailingModal && (
        <MailingModal
          mailing={editingMailing}
          onClose={() => { setShowMailingModal(false); setEditingMailing(undefined); }}
          onSave={handleSaveMailing}
        />
      )}
    </div>
  );
}
