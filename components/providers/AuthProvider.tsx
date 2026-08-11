"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { User } from "@/types";
import type { MmelaModule } from "@/types";
import { getSession, getUserProfile, onAuthStateChange } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getAccessibleModules, getDefaultModule } from "@/lib/modules";

// Supabase's own configurable session timeout/time-box is a paid-plan
// feature. These enforce the same two policies client-side instead:
// a hard logout after real idle time, and a hard cap on how long a
// session can live even if it's continuously active.
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_SESSION_LIMIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_STARTED_KEY = "mmela_session_started_at";
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  activeModule: MmelaModule;
  setActiveModule: (module: MmelaModule) => void;
  accessibleModules: ReturnType<typeof getAccessibleModules>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  activeModule: "sales",
  setActiveModule: () => {},
  accessibleModules: [],
  refreshUser: async () => {},
});

function clearStaleTokens() {
  if (typeof window === "undefined") return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sb-"))
    .forEach((k) => localStorage.removeItem(k));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<MmelaModule>("sales");

  const accessibleModules = user ? getAccessibleModules(user.role, user.permissions ?? []) : [];
  const lastActivityRef = useRef(Date.now());

  async function autoLogout() {
    localStorage.removeItem(SESSION_STARTED_KEY);
    await supabase.auth.signOut({ scope: "local" });
  }

  const refreshUser = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        setUser(profile);
        if (profile) {
          const defaultMod = getDefaultModule(profile.role, profile.permissions ?? []);
          setActiveModule(defaultMod.id);
        }
      } else {
        setUser(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Invalid refresh token — clear storage and show login
      if (
        message.includes("Refresh Token Not Found") ||
        message.includes("Invalid Refresh Token") ||
        message.includes("refresh_token_not_found")
      ) {
        clearStaleTokens();
        await supabase.auth.signOut();
        setUser(null);
        setActiveModule("sales");
      } else {
        console.error("Error refreshing user:", err);
        setError("Failed to load user profile");
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        if (!localStorage.getItem(SESSION_STARTED_KEY)) {
          localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
        }
        await refreshUser();
      } else if (event === "TOKEN_REFRESHED") {
        await refreshUser();
      } else if (event === "SIGNED_OUT") {
        clearStaleTokens();
        localStorage.removeItem(SESSION_STARTED_KEY);
        setUser(null);
        setActiveModule("sales");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Inactivity timeout + absolute session cap — both enforced client-side
  // since Supabase's own session-timeout policy requires a paid plan.
  useEffect(() => {
    if (!user) return;

    if (!localStorage.getItem(SESSION_STARTED_KEY)) {
      localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
    }

    lastActivityRef.current = Date.now();

    function markActivity() {
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
        autoLogout();
        return;
      }
      const startedAt = Number(localStorage.getItem(SESSION_STARTED_KEY) ?? now);
      if (now - startedAt > ABSOLUTE_SESSION_LIMIT_MS) {
        autoLogout();
      }
    }, 30 * 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(checkInterval);
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        activeModule,
        setActiveModule,
        accessibleModules,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
