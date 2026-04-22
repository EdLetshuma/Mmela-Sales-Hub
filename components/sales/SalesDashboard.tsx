"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getDashboardStats,
  getLeads,
  type SalesDashboardStats,
  type SalesLead,
} from "@/lib/sales-api";
import type { ClientSegment } from "@/types";
import { Users, FileText, TrendingUp, ArrowRight } from "lucide-react";

interface SalesDashboardProps {
  segment: ClientSegment;
  onNavigate: (path: string) => void;
}

const STATUS_BAR_COLORS: Record<string, string> = {
  prospect: "#235DCB",
  contacted: "#235DCB",
  quoted: "#854F0B",
  won: "#0F6E56",
  lost: "#A32D2D",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Prospect: "badge-prospect",
    Contacted: "badge-contacted",
    Quoted: "badge-quoted",
    Won: "badge-won",
    Lost: "badge-lost",
    "Retention Failure": "badge-lost",
  };
  return (
    <span className={`badge ${map[status] ?? "badge-prospect"}`}>{status}</span>
  );
}

export default function SalesDashboard({
  segment,
  onNavigate,
}: SalesDashboardProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  const [stats, setStats] = useState<SalesDashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getDashboardStats(segment),
      getLeads({ segment, assigned: "mine", userId: user?.id }),
    ])
      .then(([statsData, leads]) => {
        setStats(statsData);
        // Show up to 5 most recent leads assigned to this user,
        // falling back to any recent leads if none assigned
        setRecentLeads(
          leads.length > 0
            ? leads.slice(0, 5)
            : []
        );
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data.");
      })
      .finally(() => setLoading(false));
  }, [segment, user?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error}</p>
        <button
          className="btn btn-secondary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const pipeline = stats?.pipeline;
  const pipelineTotal = pipeline
    ? pipeline.prospect + pipeline.contacted + pipeline.quoted + pipeline.won + pipeline.lost
    : 1;

  const pipelineRows = pipeline
    ? [
        { label: "Prospect", value: pipeline.prospect, key: "prospect" },
        { label: "Contacted", value: pipeline.contacted, key: "contacted" },
        { label: "Quoted", value: pipeline.quoted, key: "quoted" },
        { label: "Won", value: pipeline.won, key: "won" },
        { label: "Lost", value: pipeline.lost, key: "lost" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {segment} sales overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Total leads</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {stats?.totalLeads ?? "—"}
          </p>
          {stats && stats.leadsThisMonth > 0 && (
            <p className="text-xs mt-1.5 font-medium text-emerald-600">
              +{stats.leadsThisMonth} this month
            </p>
          )}
        </div>

        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Active clients</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {stats?.totalClients ?? "—"}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Active policies</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {stats?.activePolicies ?? "—"}
          </p>
          {stats && (
            <p className="text-xs mt-1.5 text-gray-400">
              {formatCurrency(stats.totalMonthlyPremium)} / mo
            </p>
          )}
        </div>

        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Conversion rate</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {stats ? `${stats.conversionRate}%` : "—"}
          </p>
          {stats && stats.unassignedLeads > 0 && (
            <p className="text-xs mt-1.5 font-medium text-amber-600">
              {stats.unassignedLeads} unassigned
            </p>
          )}
        </div>
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Recent leads */}
        <div className="col-span-3 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">My recent leads</h2>
            <button
              className="btn btn-ghost text-xs text-brand-700 hover:text-brand-900"
              onClick={() => onNavigate("/sales/leads")}
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          {recentLeads.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No leads assigned to you yet.</p>
              <button
                className="btn btn-secondary mt-3 text-xs"
                onClick={() => onNavigate("/sales/leads/pool")}
              >
                Browse lead pool
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                      {getInitials(lead.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {lead.name}
                      </p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5">
                        {lead.source ?? "—"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={lead.status ?? "Prospect"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          {/* Pipeline */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Sales pipeline
            </h2>
            <div className="space-y-2.5">
              {pipelineRows.map(({ label, value, key }) => (
                <div key={key}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((value / pipelineTotal) * 100)}%`,
                        backgroundColor: STATUS_BAR_COLORS[key],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Quick actions
            </h2>
            <div className="space-y-2">
              <button
                className="btn btn-secondary w-full justify-start gap-2.5 text-sm"
                onClick={() => onNavigate("/sales/leads")}
              >
                <Users className="w-4 h-4 text-gray-400" />
                Add new lead
              </button>
              <button
                className="btn btn-secondary w-full justify-start gap-2.5 text-sm"
                onClick={() => onNavigate("/sales/leads/import")}
              >
                <FileText className="w-4 h-4 text-gray-400" />
                Import leads
              </button>
              <button
                className="btn btn-secondary w-full justify-start gap-2.5 text-sm"
                onClick={() => onNavigate("/sales/policies")}
              >
                <TrendingUp className="w-4 h-4 text-gray-400" />
                New policy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
