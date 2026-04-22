"use client";

import React, { useEffect, useState } from "react";
import { getConciergeStats, CONCIERGE_STATUSES } from "@/lib/concierge-api";
import { useAuth } from "@/components/providers/AuthProvider";
import { ArrowRight } from "lucide-react";

interface ConciergeDashboardProps {
  onNavigate: (path: string) => void;
}

export default function ConciergeDashboard({ onNavigate }: ConciergeDashboardProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getConciergeStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConciergeStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Welcome back, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-1">Concierge — vehicle sourcing and acquisition</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Total leads</p>
            <p className="text-2xl font-semibold text-gray-900">{stats?.total ?? 0}</p>
            {stats && stats.thisMonth > 0 && (
              <p className="text-xs text-emerald-600 mt-1">+{stats.thisMonth} this month</p>
            )}
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">New</p>
            <p className="text-2xl font-semibold" style={{ color: "#235DCB" }}>{stats?.new ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Active</p>
            <p className="text-2xl font-semibold" style={{ color: "#854F0B" }}>{stats?.active ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">Contacted + Sourcing + Quote</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-400 mb-1">Won</p>
            <p className="text-2xl font-semibold" style={{ color: "#0F6E56" }}>{stats?.won ?? 0}</p>
            {stats && stats.unassigned > 0 && (
              <p className="text-xs text-amber-600 mt-1">{stats.unassigned} unassigned</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Quick actions</h2>
          </div>
          <div className="space-y-2">
            <button
              className="btn btn-secondary w-full justify-between text-sm"
              onClick={() => onNavigate("/concierge/leads")}
            >
              <span>View all leads</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="btn btn-primary w-full justify-center text-sm"
              onClick={() => onNavigate("/concierge/leads")}
            >
              + Capture new lead
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h2>
          <div className="space-y-1.5">
            {CONCIERGE_STATUSES.filter((s) => s !== "Won" && s !== "Lost").map((s) => (
              <button
                key={s}
                className="w-full flex items-center justify-between py-1.5 text-xs text-gray-600 hover:text-brand-800 transition-colors"
                onClick={() => onNavigate("/concierge/leads")}
              >
                <span>{s}</span>
                <ArrowRight className="w-3 h-3 text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
