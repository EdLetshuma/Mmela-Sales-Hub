"use client";

import React, { useEffect, useState } from "react";
import { getLeadOverview, type LeadOverviewData } from "@/lib/lead-analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect, ChangeTag, KpiCard, BreakdownCard } from "./shared";

export default function LeadOverview() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<LeadOverviewData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getLeadOverview(range)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load lead overview."); })
      .finally(() => setRefreshing(false));
  }, [range]);

  if (!data && !error) {
    return <div className="grid grid-cols-4 gap-4">{[...Array(7)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  }
  if (error || !data) {
    return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;
  }

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total leads" value={String(data.totalLeads)} sub={<span className="text-xs text-gray-400">Current, all divisions</span>} />
        <KpiCard label="New leads" value={String(data.newLeads.value)} sub={<ChangeTag pct={data.newLeads.pctChange} />} />
        <KpiCard label="Active leads" value={String(data.activeLeads)} sub={<span className="text-xs text-gray-400">Not yet closed, current</span>} />
        <KpiCard label="Converted leads" value={String(data.convertedLeads.value)} sub={<ChangeTag pct={data.convertedLeads.pctChange} />} />
        <KpiCard label="Lost leads" value={String(data.lostLeads.value)} sub={<ChangeTag pct={data.lostLeads.pctChange} invert />} />
        <KpiCard
          label="Conversion rate"
          value={data.conversionRatePct !== null ? `${data.conversionRatePct}%` : "No data"}
          sub={<span className="text-xs text-gray-400">New leads in period</span>}
        />
        <KpiCard
          label="Average lead age"
          value={data.avgLeadAgeDays !== null ? `${data.avgLeadAgeDays}d` : "No data"}
          sub={<span className="text-xs text-gray-400">Currently-open leads</span>}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Breakdowns</h2>
        <p className="text-xs text-gray-400 mb-3">New leads in the selected period, by dimension</p>
        <div className="grid grid-cols-3 gap-4">
          <BreakdownCard title="By business unit" rows={data.breakdowns.businessUnit} />
          <BreakdownCard title="By status" rows={data.breakdowns.status} />
          <BreakdownCard title="By source" rows={data.breakdowns.source} />
          <BreakdownCard title="By source type" rows={data.breakdowns.sourceType} />
          <BreakdownCard title="By campaign" rows={data.breakdowns.campaign} emptyLabel="No campaign-sourced leads in this period" />
          <BreakdownCard title="By segment" rows={data.breakdowns.segment} emptyLabel="Segment only applies to Sales leads" />
          <BreakdownCard title="By assigned agent" rows={data.breakdowns.assignedAgent} />
        </div>
      </div>
    </div>
  );
}
