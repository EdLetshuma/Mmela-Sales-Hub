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
