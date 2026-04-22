import { UserRole, Permission } from "@/types";
import type { ModuleConfig, MmelaModule } from "@/types";

export const MODULE_CONFIG: Record<MmelaModule, ModuleConfig> = {

  // ── SALES ────────────────────────────────────────────────────
  sales: {
    id: "sales",
    label: "Sales",
    description: "Call centre CRM — leads, clients, policies, retentions",
    roles: [
      UserRole.SalesAgent, UserRole.Admin, UserRole.Manager,
      UserRole.PolicyAdmin, UserRole.TeamLeader, UserRole.LeadAdmin,
      UserRole.CallCentreSupervisor,
    ],
    defaultPath: "/sales",
    navItems: [
      { label: "Dashboard",   href: "/sales",                  permission: Permission.ViewDashboard },
      { label: "Leads",       href: "/sales/leads",            permission: Permission.ViewLeads },
      { label: "Clients",     href: "/sales/clients",           permission: Permission.ViewClients },
      { label: "Policies",    href: "/sales/policies",          permission: Permission.ViewPolicies },
      { label: "Retentions",  href: "/sales/retentions",        permission: Permission.ViewRetentions },
      { label: "Analytics",   href: "/sales/analytics",         permission: Permission.ViewAnalytics },
      { label: "Alerts",      href: "/sales/alerts",            permission: Permission.ViewAlerts },
      { label: "Performance", href: "/sales/agent-performance", permission: Permission.ViewAgentPerformance },
      { label: "Catalog",     href: "/sales/settings",          permission: Permission.AccessAdminPanel },
    ],
  },

  // ── CAMPAIGNS ────────────────────────────────────────────────
  campaigns: {
    id: "campaigns",
    label: "Outreach",
    description: "Lead capture, forms, QR codes, distribution",
    roles: [UserRole.MarketingAdmin, UserRole.Admin],
    defaultPath: "/campaigns",
    navItems: [
      { label: "Dashboard", href: "/campaigns" },
      { label: "Campaigns", href: "/campaigns/manage",    permission: Permission.ManageCampaigns },
      {
        label: "Forms", href: "/campaigns/forms", permission: Permission.ManageForms,
        children: [
          { label: "All forms",    href: "/campaigns/forms" },
          { label: "Form builder", href: "/campaigns/forms/builder" },
        ],
      },
      {
        label: "Leads", href: "/campaigns/leads",
        children: [
          { label: "All leads",    href: "/campaigns/leads" },
          { label: "Distribution", href: "/campaigns/leads/distribute" },
          { label: "Import",       href: "/campaigns/leads/import" },
        ],
      },
      { label: "Routing",   href: "/campaigns/routing",   permission: Permission.ManageRouting },
      { label: "Analytics", href: "/campaigns/analytics", permission: Permission.ViewCampaignAnalytics },
    ],
  },

  // ── CONCIERGE ────────────────────────────────────────────────
  concierge: {
    id: "concierge",
    label: "Concierge",
    description: "Vehicle sourcing and acquisition",
    roles: [UserRole.ConciergeAgent, UserRole.Admin, UserRole.Manager],
    defaultPath: "/concierge",
    navItems: [
      { label: "Dashboard",  href: "/concierge" },
      { label: "Leads",      href: "/concierge/leads" },
      { label: "Analytics",  href: "/concierge/analytics" },
      { label: "Activity",   href: "/concierge/activity" },
    ],
  },

  // ── CREDIT HEALTH ────────────────────────────────────────────
  "credit-health": {
    id: "credit-health",
    label: "Credit Health",
    description: "Credit advisory workspace",
    roles: [UserRole.CreditHealthAgent, UserRole.Admin, UserRole.Manager],
    defaultPath: "/credit-health",
    navItems: [
      { label: "Dashboard",  href: "/credit-health" },
      { label: "Leads",      href: "/credit-health/leads" },
      { label: "Analytics",  href: "/credit-health/analytics" },
      { label: "Activity",   href: "/credit-health/activity" },
    ],
  },

  // ── REPORTING ─────────────────────────────────────────────────
  // Renamed from "Hub". Cross-unit reporting centre.
  // Generate reports + schedule mailings — each as a top-level nav item.
  hub: {
    id: "hub",
    label: "Reporting",
    description: "Cross-unit reports and scheduled mailings",
    roles: [UserRole.Admin, UserRole.Manager],
    defaultPath: "/hub/generate",
    navItems: [
      {
        label: "Generate",
        href: "/hub/generate",
        permission: Permission.ViewReporting,
      },
      {
        label: "Scheduled",
        href: "/hub/scheduled",
        permission: Permission.ViewReporting,
      },
    ],
  },
};

export const ALL_MODULES = Object.values(MODULE_CONFIG);

export function getAccessibleModules(role: UserRole): ModuleConfig[] {
  return ALL_MODULES.filter((mod) => mod.roles.includes(role));
}

export function getDefaultModule(role: UserRole): ModuleConfig {
  const accessible = getAccessibleModules(role);
  return accessible[0] || MODULE_CONFIG.sales;
}
