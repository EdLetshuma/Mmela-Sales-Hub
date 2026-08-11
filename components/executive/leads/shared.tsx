"use client";

import React from "react";
import { EXECUTIVE_RANGE_LABELS } from "@/lib/analytics-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import type { BreakdownRow } from "@/lib/lead-analytics-api";
import { Loader2 } from "lucide-react";

const RANGE_OPTIONS: ExecutiveRange[] = ["30d", "90d", "mtd", "ytd", "all"];

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RangeSelect({ range, setRange, refreshing }: { range: ExecutiveRange; setRange: (r: ExecutiveRange) => void; refreshing: boolean }) {
  return (
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
  );
}

export function ChangeTag({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
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

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

// A small horizontal bar list for "leads by X" breakdowns — caps at the
// top 8 rows so a high-cardinality field (like source) doesn't spill the
// card, with a note about how many more exist.
export function BreakdownCard({ title, rows, emptyLabel = "No data for this period" }: { title: string; rows: BreakdownRow[]; emptyLabel?: string }) {
  const top = rows.slice(0, 8);
  const max = top.length > 0 ? top[0].count : 1;
  const rest = rows.length - top.length;
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {top.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {top.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span className="truncate pr-2">{r.label}</span>
                <span className="flex-shrink-0 font-medium">{r.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
          {rest > 0 && <p className="text-[11px] text-gray-400 pt-1">+{rest} more</p>}
        </div>
      )}
    </div>
  );
}
