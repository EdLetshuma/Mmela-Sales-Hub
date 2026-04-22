"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getPolicies, getLeads, getSalesUsers, type SalesPolicy, type SalesLead, type SalesUser } from "@/lib/sales-api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ClientSegment } from "@/types";
import SalesTrendChart from "@/components/sales/SalesTrendChart";
import { Trophy } from "lucide-react";

interface AgentPerformanceProps {
  segment: ClientSegment;
}

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `R ${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `R ${(val / 1_000).toFixed(1)}K`;
  return `R ${val.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card h-full flex flex-col justify-between">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BeatYourBestCard({ bestWeek, thisWeek }: { bestWeek: { key: string; premium: number }; thisWeek: number }) {
  const progress = bestWeek.premium > 0 ? Math.min((thisWeek / bestWeek.premium) * 100, 100) : 0;
  return (
    <div className="card h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Beat your best week</p>
        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900 mt-2">{formatCurrency(bestWeek.premium)}</p>
        <p className="text-xs text-gray-400">{bestWeek.key || "No data yet"}</p>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>This week</span>
          <span>{formatCurrency(thisWeek)}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #EF9F27, #BA7517)" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AgentPerformance({ segment }: AgentPerformanceProps) {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("All");
  const [viewingAgentId, setViewingAgentId] = useState<string>(user?.id ?? "");

  const isManager = user && ["Admin", "Manager", "Team Leader"].includes(user.role);

  useEffect(() => {
    if (user?.id) setViewingAgentId(user.id);
  }, [user?.id]);

  useEffect(() => {
    Promise.all([
      getPolicies({ segment }),
      getLeads({ segment }),
      getSalesUsers(),
    ])
      .then(([p, l, u]) => { setPolicies(p); setLeads(l); setUsers(u); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [segment]);

  const targetAgent = users.find((u) => u.id === viewingAgentId);

  const { kpis, weeklyData } = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const myPolicies = policies.filter((p) => p.sold_by_user_id === viewingAgentId);
    const myLeads = leads.filter((l) => l.assigned_to_user_id === viewingAgentId);

    const salesThisMonth = myPolicies.filter((p) => p.sale_date && new Date(p.sale_date) >= startOfMonth).length;
    const salesLastMonth = myPolicies.filter((p) => p.sale_date && new Date(p.sale_date) >= startOfLastMonth && new Date(p.sale_date) < startOfMonth).length;
    const revThisMonth = myPolicies.filter((p) => p.sale_date && new Date(p.sale_date) >= startOfMonth).reduce((s, p) => s + Number(p.premium ?? 0), 0);
    const revLastMonth = myPolicies.filter((p) => p.sale_date && new Date(p.sale_date) >= startOfLastMonth && new Date(p.sale_date) < startOfMonth).reduce((s, p) => s + Number(p.premium ?? 0), 0);
    const pipeline = myLeads.filter((l) => ["Prospect", "Contacted", "Quoted"].includes(l.status ?? "")).length;

    const pctChange = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

    // Weekly premiums
    const weekMap: Record<string, number> = {};
    myPolicies.forEach((p) => {
      if (p.sale_date) {
        const k = getWeekKey(new Date(p.sale_date));
        weekMap[k] = (weekMap[k] ?? 0) + Number(p.premium ?? 0);
      }
    });
    let bestWeek = { key: "N/A", premium: 0 };
    for (const [k, v] of Object.entries(weekMap)) {
      if (v > bestWeek.premium) bestWeek = { key: k, premium: v };
    }
    const thisWeekKey = getWeekKey(now);
    const thisWeekPremium = weekMap[thisWeekKey] ?? 0;

    return {
      kpis: {
        salesThisMonth,
        salesChange: pctChange(salesThisMonth, salesLastMonth),
        revThisMonth,
        revChange: pctChange(revThisMonth, revLastMonth),
        pipeline,
      },
      weeklyData: { bestWeek, thisWeekPremium },
    };
  }, [policies, leads, viewingAgentId]);

  // Leaderboard
  const leaderboard = useMemo(() => {
    return users
      .filter((u) => ["Sales Agent", "Team Leader"].includes(u.role))
      .map((u) => ({
        name: u.name,
        id: u.id,
        premium: policies
          .filter((p) => p.sold_by_user_id === u.id && p.status === "Active")
          .reduce((s, p) => s + Number(p.premium ?? 0), 0),
      }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 10);
  }, [users, policies]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    policies.filter((p) => p.sold_by_user_id === viewingAgentId && p.sale_date)
      .forEach((p) => years.add(new Date(p.sale_date!).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [policies, viewingAgentId]);

  const agentName = targetAgent?.name ?? user?.name ?? "You";
  const firstName = agentName.split(" ")[0];

  if (loading) return (
    <div className="space-y-4">
      <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="card h-28 animate-pulse bg-gray-50" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isManager && viewingAgentId !== user?.id
              ? `Performance — ${agentName}`
              : "Your performance"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isManager && viewingAgentId !== user?.id
              ? `Detailed view of ${firstName}'s sales performance`
              : "Your personal sales dashboard"}
          </p>
        </div>
        {isManager && (
          <select
            className="input-field"
            style={{ width: 180 }}
            value={viewingAgentId}
            onChange={(e) => setViewingAgentId(e.target.value)}
          >
            <option value={user?.id ?? ""}>My performance</option>
            {users
              .filter((u) => u.id !== user?.id && ["Sales Agent", "Team Leader"].includes(u.role))
              .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <BeatYourBestCard bestWeek={weeklyData.bestWeek} thisWeek={weeklyData.thisWeekPremium} />
        <KpiCard
          label="Revenue this month"
          value={formatCurrency(kpis.revThisMonth)}
          sub={`${kpis.revChange > 0 ? "+" : ""}${kpis.revChange}% vs last month`}
        />
        <KpiCard
          label="New sales this month"
          value={String(kpis.salesThisMonth)}
          sub={`${kpis.salesChange > 0 ? "+" : ""}${kpis.salesChange}% vs last month`}
        />
        <KpiCard
          label="Deals in pipeline"
          value={String(kpis.pipeline)}
          sub="Active prospects & quotes"
        />
      </div>

      {/* Sales trend */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            {yearFilter === "All"
              ? `${firstName}'s sales trend — all time`
              : `${firstName}'s sales trend — ${yearFilter}`}
          </h2>
          <select
            className="input-field text-xs"
            style={{ width: 120 }}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="All">All time</option>
            <option value={String(new Date().getFullYear())}>This year</option>
            {availableYears
              .filter((y) => y !== new Date().getFullYear())
              .map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <SalesTrendChart policies={policies} userId={viewingAgentId} year={yearFilter} />
      </div>

      {/* Leaderboard */}
      {isManager && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Agent leaderboard — active premium</h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                <th className="pb-2 text-left text-xs font-medium text-gray-400">#</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Agent</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Active premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaderboard.map((agent, i) => (
                <tr key={agent.id} className={`hover:bg-gray-50 cursor-pointer ${viewingAgentId === agent.id ? "bg-brand-50" : ""}`} onClick={() => setViewingAgentId(agent.id)}>
                  <td className="py-2.5 text-xs text-gray-400 w-8">{i + 1}</td>
                  <td className="py-2.5 font-medium text-gray-900">{agent.name}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{formatCurrency(agent.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
