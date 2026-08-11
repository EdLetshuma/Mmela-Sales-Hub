"use client";

import React, { useEffect, useState } from "react";
import { getLeadAging, type AgingBucket } from "@/lib/lead-analytics-api";
import { AlertTriangle } from "lucide-react";

export default function LeadAging() {
  const [buckets, setBuckets] = useState<AgingBucket[] | null>(null);
  const [hasActivityData, setHasActivityData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openBucket, setOpenBucket] = useState<string | null>(null);

  useEffect(() => {
    getLeadAging()
      .then(({ buckets, hasActivityData }) => { setBuckets(buckets); setHasActivityData(hasActivityData); })
      .catch((err) => { console.error(err); setError("Failed to load lead aging."); });
  }, []);

  if (!buckets && !error) return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />;
  if (error || !buckets) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  const total = buckets.reduce((s, b) => s + b.count, 0);
  const oldOpen = buckets.find((b) => b.label === "30+ days")?.count ?? 0;
  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Open lead age</h2>
          <p className="text-xs text-gray-400">{total} currently open</p>
        </div>
        <p className="text-xs text-gray-400 mb-4">How long today&apos;s open leads have sat since creation</p>

        {total === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No open leads right now.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => (
              <div key={b.label}>
                <button className="w-full text-left" onClick={() => setOpenBucket(openBucket === b.label ? null : b.label)}>
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span className="font-medium text-gray-900">{b.label}</span>
                    <span>{b.count} leads</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((b.count / max) * 100)}%`, background: b.label === "30+ days" ? "#A32D2D" : "#235DCB" }}
                    />
                  </div>
                </button>
                {openBucket === b.label && (
                  <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-100 space-y-1 max-h-40 overflow-y-auto">
                    {b.leads.length === 0 ? (
                      <p className="text-xs text-gray-400">None.</p>
                    ) : (
                      b.leads.map((l) => (
                        <div key={l.id} className="flex justify-between text-xs text-gray-600">
                          <span>{l.name}</span>
                          <span className="text-gray-400">{l.ageDays}d</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {oldOpen > 0 && (
        <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: "#FFFBF5", border: "1px solid #FAEEDA" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#854F0B" }} />
          <div>
            <p className="text-xs font-medium text-gray-900">{oldOpen} lead{oldOpen !== 1 ? "s" : ""} open 30+ days</p>
            <p className="text-[11px] text-gray-500">Worth a look — old, still-open leads are the most likely to go cold.</p>
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg flex items-start gap-2" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
        <p className="text-xs text-gray-500">
          {hasActivityData
            ? "Activity-based signals (e.g. \"no contact attempt logged\") aren't shown yet on this page."
            : "This system isn't recording any lead activity yet (the activity log is empty), so age is calculated from creation date only — there's no data yet to distinguish an old lead that's been worked from one that's genuinely been untouched."}
        </p>
      </div>
    </div>
  );
}
