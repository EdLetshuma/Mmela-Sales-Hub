import { UserRole, Permission } from "@/types";
import type { ModuleConfig, MmelaModule } from "@/types";

export const MODULE_CONFIG: Record<MmelaModule, ModuleConfig> = {
  sales: {
    id: "sales",
    label: "Sales",
    description: "Call centre CRM — leads, clients, policies, retentions",
    roles: [
      UserRole.SalesAgent,
      UserRole.Admin,
      UserRole.Manager,
      UserRole.PolicyAdmin,
      UserRole.TeamLeader,
      UserRole.LeadAdmin,
      UserRole.CallCentreSupervisor,
    ],
    defaultPath: "/sales",
    navItems: [
      {
        label: "Dashboard",
        href: "/sales",
        permission: Permission.ViewDashboard,
      },
      {
        label: "Leads",
        href: "/sales/leads",
        permission: Permission.ViewLeads,
        children: [
          { label: "All leads", href: "/sales/leads" },
          {
            label: "Lead pool",
            href: "/sales/leads/pool",
            permission: Permission.ManageLeadPool,
          },
          {
            label: "Import",
            href: "/sales/leads/import",
            permission: Permission.ViewLeadImport,
          },
          {
            label: "Referrals",
            href: "/sales/leads/referrals",
            permission: Permission.ViewReferrals,
          },
        ],
      },
      {
        label: "Clients",
        href: "/sales/clients",
        permission: Permission.ViewClients,
      },
      {
        label: "Policies",
        href: "/sales/policies",
        permission: Permission.ViewPolicies,
      },
      {
        label: "Retentions",
        href: "/sales/retentions",
        permission: Permission.ViewRetentions,
      },
      {
        label: "Analytics",
        href: "/sales/analytics",
        permission: Permission.ViewAnalytics,
      },
      {
        label: "Reporting",
        href: "/sales/reporting",
        permission: Permission.ViewReporting,
      },
    ],
  },

  campaigns: {
    id: "campaigns",
    label: "Campaigns",
    description: "Lead capture, forms, QR codes, distribution",
    roles: [UserRole.MarketingAdmin, UserRole.Admin],
    defaultPath: "/campaigns",
    navItems: [
      { label: "Dashboard", href: "/campaigns" },
      {
        label: "Campaigns",
        href: "/campaigns/manage",
        permission: Permission.ManageCampaigns,
      },
      {
        label: "Forms",
        href: "/campaigns/forms",
        permission: Permission.ManageForms,
        children: [
          { label: "All forms", href: "/campaigns/forms" },
          { label: "Form builder", href: "/campaigns/forms/builder" },
        ],
      },
      {
        label: "Leads",
        href: "/campaigns/leads",
        children: [
          { label: "All leads", href: "/campaigns/leads" },
          { label: "Distribution", href: "/campaigns/leads/distribute" },
          { label: "Import", href: "/campaigns/leads/import" },
        ],
      },
      {
        label: "Routing",
        href: "/campaigns/routing",
        permission: Permission.ManageRouting,
      },
      {
        label: "Analytics",
        href: "/campaigns/analytics",
        permission: Permission.ViewCampaignAnalytics,
      },
    ],
  },

  concierge: {
    id: "concierge",
    label: "Concierge",
    description: "Vehicle sourcing and supply",
    roles: [UserRole.ConciergeAgent, UserRole.Admin],
    defaultPath: "/concierge",
    navItems: [
      { label: "Dashboard", href: "/concierge" },
      { label: "My queue", href: "/concierge/queue" },
      { label: "Sourcing", href: "/concierge/sourcing" },
      { label: "Activity", href: "/concierge/activity" },
    ],
  },

  "credit-health": {
    id: "credit-health",
    label: "Credit Health",
    description: "Credit advisory workspace",
    roles: [UserRole.CreditHealthAgent, UserRole.Admin],
    defaultPath: "/credit-health",
    navItems: [
      { label: "Dashboard", href: "/credit-health" },
      { label: "My queue", href: "/credit-health/queue" },
      { label: "Assessments", href: "/credit-health/assessments" },
      { label: "Activity", href: "/credit-health/activity" },
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
