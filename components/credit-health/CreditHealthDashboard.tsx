"use client";

import React, { useEffect, useState } from "react";
import { getCreditHealthStats, CREDIT_HEALTH_STATUSES } from "@/lib/credit-health-api";
import { useAuth } from "@/components/providers/AuthProvider";
import { ArrowRight, CreditCard } from "lucide-react";

interface CreditHealthDashboardProps {
  onNavigate: (path: string) => void;
}

function GrowthTag({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-gray-400">No change vs last month</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "↗" : "↘"} {Math.abs(pct)}% vs last month
    </span>
  );
}

export default function CreditHealthDashboard({ onNavigate }: CreditHealthDashboardProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getCreditHealthStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCreditHealthStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="card" style={{ background: "linear-gradient(135deg, #2E1F52 0%, #5B3A9A 100%)" }}>
        <p className="text-xs font-medium mb-2" style={{ color: "rgba(227,222,246,.7)" }}>
          {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="text-2xl font-bold text-white">Welcome back, {firstName}.</h1>
        <p className="text-sm mt-2" style={{ color: "rgba(227,222,246,.85)" }}>Credit Health — credit advisory workspace</p>
      </div>

      {/* Unit summary — same card design as the Credit Health tile on the Executive Dashboard */}
      {loading ? (
        <div className="card h-40 animate-pulse bg-gray-50" />
      ) : (
        <div className="card" style={{ maxWidth: 340 }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F3EEFB" }}>
              <CreditCard className="w-4 h-4" style={{ color: "#5B3A9A" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Credit Health</p>
              <p className="text-[11px] text-gray-400">Debt review &amp; advisory</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-0.5">Approved this month</p>
          <p className="text-xl font-semibold text-gray-900 mb-2">{stats?.approved ?? 0}</p>
          <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
            <span>{stats?.total ?? 0} leads</span>
            <span>{stats?.active ?? 0} active</span>
            <span>{stats?.unassigned ?? 0} unassigned</span>
          </div>
          <div className="mt-1.5"><GrowthTag pct={stats?.growthPct ?? 0} /></div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h2>
          <div className="space-y-2">
            <button className="btn btn-secondary w-full justify-between text-sm" onClick={() => onNavigate("/credit-health/leads")}>
              <span>View all leads</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
            <button className="btn btn-primary w-full justify-center text-sm" onClick={() => onNavigate("/credit-health/leads")}>
              + Capture new lead
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline stages</h2>
          <div className="space-y-1.5">
            {CREDIT_HEALTH_STATUSES.filter((s) => s !== "Approved" && s !== "Declined").map((s) => (
              <button key={s} className="w-full flex items-center justify-between py-1.5 text-xs text-gray-600 hover:text-brand-800 transition-colors" onClick={() => onNavigate("/credit-health/leads")}>
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
