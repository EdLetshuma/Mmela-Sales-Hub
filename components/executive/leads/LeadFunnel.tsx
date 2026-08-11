"use client";

import React, { useEffect, useState } from "react";
import { getLeadFunnel, type FunnelData, type FunnelDivision } from "@/lib/lead-analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect } from "./shared";

const DIVISIONS: { key: FunnelDivision; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "concierge", label: "Concierge" },
  { key: "creditHealth", label: "Credit Health" },
];

export default function LeadFunnel() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [division, setDivision] = useState<FunnelDivision>("sales");
  const [data, setData] = useState<FunnelData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStage, setOpenStage] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    setOpenStage(null);
    getLeadFunnel(division, range)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load the lead funnel."); })
      .finally(() => setRefreshing(false));
  }, [division, range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-md overflow-hidden border border-gray-200">
          {DIVISIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDivision(d.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${division === d.key ? "bg-brand-700 text-white" : "bg-white text-gray-500 hover:text-gray-900"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />
      </div>

      {!data && !error && <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />}
      {error && <div className="card text-center py-12"><p className="text-sm text-red-500">{error}</p></div>}

      {data && (
        <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">{DIVISIONS.find((d) => d.key === division)?.label} funnel</h2>
              <p className="text-xs text-gray-400">
                Overall: {data.overallConversionPct !== null ? `${data.overallConversionPct}% reach the final stage` : "No leads in this period"}
              </p>
            </div>

            {data.stages.every((s) => s.count === 0) ? (
              <p className="text-sm text-gray-400 py-8 text-center">No leads in this period for this division.</p>
            ) : (
              <div className="space-y-3">
                {data.stages.map((s, i) => (
                  <div key={s.stage}>
                    <button
                      className="w-full text-left"
                      onClick={() => setOpenStage(openStage === s.stage ? null : s.stage)}
                    >
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span className="font-medium text-gray-900">{s.stage}</span>
                        <span>
                          {s.count} leads &middot; {s.pctOfTotal}% of total
                          {s.pctOfPrevStage !== null && <span className="text-gray-400"> &middot; {s.pctOfPrevStage}% from previous stage</span>}
                        </span>
                      </div>
                      <div className="h-6 rounded-md bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center justify-end pr-2 transition-all"
                          style={{
                            width: `${Math.max(s.pctOfTotal, s.count > 0 ? 4 : 0)}%`,
                            background: `linear-gradient(90deg, #1A348C, #235DCB)`,
                            opacity: 1 - i * 0.12,
                          }}
                        />
                      </div>
                    </button>
                    {openStage === s.stage && (
                      <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-100 space-y-1 max-h-40 overflow-y-auto">
                        {data.leadsByStage[s.stage].length === 0 ? (
                          <p className="text-xs text-gray-400">No leads at this stage.</p>
                        ) : (
                          data.leadsByStage[s.stage].map((l) => (
                            <p key={l.id} className="text-xs text-gray-600">{l.name}</p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            A lead that reached a later stage counts at every earlier stage too — e.g. a Won lead also counts as having been Prospect, Contacted, and Quoted.
            Lost/declined leads aren&apos;t shown as a funnel stage since they&apos;re an exit, not forward progress &mdash; see Lost Leads for that breakdown.
          </p>
        </div>
      )}
    </div>
  );
}
