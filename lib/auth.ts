import { supabase } from "./supabase";
import type { User } from "@/types";
import { Permission, UserRole, UserStatus } from "@/types";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  if (data.user) {
    const profile = await getUserProfile(data.user.id);
    if (profile?.status === UserStatus.Inactive) {
      await supabase.auth.signOut();
      throw new Error(
        "Your account has been deactivated. Please contact an administrator."
      );
    }
    return { session: data.session, profile };
  }

  return { session: data.session, profile: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// Computes the effective permission set for a user: role defaults from
// `role_permissions`, with any per-user rows in `user_permission_overrides`
// taking priority. Admin always has every permission. This is the single
// source of truth used to gate actions across the app (e.g. editing a
// policy vs. only viewing it) — it does not rely on the `users.permissions`
// column, which nothing else writes to.
async function getEffectivePermissions(role: string, userId: string): Promise<Permission[]> {
  if (role === UserRole.Admin) {
    return Object.values(Permission);
  }

  const [roleRes, overrideRes] = await Promise.all([
    supabase.from("role_permissions").select("permission, granted").eq("role", role),
    supabase.from("user_permission_overrides").select("permission, granted").eq("user_id", userId),
  ]);

  const granted = new Set<string>(
    (roleRes.data ?? []).filter((r) => r.granted).map((r) => r.permission)
  );

  (overrideRes.data ?? []).forEach((o) => {
    if (o.granted) granted.add(o.permission);
    else granted.delete(o.permission);
  });

  return Array.from(granted).filter((p): p is Permission =>
    (Object.values(Permission) as string[]).includes(p)
  );
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  const permissions = await getEffectivePermissions(data.role, userId);
  return { ...data, permissions } as User;
}

export async function sendPasswordReset(email: string) {
  // Calls our branded Edge Function which generates the Supabase recovery
  // link server-side and sends it via Resend with Mmela branding.
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-reset`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to send reset email.");
  }
  // Always resolves — server never reveals if the email exists
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
