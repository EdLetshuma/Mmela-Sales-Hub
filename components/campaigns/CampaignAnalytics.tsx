"use client";

import React, { useState, useEffect } from "react";
import { getCampaignLeads, getCampaigns, getBusinessUnits } from "@/lib/campaigns-api";
import type { Lead, Campaign, BusinessUnit } from "@/types";
import { BarChart3, TrendingUp, Users, Target } from "lucide-react";

export default function CampaignAnalytics() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [l, c, u] = await Promise.all([getCampaignLeads(), getCampaigns(), getBusinessUnits()]);
      setLeads(l); setCampaigns(c); setUnits(u);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return <div className="card animate-pulse h-64" />;

  const bySource: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};

  leads.forEach((l) => {
    const src = l.source_type || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;
    const uid = l.business_unit_id || "unknown";
    byUnit[uid] = (byUnit[uid] || 0) + 1;
    const st = l.status || "Prospect";
    byStatus[st] = (byStatus[st] || 0) + 1;
    const cid = l.campaign_id || "none";
    byCampaign[cid] = (byCampaign[cid] || 0) + 1;
  });

  const won = byStatus["Won"] || 0;
  const conversionRate = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;
  const unassigned = leads.filter((l) => !l.assigned_to_user_id).length;

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || id;
  const getCampaignName = (id: string) => campaigns.find((c) => c.id === id)?.name || id;

  const sortedSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  const sortedCampaigns = Object.entries(byCampaign).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sortedUnits = Object.entries(byUnit).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(...sortedSources.map(([, v]) => v), 1);
  const maxCampaignCount = Math.max(...sortedCampaigns.map(([, v]) => v), 1);

  const barColors = ["#1A348C", "#235DCB", "#528DDE", "#8BB9EF", "#B5D4F4", "#DDE9FA"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Campaign analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Performance across all campaign leads</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total leads" value={leads.length} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} icon={<Target className="w-4 h-4" />} />
        <StatCard label="Won" value={won} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Unassigned" value={unassigned} icon={<BarChart3 className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By source */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by source</h2>
          <div className="space-y-3">
            {sortedSources.map(([source, count], i) => (
              <div key={source}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 capitalize">{source.replace("_", " ")}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${(count / maxSourceCount) * 100}%`, background: barColors[i % barColors.length] }}
                  />
                </div>
              </div>
            ))}
            {sortedSources.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data yet</p>}
          </div>
        </div>

        {/* By campaign */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Top campaigns</h2>
          <div className="space-y-3">
            {sortedCampaigns.map(([id, count], i) => (
              <div key={id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{id === "none" ? "No campaign" : getCampaignName(id)}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${(count / maxCampaignCount) * 100}%`, background: barColors[i % barColors.length] }}
                  />
                </div>
              </div>
            ))}
            {sortedCampaigns.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No data yet</p>}
          </div>
        </div>

        {/* By unit */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by business unit</h2>
          <div className="space-y-3">
            {sortedUnits.map(([id, count]) => (
              <div key={id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{id === "unknown" ? "Untagged" : getUnitName(id)}</span>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By status */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Lead status breakdown</h2>
          <div className="space-y-3">
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const cls = status === "Won" ? "badge-won" : status === "Lost" ? "badge-lost" : status === "Quoted" ? "badge-quoted" : status === "Contacted" ? "badge-contacted" : "badge-prospect";
              return (
                <div key={status} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className={`badge ${cls}`}>{status}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">{icon}</div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}
