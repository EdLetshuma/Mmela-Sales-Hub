"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientSegment } from "@/types";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface SalesAnalyticsProps {
  segment: ClientSegment;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#1A348C","#0058A3","#235DCB","#4B7FDB","#7AA3E8","#A8C4F0","#0F6E56","#854F0B","#A32D2D","#5F5E5A"];
const RADIAN = Math.PI / 180;
function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, name }: {
  cx: number; cy: number; midAngle: number; innerRadius: number;
  outerRadius: number; percent: number; name: string;
}) {
  if (percent < 0.04) return null;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const ex = cx + (outerRadius + 14) * Math.cos(-midAngle * RADIAN);
  const ey = cy + (outerRadius + 14) * Math.sin(-midAngle * RADIAN);
  return (
    <g>
      <line x1={cx + (outerRadius + 4) * Math.cos(-midAngle * RADIAN)}
            y1={cy + (outerRadius + 4) * Math.sin(-midAngle * RADIAN)}
            x2={ex} y2={ey} stroke="#D1D5DB" strokeWidth={1} />
      <text x={x} y={y} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central"
            style={{ fontSize: 10, fill: "#374151", fontWeight: 500 }}>
        {name} {(percent * 100).toFixed(0)}%
      </text>
    </g>
  );
}


function KpiCard({ label, value, sub, color = "#111827" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `R ${(v/1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R ${(v/1_000).toFixed(1)}K`;
  return `R ${v.toFixed(0)}`;
}

export default function SalesAnalytics({ segment }: SalesAnalyticsProps) {
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [policies, setPolicies] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const [lr, pr, ur] = await Promise.all([
        supabase.from("leads").select("status, source, created_at, assigned_to_user_id, segment")
          .eq("segment", segment),
        supabase.from("policies").select("status, premium, insurer, product_category, sale_date, sold_by_user_id, client_segment")
          .eq("client_segment", segment),
        supabase.from("users").select("id, name, role").in("role", ["Sales Agent","Team Leader"]).eq("status","Active"),
      ]);
      setLeads(lr.data ?? []);
      setPolicies(pr.data ?? []);
      setUsers(ur.data ?? []);
      setLoading(false);
    }
    fetch();
  }, [segment]);

  const { kpis, monthly, sourceData, insurerData, agentData } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const activePolicies = policies.filter(p => p.status === "Active");
    const totalPremium = activePolicies.reduce((s, p) => s + Number(p.premium ?? 0), 0);
    const won = leads.filter(l => l.status === "Won").length;
    const conv = leads.length > 0 ? Math.round((won / leads.length) * 100) / 100 : 0;
    const newThisMonth = leads.filter(l => l.created_at >= startOfMonth).length;

    // Monthly premium trend
    const y = parseInt(yearFilter);
    const monthMap = MONTHS.reduce((a, m) => ({ ...a, [m]: 0 }), {} as Record<string, number>);
    policies.forEach(p => {
      if (p.sale_date) {
        const d = new Date(p.sale_date as string);
        if (d.getFullYear() === y) monthMap[MONTHS[d.getMonth()]] += Number(p.premium ?? 0);
      }
    });
    const monthly = MONTHS.map(m => ({ month: m, Premium: monthMap[m] }));

    // Source breakdown
    const srcMap: Record<string, number> = {};
    leads.forEach(l => { const s = String(l.source ?? "Other"); srcMap[s] = (srcMap[s] ?? 0) + 1; });
    const sourceData = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // Insurer breakdown
    const insMap: Record<string, number> = {};
    activePolicies.forEach(p => { const i = String(p.insurer ?? "Unknown"); insMap[i] = (insMap[i] ?? 0) + Number(p.premium ?? 0); });
    const insurerData = Object.entries(insMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // Agent leaderboard
    const agentData = users.map(u => {
      const ap = policies.filter(p => p.sold_by_user_id === u.id && p.status === "Active");
      return { name: String(u.name), premium: ap.reduce((s, p) => s + Number(p.premium ?? 0), 0) };
    }).sort((a, b) => b.premium - a.premium).slice(0, 8);

    return { kpis: { totalPremium, activePolicies: activePolicies.length, won, conv, newThisMonth, totalLeads: leads.length }, monthly, sourceData, insurerData, agentData };
  }, [leads, policies, users, yearFilter]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    policies.forEach(p => { if (p.sale_date) ys.add(new Date(p.sale_date as string).getFullYear()); });
    return Array.from(ys).sort((a, b) => b - a);
  }, [policies]);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{segment} segment</p>
        </div>
        <select className="input-field" style={{ width: 120 }} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total leads" value={String(kpis.totalLeads)} sub={`+${kpis.newThisMonth} this month`} />
        <KpiCard label="Won" value={String(kpis.won)} color="#0F6E56" />
        <KpiCard label="Conversion" value={`${kpis.conv}%`} sub="Win rate" color="#235DCB" />
        <KpiCard label="Active policies" value={String(kpis.activePolicies)} color="#1A348C" />
        <KpiCard label="Active premium" value={formatCurrency(kpis.totalPremium)} color="#1A348C" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Monthly premium — {yearFilter}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="premGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A348C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1A348C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
              <Tooltip formatter={(v: number) => [`R ${v.toLocaleString("en-ZA")}`, "Premium"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="Premium" stroke="#1A348C" strokeWidth={2} fill="url(#premGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by source</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 25, right: 40, bottom: 25, left: 40 }}>
              <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={renderPieLabel} labelLine={false}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [v, "Leads"]} contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Active premium by insurer</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={insurerData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `R${Math.round(v/1000)}k` : `R${v}`} />
              <YAxis type="category" dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v: number) => [`R ${v.toLocaleString("en-ZA")}`, "Premium"]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" fill="#1A348C" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Agent leaderboard — active premium</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agentData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `R${Math.round(v/1000)}k` : `R${v}`} />
              <YAxis type="category" dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v: number) => [`R ${v.toLocaleString("en-ZA")}`, "Premium"]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="premium" fill="#0058A3" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
