"use client";

import React, { useEffect, useState } from "react";
import {
  getExecutiveKpis, EXECUTIVE_RANGE_LABELS,
  type ExecutiveKpis,
} from "@/lib/analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { Loader2 } from "lucide-react";

const RANGE_OPTIONS: ExecutiveRange[] = ["30d", "90d", "mtd", "ytd", "all"];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ChangeTag({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className="text-xs text-gray-400">No baseline for comparison</span>;
  if (pct === 0) return <span className="text-xs text-gray-400">No change vs previous period</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "↗" : "↘"} {Math.abs(pct)}% vs previous period
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
}
function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsOverview() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<ExecutiveKpis | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getExecutiveKpis(range)
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Failed to load analytics overview.");
      })
      .finally(() => setRefreshing(false));
  }, [range]);

  if (!data && !error) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
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

      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total leads" value={String(data.totalLeads)} sub={<span className="text-xs text-gray-400">Current, all divisions</span>} />
        <KpiCard label="New leads" value={String(data.newLeads.value)} sub={<ChangeTag pct={data.newLeads.pctChange} />} />
        <KpiCard label="Converted leads" value={String(data.convertedLeads.value)} sub={<ChangeTag pct={data.convertedLeads.pctChange} />} />

        <KpiCard
          label="Conversion rate"
          value={data.conversionRatePct.value !== null ? `${data.conversionRatePct.value}%` : "No data"}
          sub={
            data.conversionRatePct.pointChange === null
              ? <span className="text-xs text-gray-400">No baseline for comparison</span>
              : (
                <span className={`text-xs font-medium ${data.conversionRatePct.pointChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {data.conversionRatePct.pointChange >= 0 ? "↗" : "↘"} {Math.abs(data.conversionRatePct.pointChange)} pts vs previous period
                </span>
              )
          }
        />
        <KpiCard label="Active policies" value={String(data.activePolicies)} sub={<span className="text-xs text-gray-400">Current state</span>} />
        <KpiCard label="New policies" value={String(data.newPolicies.value)} sub={<ChangeTag pct={data.newPolicies.pctChange} />} />

        <KpiCard label="Total premium" value={formatCurrency(data.totalPremium)} sub={<span className="text-xs text-gray-400">Active policies, current</span>} />
        <KpiCard label="Average premium" value={data.averagePremium !== null ? formatCurrency(data.averagePremium) : "No data"} sub={<span className="text-xs text-gray-400">Per active policy</span>} />
        <KpiCard label="Lost leads" value={String(data.lostLeads.value)} sub={<ChangeTag pct={data.lostLeads.pctChange} invert />} />
      </div>
    </div>
  );
}
