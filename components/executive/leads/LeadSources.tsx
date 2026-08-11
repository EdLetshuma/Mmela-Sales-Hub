"use client";

import React, { useEffect, useState } from "react";
import { getLeadSources, type LeadSourceData, type SourceRow } from "@/lib/lead-analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect, formatCurrency } from "./shared";

function SourceTable({ title, rows, caption }: { title: string; rows: SourceRow[]; caption?: string }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      {caption && <p className="text-xs text-gray-400 mb-3">{caption}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No data for this period.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium text-right">Leads</th>
                <th className="pb-2 font-medium text-right">Converted</th>
                <th className="pb-2 font-medium text-right">Conv. rate</th>
                <th className="pb-2 font-medium text-right">Policies</th>
                <th className="pb-2 font-medium text-right">Premium</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {rows.slice(0, 12).map((r) => (
                <tr key={r.label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 truncate max-w-[180px]">{r.label}</td>
                  <td className="py-2 text-right">{r.leads}</td>
                  <td className="py-2 text-right">{r.converted}</td>
                  <td className="py-2 text-right">{r.conversionRatePct !== null ? `${r.conversionRatePct}%` : "—"}</td>
                  <td className="py-2 text-right">{r.policies}</td>
                  <td className="py-2 text-right">{r.premium > 0 ? formatCurrency(r.premium) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 12 && <p className="text-[11px] text-gray-400 pt-2">+{rows.length - 12} more</p>}
        </div>
      )}
    </div>
  );
}

export default function LeadSources() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<LeadSourceData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getLeadSources(range)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load lead sources."); })
      .finally(() => setRefreshing(false));
  }, [range]);

  if (!data && !error) return <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />;
  if (error || !data) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  const best = [...data.bySource].filter((r) => r.leads >= 3).sort((a, b) => (b.conversionRatePct ?? 0) - (a.conversionRatePct ?? 0))[0];

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />

      {best && (
        <div className="card" style={{ borderLeft: "3px solid #0F6E56" }}>
          <p className="text-xs text-gray-500">Best-converting source this period (min. 3 leads)</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">{best.label} — {best.conversionRatePct}% conversion, {best.leads} leads</p>
        </div>
      )}

      <SourceTable title="By source" rows={data.bySource} caption="Where are our best leads coming from — ranked by volume, converted count and premium alongside it" />
      <SourceTable title="By source type" rows={data.bySourceType} />

      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">UTM breakdown</h2>
        <p className="text-xs text-gray-400 mb-3">Only populated for form-sourced leads that carried UTM parameters</p>
        <div className="grid grid-cols-3 gap-4">
          <SourceTable title="UTM source" rows={data.byUtmSource} />
          <SourceTable title="UTM medium" rows={data.byUtmMedium} />
          <SourceTable title="UTM campaign" rows={data.byUtmCampaign} />
        </div>
      </div>

      <p className="text-[11px] text-gray-400">Policies/premium are attributed via each lead&apos;s linked client — if a client has more than one lead, that client&apos;s premium is counted under each of those leads&apos; sources.</p>
    </div>
  );
}
