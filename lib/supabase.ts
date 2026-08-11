import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tslovjdrcbnewcajawiq.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbG92amRyY2JuZXdjYWphd2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjQwODUsImV4cCI6MjA3NzM0MDA4NX0.Qse2Y8XNlZQ2vTB-U2oYmTCbYVRZusr9NXpNwNdQ61g";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = true;

// Keep the token-refresh timer paused while the tab isn't visible and
// resume it (immediately checking whether a refresh is due) when the
// user comes back — otherwise a long-backgrounded tab can silently sit
// on an expired access token. Session itself still persists in
// localStorage regardless, so closing the browser and reopening within
// the refresh token's validity window resumes the session without a
// fresh login.
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
