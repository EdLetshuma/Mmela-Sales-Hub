"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import LoginPage from "./auth/login/page";
import PlatformShell from "@/components/layout/PlatformShell";

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-3">
            Mmela
          </h1>
          <div className="w-6 h-6 border-2 border-brand-300/30 border-t-brand-300 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <PlatformShell />;
}
