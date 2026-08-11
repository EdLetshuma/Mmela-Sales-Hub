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
  ViewExecutiveDashboard = "View Executive Dashboard",
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
  DeleteForms = "Delete Forms",
  ManageRouting = "Manage Routing",
  ViewCampaignAnalytics = "View Campaign Analytics",
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  permissions: Permission[];
  role: UserRole;
  status: UserStatus;
  specialization: UserSpecialization;
}

// --- Module Access ---

export type MmelaModule = "executive" | "sales" | "campaigns" | "concierge" | "credit-health" | "hub";

export interface ModuleConfig {
  id: MmelaModule;
  label: string;
  description: string;
  roles: UserRole[];
  // Extra gate on top of `roles` — module is only accessible when the user
  // also holds this permission. Omit for modules gated by role alone.
  permission?: Permission;
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

export interface FormSettings {
  theme?: "light" | "dark";
  primaryColor?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  footerText?: string;
  submitButtonText?: string;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  cancelUrl?: string;
  redirectUrl?: string;
  customCss?: string;
  customJs?: string;
  language?: string;
  timezone?: string;
}

export interface Form {
  id: string;
  campaign_id: string;
  name: string;
  slug: string;
  description?: string;
  thank_you_message: string;
  is_active: boolean;
  is_multi_step?: boolean;
  settings?: FormSettings;
  qr_code_url?: string;
  created_by_user_id?: string;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export enum FieldType {
  // Basic
  Text = "text",
  Textarea = "textarea",
  Email = "email",
  Phone = "phone",
  Number = "number",
  Currency = "currency",
  Percentage = "percentage",
  Password = "password",
  // Selection
  Select = "select",
  MultiSelect = "multiselect",
  Checkbox = "checkbox",
  Radio = "radio",
  Toggle = "toggle",
  // Date & Time
  Date = "date",
  Time = "time",
  DateTime = "datetime",
  // Uploads
  File = "file",
  Image = "image",
  Camera = "camera",
  Signature = "signature",
  // Layout / structure — containers, not data-collecting inputs
  Section = "section",
  Accordion = "accordion",
  Columns = "columns",
  Tabs = "tabs",
  Card = "card",
  Divider = "divider",
  HtmlBlock = "html_block",
  InfoPanel = "info_panel",
  // Legacy
  IdNumber = "id_number",
}

export const LAYOUT_FIELD_TYPES: FieldType[] = [
  FieldType.Section, FieldType.Accordion, FieldType.Columns, FieldType.Tabs,
  FieldType.Card, FieldType.Divider, FieldType.HtmlBlock, FieldType.InfoPanel,
];

// Layout types that can contain child fields (as opposed to Divider/HtmlBlock/
// InfoPanel, which are self-contained decoration/content blocks).
export const CONTAINER_FIELD_TYPES: FieldType[] = [
  FieldType.Section, FieldType.Accordion, FieldType.Columns, FieldType.Tabs, FieldType.Card,
];

export const FIELD_TYPE_CATEGORIES: { label: string; types: FieldType[] }[] = [
  { label: "Basic Fields", types: [FieldType.Text, FieldType.Textarea, FieldType.Email, FieldType.Phone, FieldType.Number, FieldType.Currency, FieldType.Percentage, FieldType.Password, FieldType.IdNumber] },
  { label: "Selection Fields", types: [FieldType.Select, FieldType.MultiSelect, FieldType.Checkbox, FieldType.Radio, FieldType.Toggle] },
  { label: "Date & Time", types: [FieldType.Date, FieldType.Time, FieldType.DateTime] },
  { label: "Uploads", types: [FieldType.File, FieldType.Image, FieldType.Camera, FieldType.Signature] },
  { label: "Layout", types: LAYOUT_FIELD_TYPES },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.Text]: "Text",
  [FieldType.Textarea]: "Long Text",
  [FieldType.Email]: "Email",
  [FieldType.Phone]: "Phone",
  [FieldType.Number]: "Number",
  [FieldType.Currency]: "Currency",
  [FieldType.Percentage]: "Percentage",
  [FieldType.Password]: "Password",
  [FieldType.Select]: "Dropdown",
  [FieldType.MultiSelect]: "Multi Select",
  [FieldType.Checkbox]: "Checkbox",
  [FieldType.Radio]: "Radio",
  [FieldType.Toggle]: "Toggle Switch",
  [FieldType.Date]: "Date",
  [FieldType.Time]: "Time",
  [FieldType.DateTime]: "Date & Time",
  [FieldType.File]: "File Upload",
  [FieldType.Image]: "Image Upload",
  [FieldType.Camera]: "Camera",
  [FieldType.Signature]: "Signature",
  [FieldType.Section]: "Section",
  [FieldType.Accordion]: "Accordion",
  [FieldType.Columns]: "Columns",
  [FieldType.Tabs]: "Tabs",
  [FieldType.Card]: "Card",
  [FieldType.Divider]: "Divider",
  [FieldType.HtmlBlock]: "HTML Block",
  [FieldType.InfoPanel]: "Information Panel",
  [FieldType.IdNumber]: "ID Number",
};

// Field-level settings that go beyond the original label/placeholder/required
// model — additive (stored in form_fields.settings jsonb), so older fields
// with no settings simply use these defaults.
export interface FieldSettings {
  internalName?: string;
  tooltip?: string;
  helpText?: string;
  icon?: string;
  cssClass?: string;
  width?: "small" | "medium" | "large" | "full";
  defaultValue?: string;
  readOnly?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  // Layout/structure (Section, Accordion, Columns, Tabs, Card, HtmlBlock, InfoPanel)
  collapsible?: boolean;
  collapsedByDefault?: boolean;
  columnCount?: 2 | 3;
  tabs?: string[];
  htmlContent?: string;
  repeatable?: boolean;
  repeatableLabel?: string;
  // Assignment into a parent layout node's sub-slot
  tabIndex?: number;
}

export interface FieldValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  regex?: string;
  uniqueValue?: boolean;
}

export type ConditionOperator =
  | "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

export interface ConditionalRule {
  fieldKey: string;
  operator: ConditionOperator;
  value?: string;
  negate?: boolean; // NOT this condition
}

// A group combines its own rules AND any nested sub-groups with the same
// AND/OR operator, recursively — supports arbitrarily nested condition trees.
export interface ConditionGroup {
  logic: "all" | "any"; // AND / OR
  rules: ConditionalRule[];
  groups: ConditionGroup[];
}

export interface ConditionalLogic {
  action: "show" | "hide";
  root: ConditionGroup;
}

// Reference data sources are an explicit allowlist of safe, read-only
// lookups (business units, insurers, product catalog, static reference
// lists) — deliberately NOT a free-form table name, raw SQL query, or
// external API call, since this data is fetched by an unauthenticated
// public form and an open-ended query there would be a real injection /
// data-exposure risk.
export type ReferenceListKey =
  | "business_units" | "insurers" | "product_catalog"
  | "sales_agents" | "concierge_agents" | "credit_health_agents"
  | "sa_provinces" | "titles" | "marital_status" | "yes_no";

export interface DataSourceConfig {
  type: "manual" | "reference";
  referenceKey?: ReferenceListKey;
}

export interface FormField {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder?: string;
  description?: string;
  is_required: boolean;
  options?: Record<string, unknown>;
  validation_rules?: FieldValidationRules;
  settings?: FieldSettings;
  conditional_logic?: ConditionalLogic;
  calculated_formula?: string;
  data_source?: DataSourceConfig;
  display_order: number;
  parent_field_key?: string | null;
  column_index?: number | null;
  step_index?: number;
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
