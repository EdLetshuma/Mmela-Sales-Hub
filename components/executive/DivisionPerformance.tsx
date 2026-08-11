"use client";

import React, { useEffect, useState } from "react";
import {
  getDivisionPerformance, EXECUTIVE_RANGE_LABELS,
  type DivisionPerformance as DivisionPerformanceData, type DivisionKey,
} from "@/lib/analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Loader2 } from "lucide-react";

const RANGE_OPTIONS: ExecutiveRange[] = ["30d", "90d", "mtd", "ytd", "all"];
const DIVISION_COLORS: Record<DivisionKey, string> = {
  sales: "#235DCB",
  concierge: "#854F0B",
  creditHealth: "#7A4FC2",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function DivisionPerformance() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [selected, setSelected] = useState<DivisionKey | null>(null);
  const [data, setData] = useState<DivisionPerformanceData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getDivisionPerformance(range)
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Failed to load division performance.");
      })
      .finally(() => setRefreshing(false));
  }, [range]);

  if (!data && !error) {
    return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
  }
  if (error || !data) {
    return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;
  }

  const totalLeads = data.rows.reduce((s, r) => s + r.leads, 0);
  const totalConverted = data.rows.reduce((s, r) => s + r.converted, 0);
  const totalConversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 1000) / 10 : null;
  const salesRow = data.rows.find((r) => r.key === "sales");
  const drillRow = selected ? data.rows.find((r) => r.key === selected) : null;

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-gray-500">Show data for</span>
        <select
          className="input-field"
          style={{ width: "auto", fontSize: 13, padding: "6px 28px 6px 10px" }}
          value={range}
          disabled={refreshing}
          onChange={(e) => setRange(e.target.value as ExecutiveRange)}
        >
          {RANGE_OPTIONS.map((r) => <option key={r} value={r}>{EXECUTIVE_RANGE_LABELS[r]}</option>)}
        </select>
        {refreshing && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </div>

      {/* Comparison table */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Division comparison</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Metric</th>
                {data.rows.map((r) => (
                  <th
                    key={r.key}
                    className="pb-2 font-medium text-right pl-4 cursor-pointer"
                    style={{ color: selected === r.key ? DIVISION_COLORS[r.key] : undefined }}
                    onClick={() => setSelected(selected === r.key ? null : r.key)}
                  >
                    {r.label}
                  </th>
                ))}
                <th className="pb-2 font-medium text-right pl-4">Total</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              <tr className="border-b border-gray-50">
                <td className="py-2 text-gray-500">Leads</td>
                {data.rows.map((r) => <td key={r.key} className="py-2 text-right pl-4">{r.leads}</td>)}
                <td className="py-2 text-right pl-4 font-medium">{totalLeads}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 text-gray-500">Converted</td>
                {data.rows.map((r) => <td key={r.key} className="py-2 text-right pl-4">{r.converted}</td>)}
                <td className="py-2 text-right pl-4 font-medium">{totalConverted}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 text-gray-500">Conversion rate</td>
                {data.rows.map((r) => (
                  <td key={r.key} className="py-2 text-right pl-4">{r.conversionRatePct !== null ? `${r.conversionRatePct}%` : "—"}</td>
                ))}
                <td className="py-2 text-right pl-4 font-medium">{totalConversionRate !== null ? `${totalConversionRate}%` : "—"}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 text-gray-500">Policies</td>
                {data.rows.map((r) => <td key={r.key} className="py-2 text-right pl-4">{r.policies ?? <span className="text-gray-300">N/A</span>}</td>)}
                <td className="py-2 text-right pl-4 font-medium">{salesRow?.policies ?? 0}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">Premium</td>
                {data.rows.map((r) => <td key={r.key} className="py-2 text-right pl-4">{r.premium !== null ? formatCurrency(r.premium) : <span className="text-gray-300">N/A</span>}</td>)}
                <td className="py-2 text-right pl-4 font-medium">{formatCurrency(salesRow?.premium ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Policies and premium are Sales-only — Concierge and Credit Health don&apos;t sell policies in this system, so those cells are genuinely not applicable rather than zero. Click a division name to drill in.</p>
      </div>

      {drillRow && (
        <div className="card" style={{ borderLeft: `3px solid ${DIVISION_COLORS[drillRow.key]}` }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{drillRow.label} detail</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-gray-400">Leads</p><p className="text-lg font-semibold">{drillRow.leads}</p></div>
            <div><p className="text-xs text-gray-400">Converted</p><p className="text-lg font-semibold">{drillRow.converted}</p></div>
            <div><p className="text-xs text-gray-400">Conversion rate</p><p className="text-lg font-semibold">{drillRow.conversionRatePct !== null ? `${drillRow.conversionRatePct}%` : "No data"}</p></div>
            <div><p className="text-xs text-gray-400">Premium</p><p className="text-lg font-semibold">{drillRow.premium !== null ? formatCurrency(drillRow.premium) : "N/A"}</p></div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Leads by division</h2>
          <p className="text-xs text-gray-400 mb-2">Selected period</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.rows.map((r) => ({ name: r.label, leads: r.leads, converted: r.converted }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="Leads" fill="#235DCB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="converted" name="Converted" fill="#0F6E56" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Monthly performance by division</h2>
          <p className="text-xs text-gray-400 mb-2">Last 6 months &middot; new leads</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.monthlyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DIVISION_COLORS.sales} stopOpacity={0.25} /><stop offset="100%" stopColor={DIVISION_COLORS.sales} stopOpacity={0} /></linearGradient>
                <linearGradient id="conciergeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DIVISION_COLORS.concierge} stopOpacity={0.25} /><stop offset="100%" stopColor={DIVISION_COLORS.concierge} stopOpacity={0} /></linearGradient>
                <linearGradient id="creditHealthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DIVISION_COLORS.creditHealth} stopOpacity={0.25} /><stop offset="100%" stopColor={DIVISION_COLORS.creditHealth} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
              <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke={DIVISION_COLORS.sales} fill="url(#salesGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="concierge" name="Concierge" stroke={DIVISION_COLORS.concierge} fill="url(#conciergeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="creditHealth" name="Credit Health" stroke={DIVISION_COLORS.creditHealth} fill="url(#creditHealthGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Conversion rate by division</h2>
          <p className="text-xs text-gray-400 mb-2">Selected period</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.rows.map((r) => ({ name: r.label, rate: r.conversionRatePct ?? 0, hasData: r.conversionRatePct !== null }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, _n, p) => [p.payload.hasData ? `${v}%` : "No data", "Conversion rate"]} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {data.rows.map((r) => <Cell key={r.key} fill={DIVISION_COLORS[r.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900">Premium by division</h2>
          <p className="text-xs text-gray-400 mb-2">Sales only &mdash; Concierge/Credit Health not applicable</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.rows.map((r) => ({ name: r.label, premium: r.premium ?? 0 }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="premium" fill="#0F6E56" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
