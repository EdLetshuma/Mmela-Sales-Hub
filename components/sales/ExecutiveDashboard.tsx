"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getExecutiveOverview, type ExecutiveOverview } from "@/lib/sales-api";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, ArrowRight, ShieldCheck, Building2, Car, CreditCard } from "lucide-react";

interface ExecutiveDashboardProps {
  onNavigate: (path: string) => void;
}

const PIPELINE_COLORS: Record<string, string> = {
  prospect: "#235DCB",
  contacted: "#1A348C",
  quoted: "#854F0B",
  won: "#0F6E56",
  lost: "#A32D2D",
};

const UNIT_MIX_COLORS = ["#235DCB", "#0F6E56", "#854F0B", "#7A4FC2"];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getInitials(name: string): string {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function GrowthTag({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-gray-400">No change vs last month</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "↗" : "↘"} {Math.abs(pct)}% vs last month
    </span>
  );
}

export default function ExecutiveDashboard({ onNavigate }: ExecutiveDashboardProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const [data, setData] = useState<ExecutiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getExecutiveOverview()
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Failed to load the executive overview.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error ?? "No data available."}</p>
      </div>
    );
  }

  const { totals, pipeline, units, monthlyTrend, recentLeads, alerts, topPerformers } = data;
  const pipelineTotal = pipeline.prospect + pipeline.contacted + pipeline.quoted + pipeline.won + pipeline.lost || 1;
  const unitMix = [
    { name: "Personal", value: units.personal.leads },
    { name: "Commercial", value: units.commercial.leads },
    { name: "Concierge", value: units.concierge.leads },
    { name: "Credit Health", value: units.creditHealth.leads },
  ].filter((u) => u.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card" style={{ background: "linear-gradient(135deg, #0F1E4D 0%, #1A348C 100%)" }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "rgba(204,224,245,.7)" }}>
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-2xl font-bold text-white">Welcome back, {firstName}.</h1>
            <p className="text-sm mt-2" style={{ color: "rgba(204,224,245,.85)" }}>
              You&apos;ve got <strong className="text-white">{totals.leadsThisMonth} new leads</strong> this month across Sales,
              and <strong className="text-white">{totals.unassignedLeads} waiting</strong> to be assigned. Here&apos;s the state of Mmela right now.
            </p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Total leads</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{totals.totalLeads}</p>
          {totals.leadsThisMonth > 0 && (
            <p className="text-xs mt-1.5 font-medium text-emerald-600">+{totals.leadsThisMonth} this month</p>
          )}
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Active clients</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{totals.totalClients}</p>
          <p className="text-xs mt-1.5 text-gray-400">Across all business units</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Active policies</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{totals.activePolicies}</p>
          <p className="text-xs mt-1.5 text-gray-400">{formatCurrency(totals.totalMonthlyPremium)} / mo</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Conversion rate</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{totals.conversionRate}%</p>
          {totals.unassignedLeads > 0 ? (
            <p className="text-xs mt-1.5 font-medium text-amber-600">{totals.unassignedLeads} unassigned leads</p>
          ) : (
            <p className="text-xs mt-1.5 text-gray-400">Lead → closed engagement</p>
          )}
        </div>
      </div>

      {/* Business units */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Business units</h2>
            <p className="text-xs text-gray-400">Each unit tracked with the metric that actually matters for it</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EEF4FD" }}>
                <ShieldCheck className="w-4 h-4" style={{ color: "#1A348C" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Personal Insurance</p>
                <p className="text-[11px] text-gray-400">Individual cover</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-0.5">Monthly premium</p>
            <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(units.personal.monthlyPremium ?? 0)}</p>
            <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span>{units.personal.leads} leads</span>
              <span>{units.personal.clients} clients</span>
              <span>{units.personal.activePolicies} policies</span>
            </div>
            <div className="mt-1.5"><GrowthTag pct={units.personal.growthPct} /></div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#E1F5EE" }}>
                <Building2 className="w-4 h-4" style={{ color: "#0F6E56" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Commercial Insurance</p>
                <p className="text-[11px] text-gray-400">Business cover</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-0.5">Monthly premium</p>
            <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(units.commercial.monthlyPremium ?? 0)}</p>
            <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span>{units.commercial.leads} leads</span>
              <span>{units.commercial.clients} clients</span>
              <span>{units.commercial.activePolicies} policies</span>
            </div>
            <div className="mt-1.5"><GrowthTag pct={units.commercial.growthPct} /></div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FAEEDA" }}>
                <Car className="w-4 h-4" style={{ color: "#854F0B" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Concierge</p>
                <p className="text-[11px] text-gray-400">Vehicle sourcing</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-0.5">Closed this month</p>
            <p className="text-xl font-semibold text-gray-900 mb-2">{units.concierge.closed ?? 0}</p>
            <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span>{units.concierge.leads} leads</span>
              <span>{units.concierge.active ?? 0} active</span>
              <span>{units.concierge.unassigned} unassigned</span>
            </div>
            <div className="mt-1.5"><GrowthTag pct={units.concierge.growthPct} /></div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F3EEFB" }}>
                <CreditCard className="w-4 h-4" style={{ color: "#5B3A9A" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Credit Health</p>
                <p className="text-[11px] text-gray-400">Debt review &amp; advisory</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-0.5">Approved this month</p>
            <p className="text-xl font-semibold text-gray-900 mb-2">{units.creditHealth.closed ?? 0}</p>
            <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
              <span>{units.creditHealth.leads} leads</span>
              <span>{units.creditHealth.active ?? 0} active</span>
              <span>{units.creditHealth.unassigned} unassigned</span>
            </div>
            <div className="mt-1.5"><GrowthTag pct={units.creditHealth.growthPct} /></div>
          </div>
        </div>
      </div>

      {/* Trend + pipeline + mix */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-900">Leads &amp; conversions</h2>
          <p className="text-xs text-gray-400 mb-2">Last 6 months, all units</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#235DCB" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#235DCB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F6E56" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0F6E56" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
              <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#235DCB" fill="url(#leadsGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="converted" name="Converted" stroke="#0F6E56" fill="url(#convGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Sales pipeline</h2>
            <button className="text-xs text-brand-700 hover:text-brand-900" onClick={() => onNavigate("/sales/leads")}>Open</button>
          </div>
          <div className="space-y-2.5">
            {([
              { label: "Prospect", value: pipeline.prospect, key: "prospect" },
              { label: "Contacted", value: pipeline.contacted, key: "contacted" },
              { label: "Quoted", value: pipeline.quoted, key: "quoted" },
              { label: "Won", value: pipeline.won, key: "won" },
              { label: "Lost", value: pipeline.lost, key: "lost" },
            ]).map(({ label, value, key }) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{label}</span><span>{value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((value / pipelineTotal) * 100)}%`, backgroundColor: PIPELINE_COLORS[key] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Lead mix</h2>
          <p className="text-xs text-gray-400 mb-1">By business unit</p>
          {unitMix.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No leads yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={unitMix} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {unitMix.map((_, i) => <Cell key={i} fill={UNIT_MIX_COLORS[i % UNIT_MIX_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {unitMix.map((u, i) => (
                  <div key={u.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className="w-2 h-2 rounded-full" style={{ background: UNIT_MIX_COLORS[i % UNIT_MIX_COLORS.length] }} />
                      {u.name}
                    </span>
                    <span className="text-gray-900 font-medium">{u.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent leads + Alerts + Top performers */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent leads</h2>
              <p className="text-xs text-gray-400">Latest activity across all units</p>
            </div>
            <button className="btn btn-ghost text-xs text-brand-700 hover:text-brand-900" onClick={() => onNavigate("/sales/leads")}>
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No leads yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                      {getInitials(lead.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight truncate">{lead.name}</p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5">{lead.unit} · {lead.source ?? "—"}</p>
                    </div>
                  </div>
                  <span className="badge flex-shrink-0" style={{ background: "#F1F3F5", color: "#444441" }}>{lead.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing needs your attention.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className="p-2.5 rounded-lg flex items-start gap-2" style={{
                    background: a.tone === "danger" ? "#FCEBEB" : "#FFFBF5",
                    border: `1px solid ${a.tone === "danger" ? "#F3C9C9" : "#FAEEDA"}`,
                  }}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: a.tone === "danger" ? "#A32D2D" : "#854F0B" }} />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{a.label}</p>
                      <p className="text-[11px] text-gray-500">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top performers</h2>
            <p className="text-xs text-gray-400 mb-2 -mt-2">This month</p>
            {topPerformers.length === 0 ? (
              <p className="text-sm text-gray-400">No closed deals yet this month.</p>
            ) : (
              <div className="space-y-2.5">
                {topPerformers.map((p, i) => (
                  <div key={p.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-xs font-semibold text-gray-400">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-[10px] font-semibold text-brand-800">
                        {getInitials(p.name)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900 leading-tight">{p.name}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{p.role}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{p.closed}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
