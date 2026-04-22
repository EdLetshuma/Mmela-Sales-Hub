"use client";

import React, { useEffect, useState } from "react";
import {
  getLeadsBySource,
  getPoliciesByInsurer,
  getDashboardStats,
  type SalesDashboardStats,
} from "@/lib/sales-api";
import type { ClientSegment } from "@/types";

interface SalesAnalyticsProps {
  segment: ClientSegment;
}

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  display: string;
  color?: string;
}

function BarRow({ label, value, max, display, color = "#235DCB" }: BarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700 w-36 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-medium text-gray-900 w-24 text-right flex-shrink-0">
        {display}
      </span>
    </div>
  );
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `R ${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `R ${(val / 1_000).toFixed(1)}K`;
  return `R ${val.toFixed(2)}`;
}

export default function SalesAnalytics({ segment }: SalesAnalyticsProps) {
  const [stats, setStats] = useState<SalesDashboardStats | null>(null);
  const [leadSources, setLeadSources] = useState<{ source: string; count: number }[]>([]);
  const [insurerData, setInsurerData] = useState<{ insurer: string; count: number; premium: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getDashboardStats(segment),
      getLeadsBySource(segment),
      getPoliciesByInsurer(segment),
    ])
      .then(([statsData, sources, insurers]) => {
        setStats(statsData);
        setLeadSources(sources);
        setInsurerData(insurers);
      })
      .catch(() => setError("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [segment]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card h-64 animate-pulse bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const maxSource = Math.max(...leadSources.map((s) => s.count), 1);
  const maxInsurerCount = Math.max(...insurerData.map((i) => i.count), 1);
  const maxInsurerPremium = Math.max(...insurerData.map((i) => i.premium), 1);

  const pipeline = stats?.pipeline;
  const pipelineRows = pipeline
    ? [
        { label: "Prospect", value: pipeline.prospect, color: "#235DCB" },
        { label: "Contacted", value: pipeline.contacted, color: "#235DCB" },
        { label: "Quoted", value: pipeline.quoted, color: "#854F0B" },
        { label: "Won", value: pipeline.won, color: "#0F6E56" },
        { label: "Lost", value: pipeline.lost, color: "#A32D2D" },
      ]
    : [];
  const pipelineMax = Math.max(...pipelineRows.map((r) => r.value), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">{segment} segment overview</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total leads</p>
          <p className="text-2xl font-semibold text-gray-900">{stats?.totalLeads ?? "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Conversion rate</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats ? `${stats.conversionRate}%` : "—"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Active policies</p>
          <p className="text-2xl font-semibold text-gray-900">{stats?.activePolicies ?? "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Monthly premium</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats ? formatCurrency(stats.totalMonthlyPremium) : "—"}
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pipeline */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Sales pipeline</h2>
          {pipelineRows.map(({ label, value, color }) => (
            <BarRow
              key={label}
              label={label}
              value={value}
              max={pipelineMax}
              display={String(value)}
              color={color}
            />
          ))}
        </div>

        {/* Leads by source */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by source</h2>
          {leadSources.length === 0 ? (
            <p className="text-sm text-gray-400">No data available.</p>
          ) : (
            leadSources.map(({ source, count }) => (
              <BarRow
                key={source}
                label={source}
                value={count}
                max={maxSource}
                display={String(count)}
              />
            ))
          )}
        </div>
      </div>

      {/* Insurer breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Policies by insurer
          </h2>
          {insurerData.map(({ insurer, count }) => (
            <BarRow
              key={insurer}
              label={insurer}
              value={count}
              max={maxInsurerCount}
              display={`${count} policies`}
              color="#1A348C"
            />
          ))}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Active premium by insurer
          </h2>
          {insurerData
            .filter((i) => i.premium > 0)
            .sort((a, b) => b.premium - a.premium)
            .map(({ insurer, premium }) => (
              <BarRow
                key={insurer}
                label={insurer}
                value={premium}
                max={maxInsurerPremium}
                display={formatCurrency(premium)}
                color="#0F6E56"
              />
            ))}
        </div>
      </div>
    </div>
  );
}
