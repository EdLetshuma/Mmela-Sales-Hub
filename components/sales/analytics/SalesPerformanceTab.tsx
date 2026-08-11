"use client";

import React, { useEffect, useState } from "react";
import { getSalesPerformance, type SalesPerformanceData } from "@/lib/sales-performance-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect, KpiCard, formatCurrency } from "@/components/executive/leads/shared";

export default function SalesPerformanceTab({ onlyUserId }: { onlyUserId?: string }) {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getSalesPerformance(range, onlyUserId)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load sales performance."); })
      .finally(() => setRefreshing(false));
  }, [range, onlyUserId]);

  if (!data && !error) return <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}</div>;
  if (error || !data) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Policies sold" value={String(data.kpis.totalPoliciesSold)} />
        <KpiCard label="Active premium" value={formatCurrency(data.kpis.totalPremium)} />
        <KpiCard label="Avg. premium" value={data.kpis.averagePremium !== null ? formatCurrency(data.kpis.averagePremium) : "No data"} />
        <KpiCard label="Conversion rate" value={data.kpis.conversionRatePct !== null ? `${data.kpis.conversionRatePct}%` : "No leads"} />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{onlyUserId ? "My performance" : "Agent leaderboard"}</h3>
        {data.agents.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No data for this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">Leads</th>
                  <th className="pb-2 font-medium text-right">Converted</th>
                  <th className="pb-2 font-medium text-right">Lost</th>
                  <th className="pb-2 font-medium text-right">Conv. rate</th>
                  <th className="pb-2 font-medium text-right">Policies sold</th>
                  <th className="pb-2 font-medium text-right">Premium generated</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {data.agents.map((a) => (
                  <tr key={a.userId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-gray-500">{a.role}</td>
                    <td className="py-2 text-right">{a.leads}</td>
                    <td className="py-2 text-right">{a.converted}</td>
                    <td className="py-2 text-right">{a.lost}</td>
                    <td className="py-2 text-right">{a.conversionRatePct !== null ? `${a.conversionRatePct}%` : "—"}</td>
                    <td className="py-2 text-right">{a.policiesSold}</td>
                    <td className="py-2 text-right font-medium">{a.premiumGenerated > 0 ? formatCurrency(a.premiumGenerated) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
