"use client";

import React, { useEffect, useState } from "react";
import { getLostLeads, type LostLeadsData, type LeadScope } from "@/lib/lead-analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect, ChangeTag, KpiCard, BreakdownCard } from "./shared";

export default function LostLeads({ scope }: { scope?: LeadScope } = {}) {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<LostLeadsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getLostLeads(range, scope)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load lost leads."); })
      .finally(() => setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, scope?.division, scope?.onlyUserId]);

  if (!data && !error) return <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  if (error || !data) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  const byReasonCounts = data.byReason.map((r) => ({ label: r.reason, count: r.count }));

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />

      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Total lost" value={String(data.totalLost.value)} sub={<ChangeTag pct={data.totalLost.pctChange} invert />} />
        <KpiCard
          label="Loss rate"
          value={data.lossRatePct !== null ? `${data.lossRatePct}%` : "No data"}
          sub={<span className="text-xs text-gray-400">Lost &divide; (lost + won) this period</span>}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BreakdownCard title="Loss reasons (Sales)" rows={byReasonCounts} emptyLabel="No lost Sales leads in this period" />
        <BreakdownCard title="By division" rows={data.byDivision} />
        <BreakdownCard title="By agent" rows={data.byAgent} />
        <BreakdownCard title="By source" rows={data.bySource} />
      </div>

      <p className="text-[11px] text-gray-400">Loss reasons are only captured for Sales leads &mdash; Concierge and Credit Health mark a lead Lost/Declined without a reason field, so those don&apos;t appear in the reason breakdown (they do count in the other breakdowns above).</p>
    </div>
  );
}
