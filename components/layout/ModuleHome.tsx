"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MODULE_CONFIG } from "@/lib/modules";
import type { MmelaModule, ClientSegment } from "@/types";
import CampaignsDashboard from "@/components/campaigns/CampaignsDashboard";
import CampaignList from "@/components/campaigns/CampaignList";
import FormList from "@/components/campaigns/FormList";
import FormBuilder from "@/components/campaigns/FormBuilder";
import LeadInbox from "@/components/campaigns/LeadInbox";
import {
  Users,
  Megaphone,
  Car,
  HeartPulse,
  TrendingUp,
  FileText,
  ArrowRight,
} from "lucide-react";

interface ModuleHomeProps {
  module: MmelaModule;
  segment: ClientSegment;
  activePath: string;
  onNavigate: (path: string) => void;
}

const MODULE_ICONS: Record<MmelaModule, React.ReactNode> = {
  sales: <TrendingUp className="w-5 h-5" />,
  campaigns: <Megaphone className="w-5 h-5" />,
  concierge: <Car className="w-5 h-5" />,
  "credit-health": <HeartPulse className="w-5 h-5" />,
};

export default function ModuleHome({ module, segment, activePath, onNavigate }: ModuleHomeProps) {
  const { user } = useAuth();
  const config = MODULE_CONFIG[module];
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  if (!user) return null;

  if (module === "sales") {
    return <SalesDashboard segment={segment} userName={user.name} activePath={activePath} onNavigate={onNavigate} />;
  }

  if (module === "campaigns") {
    // Form builder view (not a nav path — triggered by clicking edit on a form)
    if (editingFormId) {
      return (
        <FormBuilder
          formId={editingFormId}
          onBack={() => setEditingFormId(null)}
        />
      );
    }

    if (activePath === "/campaigns/manage") {
      return <CampaignList />;
    }
    if (activePath === "/campaigns/forms" || activePath === "/campaigns/forms/builder") {
      return (
        <FormList
          onEditForm={(id) => setEditingFormId(id)}
        />
      );
    }
    if (activePath === "/campaigns/leads" || activePath === "/campaigns/leads/distribute") {
      return <LeadInbox />;
    }
    if (activePath === "/campaigns/leads/import") {
      return <PlaceholderPage title="Lead import" description="Coming in next batch" icon={<FileText className="w-10 h-10 text-gray-300" />} />;
    }
    if (activePath === "/campaigns/routing") {
      return <PlaceholderPage title="Routing rules" description="Coming in next batch" icon={<ArrowRight className="w-10 h-10 text-gray-300" />} />;
    }
    if (activePath === "/campaigns/analytics") {
      return <PlaceholderPage title="Campaign analytics" description="Coming in next batch" icon={<TrendingUp className="w-10 h-10 text-gray-300" />} />;
    }
    return <CampaignsDashboard onNavigate={onNavigate} />;
  }

  // Placeholder for Concierge and Credit Health
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {config.label}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{config.description}</p>
      </div>
      <div className="card flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          {MODULE_ICONS[module]}
          <p className="mt-3 text-sm">
            {config.label} module — coming in Phase 4
          </p>
        </div>
      </div>
    </div>
  );
}

function SalesDashboard({
  segment,
  userName,
  activePath,
  onNavigate,
}: {
  segment: ClientSegment;
  userName: string;
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  const firstName = userName?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
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
        <KpiCard label="Total leads" value="395" change="+12%" positive />
        <KpiCard label="Active clients" value="266" change="+8" positive />
        <KpiCard label="Active policies" value="330" subtitle="5 insurers" />
        <KpiCard
          label="Conversion rate"
          value="34%"
          change="-2%"
          positive={false}
        />
      </div>

      {/* Placeholder content panels */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Recent leads
          </h2>
          <div className="space-y-3">
            <LeadRow
              name="Thabo Molefe"
              source="Campaign: Winter Drive"
              status="Quoted"
            />
            <LeadRow
              name="Naledi Nkosi"
              source="Manual entry"
              status="Prospect"
            />
            <LeadRow
              name="Sipho Jansen"
              source="Referral"
              status="Contacted"
            />
            <LeadRow
              name="Refilwe Tau"
              source="CSV import"
              status="Prospect"
            />
          </div>
        </div>
        <div className="col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Quick actions
          </h2>
          <div className="space-y-2">
            <ActionButton label="Add new lead" icon={<Users className="w-4 h-4" />} />
            <ActionButton label="Create referral" icon={<ArrowRight className="w-4 h-4" />} />
            <ActionButton label="Import leads" icon={<FileText className="w-4 h-4" />} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Placeholder for upcoming pages ---

function PlaceholderPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        {icon}
        <p className="mt-3 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

// --- Shared sub-components ---

function KpiCard({
  label,
  value,
  change,
  subtitle,
  positive,
}: {
  label: string;
  value: string;
  change?: string;
  subtitle?: string;
  positive?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">
        {value}
      </p>
      {change && (
        <p
          className={`text-xs mt-1.5 font-medium ${
            positive ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {change}
        </p>
      )}
      {subtitle && !change && (
        <p className="text-xs mt-1.5 text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

function LeadRow({
  name,
  source,
  status,
}: {
  name: string;
  source: string;
  status: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const statusClass =
    status === "Quoted"
      ? "badge-quoted"
      : status === "Contacted"
      ? "badge-contacted"
      : status === "Won"
      ? "badge-won"
      : status === "Lost"
      ? "badge-lost"
      : "badge-prospect";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-medium text-brand-800">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-400">{source}</p>
        </div>
      </div>
      <span className={`badge ${statusClass}`}>{status}</span>
    </div>
  );
}

function ActionButton({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all text-left">
      <span className="text-gray-400">{icon}</span>
      {label}
    </button>
  );
}
