"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getPolicyAdminOverview, type PolicyAdminOverview } from "@/lib/sales-api";
import type { ClientSegment } from "@/types";
import { FileText, ShieldAlert, RotateCcw, ArrowRight } from "lucide-react";

interface PolicyAdminDashboardProps {
  segment: ClientSegment;
  onNavigate: (path: string) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getInitials(name: string): string {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const STATUS_COLORS: Record<string, string> = {
  active: "#0F6E56",
  pending: "#854F0B",
  canceled: "#A32D2D",
  expired: "#A32D2D",
  retained: "#1A348C",
};

export default function PolicyAdminDashboard({ segment, onNavigate }: PolicyAdminDashboardProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const [data, setData] = useState<PolicyAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPolicyAdminOverview(segment)
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, [segment]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error ?? "No data available."}</p>
      </div>
    );
  }

  const statusTotal = Object.values(data.policyStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card" style={{ background: "linear-gradient(135deg, #0F1E4D 0%, #1A348C 100%)" }}>
        <p className="text-xs font-medium mb-2" style={{ color: "rgba(204,224,245,.7)" }}>
          {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="text-2xl font-bold text-white">Welcome back, {firstName}.</h1>
        <p className="text-sm mt-2" style={{ color: "rgba(204,224,245,.85)" }}>
          {data.pendingDocs > 0
            ? <>You have <strong className="text-white">{data.pendingDocs} polic{data.pendingDocs !== 1 ? "ies" : "y"}</strong> missing documentation
                and <strong className="text-white">{data.retentionsCount}</strong> in retention.</>
            : "All active policies have complete documentation."}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Clients</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{data.totalClients}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Active policies</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{data.activePolicies}</p>
          <p className="text-xs mt-1.5 text-gray-400">{formatCurrency(data.totalMonthlyPremium)} / mo</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Missing documentation</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{data.pendingDocs}</p>
          {data.pendingDocs > 0 && <p className="text-xs mt-1.5 font-medium text-amber-600">Needs attention</p>}
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">In retention</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">{data.retentionsCount}</p>
          <p className="text-xs mt-1.5 text-gray-400">Canceled or expired</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Recent clients */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent clients</h2>
            <button className="btn btn-ghost text-xs text-brand-700 hover:text-brand-900" onClick={() => onNavigate("/sales/clients")}>
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
          {data.recentClients.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No clients yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <p className="text-sm font-medium text-gray-900 leading-tight">{c.name}</p>
                  </div>
                  <span className="badge" style={{ background: "#F1F3F5", color: "#444441" }}>{c.segment ?? "Individual"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Policy status</h2>
            <div className="space-y-2.5">
              {([
                { label: "Active", value: data.policyStatus.active, key: "active" },
                { label: "Pending", value: data.policyStatus.pending, key: "pending" },
                { label: "Retained", value: data.policyStatus.retained, key: "retained" },
                { label: "Canceled", value: data.policyStatus.canceled, key: "canceled" },
                { label: "Expired", value: data.policyStatus.expired, key: "expired" },
              ]).map(({ label, value, key }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{label}</span><span>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((value / statusTotal) * 100)}%`, backgroundColor: STATUS_COLORS[key] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h2>
            <div className="space-y-2">
              <button className="btn btn-secondary w-full justify-start gap-2.5 text-sm" onClick={() => onNavigate("/sales/clients")}>
                <FileText className="w-4 h-4 text-gray-400" />
                Add client
              </button>
              <button className="btn btn-secondary w-full justify-start gap-2.5 text-sm" onClick={() => onNavigate("/sales/policies")}>
                <ShieldAlert className="w-4 h-4 text-gray-400" />
                New policy
              </button>
              <button className="btn btn-secondary w-full justify-start gap-2.5 text-sm" onClick={() => onNavigate("/sales/retentions")}>
                <RotateCcw className="w-4 h-4 text-gray-400" />
                View retentions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
