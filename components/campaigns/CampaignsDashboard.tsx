"use client";

import React, { useState, useEffect } from "react";
import { getCampaignStats, getCampaigns, getBusinessUnits } from "@/lib/campaigns-api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Campaign, BusinessUnit } from "@/types";
import {
  Megaphone,
  FileText,
  Users,
  AlertCircle,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";

interface CampaignsDashboardProps {
  onNavigate: (path: string) => void;
}

export default function CampaignsDashboard({ onNavigate }: CampaignsDashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeCampaigns: 0,
    activeForms: 0,
    totalLeads: 0,
    leadsThisMonth: 0,
    unassignedLeads: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<(Campaign & { business_units?: { name: string } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsData, campaignData] = await Promise.all([
        getCampaignStats(),
        getCampaigns(),
      ]);
      setStats(statsData);
      setRecentCampaigns(campaignData.slice(0, 5));
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const firstName = user?.name?.split(" ")[0] || "there";

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Campaigns dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {firstName} — manage campaigns and distribute leads
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Active campaigns"
          value={stats.activeCampaigns}
          icon={<Megaphone className="w-4 h-4" />}
          color="purple"
        />
        <KpiCard
          label="Live forms"
          value={stats.activeForms}
          icon={<FileText className="w-4 h-4" />}
          color="blue"
        />
        <KpiCard
          label="Leads this month"
          value={stats.leadsThisMonth}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
          subtitle={`${stats.totalLeads} total`}
        />
        <KpiCard
          label="Unassigned"
          value={stats.unassignedLeads}
          icon={<AlertCircle className="w-4 h-4" />}
          color={stats.unassignedLeads > 0 ? "red" : "gray"}
          subtitle={stats.unassignedLeads > 0 ? "Needs routing" : "All assigned"}
        />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Recent campaigns */}
        <div className="col-span-3 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent campaigns
            </h2>
            <button
              onClick={() => onNavigate("/campaigns/manage")}
              className="text-xs text-brand-700 hover:text-brand-900 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No campaigns yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onNavigate("/campaigns/manage")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        c.is_active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(c as any).business_units?.name || "—"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      c.is_active ? "badge-contacted" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Quick actions
          </h2>
          <div className="space-y-2">
            <ActionButton
              label="Create campaign"
              description="Set up a new lead capture campaign"
              icon={<Megaphone className="w-4 h-4" />}
              onClick={() => onNavigate("/campaigns/manage")}
            />
            <ActionButton
              label="Build a form"
              description="Design a form with custom fields"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => onNavigate("/campaigns/forms")}
            />
            <ActionButton
              label="Distribute leads"
              description="Assign unrouted leads to agents"
              icon={<Users className="w-4 h-4" />}
              onClick={() => onNavigate("/campaigns/leads")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    gray: "bg-gray-100 text-gray-400",
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center ${
            colorMap[color] || colorMap.gray
          }`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function ActionButton({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand-700 group-hover:bg-brand-50 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </button>
  );
}
