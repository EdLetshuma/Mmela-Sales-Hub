// ============================================================
// MMELA PLATFORM TYPE DEFINITIONS
// ============================================================

// --- User & Auth Types ---

export enum UserRole {
  SalesAgent = "Sales Agent",
  Admin = "Admin",
  Manager = "Manager",
  PolicyAdmin = "Policy Admin",
  TeamLeader = "Team Leader",
  LeadAdmin = "Lead Admin",
  CallCentreSupervisor = "Call Centre Assistance Supervisor",
  MarketingAdmin = "Marketing Admin",
  ConciergeAgent = "Concierge Agent",
  CreditHealthAgent = "Credit Health Agent",
}

export enum UserStatus {
  Active = "Active",
  Inactive = "Inactive",
}

export enum UserSpecialization {
  Individual = "Individual",
  Commercial = "Commercial",
  Both = "Both",
}

export enum Permission {
  ViewDashboard = "View Dashboard",
  ViewLeads = "View Leads",
  ViewReferrals = "View Referrals",
  ViewLeadImport = "View Lead Import",
  ViewClients = "View Clients",
  ViewPolicies = "View Policies",
  ViewRetentions = "View Retentions",
  ViewAlerts = "View Alerts",
  ViewAgentPerformance = "View Agent Performance",
  ViewAnalytics = "View Analytics",
  AccessAdminPanel = "Access Admin Panel",
  ViewReporting = "View Reporting",
  ViewSupportTickets = "View Support Tickets",
  ViewQuotations = "View Quotations",
  SubmitSupportTickets = "Submit Support Tickets",
  EditClients = "Edit Clients",
  EditPolicies = "Edit Policies",
  EditPolicyNumber = "Edit Policy Number",
  ManageLeads = "Manage Leads",
  ManageLeadPool = "Manage Lead Pool",
  ManageLegacyData = "Manage Legacy Data",
  DeleteClients = "Delete Clients",
  DeletePolicies = "Delete Policies",
  DeleteLeads = "Delete Leads",
  ManageData = "Manage Data",
  // New Hub permissions
  ManageCampaigns = "Manage Campaigns",
  ManageForms = "Manage Forms",
  ManageRouting = "Manage Routing",
  ViewCampaignAnalytics = "View Campaign Analytics",
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  permissions: Permission[];
  role: UserRole;
  status: UserStatus;
  specialization: UserSpecialization;
}

// --- Module Access ---

export type MmelaModule = "sales" | "campaigns" | "concierge" | "credit-health";

export interface ModuleConfig {
  id: MmelaModule;
  label: string;
  description: string;
  roles: UserRole[];
  defaultPath: string;
  navItems: NavItem[];
}

export interface NavItem {
  label: string;
  href: string;
  permission?: Permission;
  children?: SubNavItem[];
}

export interface SubNavItem {
  label: string;
  href: string;
  permission?: Permission;
}

// --- Segment ---

export type ClientSegment = "Individual" | "Commercial";

// --- Business Units ---

export interface BusinessUnit {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

// --- Campaigns & Forms ---

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  business_unit_id: string;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Form {
  id: string;
  campaign_id: string;
  name: string;
  slug: string;
  description?: string;
  thank_you_message: string;
  is_active: boolean;
  qr_code_url?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export enum FieldType {
  Text = "text",
  Email = "email",
  Phone = "phone",
  Number = "number",
  Textarea = "textarea",
  Select = "select",
  Radio = "radio",
  Checkbox = "checkbox",
  Date = "date",
  IdNumber = "id_number",
}

export interface FormField {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder?: string;
  is_required: boolean;
  options?: Record<string, unknown>;
  validation_rules?: Record<string, unknown>;
  display_order: number;
}

// --- Leads (extended) ---

export enum LeadStatus {
  Prospect = "Prospect",
  Contacted = "Contacted",
  Quoted = "Quoted",
  Won = "Won",
  Lost = "Lost",
  RetentionFailure = "Retention Failure",
}

export enum LeadSourceType {
  Form = "form",
  CsvUpload = "csv_upload",
  ManualEntry = "manual_entry",
  WebsiteEmbed = "website_embed",
  Facebook = "facebook",
  WhatsApp = "whatsapp",
  GoogleAds = "google_ads",
  EmailParser = "email_parser",
  Api = "api",
  Chatbot = "chatbot",
  Event = "event",
  ReferralPortal = "referral_portal",
  Legacy = "legacy",
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  segment?: ClientSegment;
  status?: LeadStatus;
  source?: string;
  campaign?: string;
  assigned_to_user_id?: string;
  business_unit_id?: string;
  form_id?: string;
  campaign_id?: string;
  source_type?: LeadSourceType;
  captured_data?: Record<string, unknown>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  created_at?: string;
  updated_at?: string;
}

// --- Routing ---

export enum RoutingMethod {
  RoundRobin = "round_robin",
  Manual = "manual",
  SpecificUser = "specific_user",
}

export interface RoutingRule {
  id: string;
  business_unit_id: string;
  campaign_id?: string;
  method: RoutingMethod;
  assigned_user_ids: string[];
  is_active: boolean;
}
