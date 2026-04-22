"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@/types";
import type { MmelaModule } from "@/types";
import { getSession, getUserProfile, onAuthStateChange } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getAccessibleModules, getDefaultModule } from "@/lib/modules";

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

  const accessibleModules = user ? getAccessibleModules(user.role) : [];

  const refreshUser = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        setUser(profile);
        if (profile) {
          const defaultMod = getDefaultModule(profile.role);
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
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await refreshUser();
      } else if (event === "SIGNED_OUT") {
        clearStaleTokens();
        setUser(null);
        setActiveModule("sales");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
