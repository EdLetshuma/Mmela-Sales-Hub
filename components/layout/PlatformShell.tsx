"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import TopNav from "@/components/layout/TopNav";
import ModuleHome from "@/components/layout/ModuleHome";
import { MODULE_CONFIG } from "@/lib/modules";
import type { ClientSegment } from "@/types";
import { UserSpecialization } from "@/types";

export default function PlatformShell() {
  const { user, activeModule, setActiveModule } = useAuth();
  const [segment, setSegment] = useState<ClientSegment>("Individual");
  const [activePath, setActivePath] = useState("");

  // Derive whether this user can toggle segments
  // Agents locked to one specialization cannot switch
  const canToggleSegment =
    !user?.specialization ||
    user.specialization === UserSpecialization.Both;

  // Auto-set segment based on user's specialization on login
  useEffect(() => {
    if (!user) return;
    if (user.specialization === UserSpecialization.Commercial) {
      setSegment("Commercial");
    } else {
      setSegment("Individual");
    }
  }, [user?.id]);

  // Set default path when module changes
  useEffect(() => {
    const mod = MODULE_CONFIG[activeModule];
    setActivePath(mod.defaultPath);
  }, [activeModule]);

  // Push state to browser history so back button works
  function navigate(path: string) {
    window.history.pushState({ path, module: activeModule }, "", "");
    setActivePath(path);
  }

  // Listen for browser back/forward
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      if (e.state?.path) {
        setActivePath(e.state.path);
        if (e.state.module) setActiveModule(e.state.module);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setActiveModule]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <TopNav
        segment={segment}
        onSegmentChange={canToggleSegment ? setSegment : () => {}}
        canToggleSegment={canToggleSegment}
        activePath={activePath}
        onNavigate={navigate}
      />
        <main
        style={{
          padding: "20px 16px",
          maxWidth: 1400,
          margin: "0 auto",
          paddingLeft: "clamp(12px, 3vw, 24px)",
          paddingRight: "clamp(12px, 3vw, 24px)",
        }}
      >
          <ModuleHome
            module={activeModule}
            segment={segment}
            activePath={activePath}
            onNavigate={navigate}
          />
      </main>
    </div>
  );
}
