import { supabase } from "./supabase";
import type { User } from "@/types";
import { UserStatus } from "@/types";

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

  return data as User;
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
