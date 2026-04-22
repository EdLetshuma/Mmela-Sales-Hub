"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UnitStats {
  name: string;
  totalLeads: number;
  won: number;
  conversionRate: number;
  color: string;
}

interface SourceBreakdown {
  source: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  sales: number;
  concierge: number;
  creditHealth: number;
}

function formatPct(val: number) {
  return `${val.toFixed(1)}%`;
}

function BarRow({
  label,
  value,
  max,
  display,
  color = "#235DCB",
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  color?: string;
}) {
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
      <span className="text-sm font-medium text-gray-900 w-20 text-right flex-shrink-0">
        {display}
      </span>
    </div>
  );
}

export default function HubAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats[]>([]);
  const [sources, setSources] = useState<SourceBreakdown[]>([]);
  const [totals, setTotals] = useState({
    leads: 0,
    clients: 0,
    policies: 0,
    premium: 0,
  });

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [leadsRes, clientsRes, policiesRes, businessUnitsRes] =
          await Promise.all([
            supabase.from("leads").select("id, status, source, source_type, business_unit_id, segment, created_at"),
            supabase.from("clients").select("id, segment"),
            supabase.from("policies").select("id, status, premium, client_segment"),
            supabase.from("business_units").select("id, name, slug"),
          ]);

        const leads = leadsRes.data ?? [];
        const clients = clientsRes.data ?? [];
        const policies = policiesRes.data ?? [];
        const units = businessUnitsRes.data ?? [];

        // Totals
        const activePolicies = policies.filter((p) => p.status === "Active");
        const totalPremium = activePolicies.reduce(
          (s, p) => s + Number(p.premium ?? 0),
          0
        );
        setTotals({
          leads: leads.length,
          clients: clients.length,
          policies: activePolicies.length,
          premium: totalPremium,
        });

        // Unit breakdown
        // Sales = Individual segment leads (legacy system)
        // Concierge + Credit Health = by business_unit_id
        const unitColors: Record<string, string> = {
          sales: "#235DCB",
          concierge: "#854F0B",
          "credit-health": "#0F6E56",
        };

        const salesLeads = leads.filter(
          (l) =>
            l.segment === "Individual" ||
            l.source_type === "legacy" ||
            !l.business_unit_id
        );
        const salesWon = salesLeads.filter((l) => l.status === "Won").length;

        const stats: UnitStats[] = [
          {
            name: "Insurance Sales",
            totalLeads: salesLeads.length,
            won: salesWon,
            conversionRate:
              salesLeads.length > 0
                ? Math.round((salesWon / salesLeads.length) * 1000) / 10
                : 0,
            color: unitColors.sales,
          },
        ];

        // Add business unit stats
        units.forEach((unit) => {
          const unitLeads = leads.filter(
            (l) => l.business_unit_id === unit.id
          );
          const unitWon = unitLeads.filter((l) => l.status === "Won").length;
          stats.push({
            name: unit.name,
            totalLeads: unitLeads.length,
            won: unitWon,
            conversionRate:
              unitLeads.length > 0
                ? Math.round((unitWon / unitLeads.length) * 1000) / 10
                : 0,
            color:
              unitColors[unit.slug as keyof typeof unitColors] ?? "#6B7280",
          });
        });

        setUnitStats(stats);

        // Source breakdown
        const sourceCounts: Record<string, number> = {};
        leads.forEach((l) => {
          const src = l.source || l.source_type || "Other";
          sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
        });
        setSources(
          Object.entries(sourceCounts)
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-50" />
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

  const maxLeads = Math.max(...unitStats.map((u) => u.totalLeads), 1);
  const maxSource = Math.max(...sources.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cross-unit overview — all business units
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total leads</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totals.leads.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Total clients</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totals.clients.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Active policies</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totals.policies.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Monthly premium</p>
          <p className="text-2xl font-semibold text-gray-900">
            R{" "}
            {totals.premium >= 1_000_000
              ? `${(totals.premium / 1_000_000).toFixed(2)}M`
              : totals.premium >= 1_000
              ? `${(totals.premium / 1_000).toFixed(1)}K`
              : totals.premium.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Unit performance + Sources */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Leads by business unit
          </h2>
          {unitStats.map((unit) => (
            <BarRow
              key={unit.name}
              label={unit.name}
              value={unit.totalLeads}
              max={maxLeads}
              display={`${unit.totalLeads.toLocaleString()} leads`}
              color={unit.color}
            />
          ))}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Leads by source
          </h2>
          {sources.length === 0 ? (
            <p className="text-sm text-gray-400">No data available.</p>
          ) : (
            sources.map(({ source, count }) => (
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

      {/* Conversion by unit */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Conversion rate by unit
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {unitStats.map((unit) => (
            <div
              key={unit.name}
              className="p-4 rounded-lg"
              style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}
            >
              <p className="text-xs text-gray-400 mb-1">{unit.name}</p>
              <p
                className="text-2xl font-semibold"
                style={{ color: unit.color }}
              >
                {formatPct(unit.conversionRate)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {unit.won} won of {unit.totalLeads} leads
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
