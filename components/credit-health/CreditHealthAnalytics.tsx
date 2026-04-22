"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CREDIT_HEALTH_UNIT_ID, CREDIT_HEALTH_STATUSES } from "@/lib/credit-health-api";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = ["#1A348C","#0058A3","#235DCB","#4B7FDB","#0F6E56","#854F0B","#A32D2D","#5F5E5A"];

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
  if (v >= 1_000_000) return `R ${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R ${(v/1_000).toFixed(1)}K`;
  return `R ${v.toFixed(0)}`;
}

export default function CreditHealthAnalytics() {
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("leads")
      .select("unit_status, source, employment_status, monthly_income, loan_amount, created_at, assigned_to_user_id")
      .eq("business_unit_id", CREDIT_HEALTH_UNIT_ID)
      .then(({ data }) => { setLeads(data ?? []); setLoading(false); });
  }, []);

  const stats = useMemo(() => {
    const approved = leads.filter(l => l.unit_status === "Approved").length;
    const declined = leads.filter(l => l.unit_status === "Declined").length;
    const active = leads.filter(l => ["Contacted","Assessment","Submitted"].includes(String(l.unit_status ?? ""))).length;
    const approvalRate = (approved + declined) > 0 ? Math.round((approved / (approved + declined)) * 1000) / 10 : 0;
    const totalLoanRequested = leads.reduce((s, l) => s + Number(l.loan_amount ?? 0), 0);
    const unassigned = leads.filter(l => !l.assigned_to_user_id).length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = leads.filter(l => String(l.created_at ?? "") >= startOfMonth).length;

    // Status breakdown
    const statusData = CREDIT_HEALTH_STATUSES.map(s => ({
      name: s, value: leads.filter(l => l.unit_status === s).length,
    })).filter(d => d.value > 0);

    // Employment breakdown
    const empMap: Record<string, number> = {};
    leads.forEach(l => { const e = String(l.employment_status ?? "Unknown"); empMap[e] = (empMap[e] ?? 0) + 1; });
    const empData = Object.entries(empMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    // Loan amount ranges
    const ranges = [
      { label: "< R50K",   min: 0,       max: 50000 },
      { label: "R50K–R100K", min: 50000, max: 100000 },
      { label: "R100K–R200K", min: 100000, max: 200000 },
      { label: "R200K–R500K", min: 200000, max: 500000 },
      { label: "> R500K", min: 500000, max: Infinity },
    ];
    const loanData = ranges.map(r => ({
      name: r.label,
      value: leads.filter(l => l.loan_amount && Number(l.loan_amount) >= r.min && Number(l.loan_amount) < r.max).length,
    })).filter(d => d.value > 0);

    // Income ranges
    const incomeRanges = [
      { label: "< R10K",   min: 0,      max: 10000 },
      { label: "R10K–R20K", min: 10000, max: 20000 },
      { label: "R20K–R40K", min: 20000, max: 40000 },
      { label: "R40K–R80K", min: 40000, max: 80000 },
      { label: "> R80K",  min: 80000,  max: Infinity },
    ];
    const incomeData = incomeRanges.map(r => ({
      name: r.label,
      value: leads.filter(l => l.monthly_income && Number(l.monthly_income) >= r.min && Number(l.monthly_income) < r.max).length,
    })).filter(d => d.value > 0);

    return { approved, declined, active, approvalRate, totalLoanRequested, unassigned, thisMonth, statusData, empData, loanData, incomeData };
  }, [leads]);

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Credit Health — credit advisory</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total leads" value={String(leads.length)} sub={`+${stats.thisMonth} this month`} />
        <KpiCard label="In progress" value={String(stats.active)} color="#235DCB" />
        <KpiCard label="Approved" value={String(stats.approved)} color="#0F6E56" />
        <KpiCard label="Approval rate" value={`${stats.approvalRate}%`} sub={`Total loans: ${formatCurrency(stats.totalLoanRequested)}`} color="#1A348C" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.statusData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 9 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" fill="#1A348C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Employment breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.empData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {stats.empData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {stats.loanData.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Loan amount ranges</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.loanData} margin={{ top: 0, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#0058A3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats.incomeData.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Monthly income ranges</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.incomeData} margin={{ top: 0, right: 10, left: 0, bottom: 20 }}>
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
