"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import type { MmelaModule, ClientSegment } from "@/types";

// ── Campaigns ────────────────────────────────────────────────
import CampaignsDashboard from "@/components/campaigns/CampaignsDashboard";
import CampaignList from "@/components/campaigns/CampaignList";
import FormList from "@/components/campaigns/FormList";
import FormBuilder from "@/components/campaigns/FormBuilder";
import LeadInbox from "@/components/campaigns/LeadInbox";
import LeadImportWizard from "@/components/campaigns/LeadImportWizard";
import RoutingRules from "@/components/campaigns/RoutingRules";
import CampaignAnalytics from "@/components/campaigns/CampaignAnalytics";

// ── Sales ─────────────────────────────────────────────────────
import SalesDashboard from "@/components/sales/SalesDashboard";
import SalesLeads from "@/components/sales/SalesLeads";
import LeadDetail from "@/components/sales/LeadDetail";
import SalesClients from "@/components/sales/SalesClients";
import ClientDetail from "@/components/sales/ClientDetail";
import SalesPolicies from "@/components/sales/SalesPolicies";
import SalesRetentions from "@/components/sales/SalesRetentions";
import SalesAlerts from "@/components/sales/SalesAlerts";
import AgentPerformance from "@/components/sales/AgentPerformance";
import SalesAnalytics from "@/components/sales/analytics/SalesAnalytics";
import SalesSettings from "@/components/sales/settings/SalesSettings";

// ── Concierge ─────────────────────────────────────────────────
import ConciergeDashboard from "@/components/concierge/ConciergeDashboard";
import ConciergeLeads from "@/components/concierge/ConciergeLeads";
import ConciergeActivity from "@/components/concierge/ConciergeActivity";
import ConciergeAnalytics from "@/components/concierge/ConciergeAnalytics";

// ── Credit Health ─────────────────────────────────────────────
import CreditHealthDashboard from "@/components/credit-health/CreditHealthDashboard";
import CreditHealthLeads from "@/components/credit-health/CreditHealthLeads";
import CreditHealthAnalytics from "@/components/credit-health/CreditHealthAnalytics";

// ── Reporting (Hub) ───────────────────────────────────────────
import HubGenerate from "@/components/hub/HubGenerate";
import HubScheduled from "@/components/hub/HubScheduled";

interface ModuleHomeProps {
  module: MmelaModule;
  segment: ClientSegment;
  activePath: string;
  onNavigate: (path: string) => void;
}

export default function ModuleHome({ module, segment, activePath, onNavigate }: ModuleHomeProps) {
  const { user } = useAuth();
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  // Clear detail views when the nav tab changes
  React.useEffect(() => {
    setViewingLeadId(null);
    setViewingClientId(null);
    setEditingFormId(null);
  }, [activePath, module]);

  if (!user) return null;

  // ── SALES ──────────────────────────────────────────────────
  if (module === "sales") {
    if (viewingLeadId) return <LeadDetail leadId={viewingLeadId} onBack={() => setViewingLeadId(null)} onNavigate={(p) => { setViewingLeadId(null); onNavigate(p); }} />;
    if (viewingClientId) return <ClientDetail clientId={viewingClientId} onBack={() => setViewingClientId(null)} onNavigate={(p) => { setViewingClientId(null); onNavigate(p); }} />;
    if (activePath === "/sales" || activePath === "/sales/dashboard") return <SalesDashboard segment={segment} onNavigate={onNavigate} />;
    if (activePath === "/sales/leads" || activePath === "/sales/leads/all" || activePath === "/sales/leads/referrals") return <SalesLeads segment={segment} onNavigate={onNavigate} onViewLead={(id) => setViewingLeadId(id)} />;
    if (activePath === "/sales/clients") return <SalesClients segment={segment} onViewClient={(id) => setViewingClientId(id)} />;
    if (activePath === "/sales/policies") return <SalesPolicies segment={segment} />;
    if (activePath === "/sales/retentions") return <SalesRetentions segment={segment} onViewClient={(id) => setViewingClientId(id)} />;
    if (activePath === "/sales/analytics") return <SalesAnalytics segment={segment} />;
    if (activePath === "/sales/alerts") return <SalesAlerts segment={segment} onNavigate={onNavigate} onViewClient={(id) => setViewingClientId(id)} />;
    if (activePath === "/sales/agent-performance") return <AgentPerformance segment={segment} />;
    if (activePath === "/sales/settings") return <SalesSettings />;
    return <SalesDashboard segment={segment} onNavigate={onNavigate} />;
  }

  // ── CAMPAIGNS ──────────────────────────────────────────────
  if (module === "campaigns") {
    if (editingFormId) return <FormBuilder formId={editingFormId} onBack={() => setEditingFormId(null)} />;
    if (activePath === "/campaigns/manage") return <CampaignList />;
    if (activePath === "/campaigns/forms" || activePath === "/campaigns/forms/builder") return <FormList onEditForm={(id) => setEditingFormId(id)} />;
    if (activePath === "/campaigns/leads" || activePath === "/campaigns/leads/distribute") return <LeadInbox />;
    if (activePath === "/campaigns/leads/import") return <LeadImportWizard onBack={() => onNavigate("/campaigns/leads")} onDone={() => onNavigate("/campaigns/leads")} />;
    if (activePath === "/campaigns/routing") return <RoutingRules />;
    if (activePath === "/campaigns/analytics") return <CampaignAnalytics />;
    return <CampaignsDashboard onNavigate={onNavigate} />;
  }

  // ── CONCIERGE ──────────────────────────────────────────────
  if (module === "concierge") {
    if (activePath === "/concierge/leads") return <ConciergeLeads />;
    if (activePath === "/concierge/analytics") return <ConciergeAnalytics />;
    if (activePath === "/concierge/activity") return <ConciergeActivity />;
    return <ConciergeDashboard onNavigate={onNavigate} />;
  }

  // ── CREDIT HEALTH ──────────────────────────────────────────
  if (module === "credit-health") {
    if (activePath === "/credit-health/leads") return <CreditHealthLeads />;
    if (activePath === "/credit-health/analytics") return <CreditHealthAnalytics />;
    if (activePath === "/credit-health/activity") return <CreditHealthLeads />;
    return <CreditHealthDashboard onNavigate={onNavigate} />;
  }

  // ── REPORTING ──────────────────────────────────────────────
  if (module === "hub") {
    if (activePath === "/hub/scheduled") return <HubScheduled />;
    return <HubGenerate />;
  }

  return null;
}
