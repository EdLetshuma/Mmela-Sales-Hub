import { supabase } from "./supabase";

// ── Create user (Admin only — calls Edge Function) ────────────

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: string;
  specialization: string;
}

export async function createUser(payload: CreateUserPayload): Promise<{ userId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(
    `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/create-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create user");
  return data;
}

// ── Notification preferences ──────────────────────────────────

export interface NotificationPreferences {
  lead_assigned: boolean;
  docs_pending: boolean;
  new_referral: boolean;
  weekly_summary: boolean;
  monthly_summary: boolean;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return (data?.notification_preferences as NotificationPreferences) ?? {
    lead_assigned: true,
    docs_pending: true,
    new_referral: true,
    weekly_summary: false,
    monthly_summary: false,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ notification_preferences: prefs })
    .eq("id", userId);
  if (error) throw error;
}

// ── Report configs ────────────────────────────────────────────

export interface ReportConfig {
  id: string;
  name: string;
  data_source: string;
  filters: Record<string, unknown>;
  columns: string[];
  created_at?: string;
}

export async function getUserReportConfigs(userId: string): Promise<ReportConfig[]> {
  const { data, error } = await supabase
    .from("user_report_configs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ReportConfig[]) ?? [];
}

export async function saveReportConfig(
  userId: string,
  config: Omit<ReportConfig, "id" | "created_at">
): Promise<ReportConfig> {
  const { data, error } = await supabase
    .from("user_report_configs")
    .insert({ ...config, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as ReportConfig;
}

export async function deleteReportConfig(id: string): Promise<void> {
  const { error } = await supabase.from("user_report_configs").delete().eq("id", id);
  if (error) throw error;
}
