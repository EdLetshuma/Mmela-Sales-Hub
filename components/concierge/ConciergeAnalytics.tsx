"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CONCIERGE_UNIT_ID, CONCIERGE_STATUSES } from "@/lib/concierge-api";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = ["#1A348C","#0058A3","#235DCB","#4B7FDB","#7AA3E8","#0F6E56","#854F0B","#A32D2D"];

function KpiCard({ label, value, sub, color = "#111827" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ConciergeAnalytics() {
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("leads").select("unit_status, source, vehicle_make, vehicle_price, created_at, assigned_to_user_id")
      .eq("business_unit_id", CONCIERGE_UNIT_ID)
      .then(({ data }) => { setLeads(data ?? []); setLoading(false); });
  }, []);

  const stats = useMemo(() => {
    const won = leads.filter(l => l.unit_status === "Won").length;
    const active = leads.filter(l => ["Contacted","Sourcing","Quote Sent"].includes(String(l.unit_status ?? ""))).length;
    const conv = leads.length > 0 ? Math.round((won / leads.length) * 1000) / 10 : 0;
    const unassigned = leads.filter(l => !l.assigned_to_user_id).length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = leads.filter(l => String(l.created_at ?? "") >= startOfMonth).length;

    // Status breakdown
    const statusData = CONCIERGE_STATUSES.map(s => ({
      name: s, value: leads.filter(l => l.unit_status === s).length,
    })).filter(d => d.value > 0);

    // Source breakdown
    const srcMap: Record<string, number> = {};
    leads.forEach(l => { const s = String(l.source ?? "Other"); srcMap[s] = (srcMap[s] ?? 0) + 1; });
    const sourceData = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    // Make breakdown
    const makeMap: Record<string, number> = {};
    leads.forEach(l => { if (l.vehicle_make) { const m = String(l.vehicle_make); makeMap[m] = (makeMap[m] ?? 0) + 1; } });
    const makeData = Object.entries(makeMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    // Budget ranges
    const ranges = [
      { label: "< R200K", min: 0, max: 200000 },
      { label: "R200K–R400K", min: 200000, max: 400000 },
      { label: "R400K–R700K", min: 400000, max: 700000 },
      { label: "R700K–R1M", min: 700000, max: 1000000 },
      { label: "> R1M", min: 1000000, max: Infinity },
    ];
    const budgetData = ranges.map(r => ({
      name: r.label,
      value: leads.filter(l => l.vehicle_price && Number(l.vehicle_price) >= r.min && Number(l.vehicle_price) < r.max).length,
    })).filter(d => d.value > 0);

    return { won, active, conv, unassigned, thisMonth, statusData, sourceData, makeData, budgetData };
  }, [leads]);

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Concierge — vehicle acquisition</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total leads" value={String(leads.length)} sub={`+${stats.thisMonth} this month`} />
        <KpiCard label="Active" value={String(stats.active)} color="#235DCB" />
        <KpiCard label="Won" value={String(stats.won)} color="#0F6E56" />
        <KpiCard label="Win rate" value={`${stats.conv}%`} sub={stats.unassigned > 0 ? `${stats.unassigned} unassigned` : undefined} color="#1A348C" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.statusData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" fill="#1A348C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by source</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {stats.sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {stats.makeData.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Popular vehicle makes</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.makeData} layout="vertical" margin={{ top: 0, right: 10, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#0058A3" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats.budgetData.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Budget distribution</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.budgetData} margin={{ top: 0, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#235DCB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
