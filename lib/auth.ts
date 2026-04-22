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
  // NEXT_PUBLIC_ env vars are embedded at build time by Next.js.
  // We read them from the supabase client which is already initialised
  // with the correct URL — this works in both server and client contexts.
  const supabaseUrl = supabase.supabaseUrl;
  const res = await fetch(
    `${supabaseUrl}/functions/v1/request-reset`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
  // The function always returns 200 — failure is logged server-side only
  // to prevent email enumeration attacks
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
