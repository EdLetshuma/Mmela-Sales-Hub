"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import TopNav from "@/components/layout/TopNav";
import ModuleHome from "@/components/layout/ModuleHome";
import AdminSettingsPage from "@/components/admin/AdminSettingsPage";
import { MODULE_CONFIG } from "@/lib/modules";
import type { ClientSegment, MmelaModule } from "@/types";
import { UserSpecialization } from "@/types";

export default function PlatformShell() {
  const { user, activeModule, setActiveModule, accessibleModules } = useAuth();
  const [segment, setSegment] = useState<ClientSegment>("Individual");
  const [activePath, setActivePath] = useState("");
  const restoredRef = useRef(false);

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

  // On first render after login, restore module + path from the actual
  // URL (so refreshes and shared/bookmarked links land on the right
  // page) instead of always resetting to the module's default path.
  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;

    const path = window.location.pathname;
    if (path.startsWith("/admin/settings")) {
      setActivePath(path);
      window.history.replaceState({ path, module: activeModule }, "", path);
      return;
    }
    const segId = path.split("/").filter(Boolean)[0];
    const mod = accessibleModules.find((m) => m.id === segId);

    if (mod) {
      if (mod.id !== activeModule) setActiveModule(mod.id as MmelaModule);
      setActivePath(path);
      window.history.replaceState({ path, module: mod.id }, "", path);
    } else {
      const defaultPath = MODULE_CONFIG[activeModule].defaultPath;
      setActivePath(defaultPath);
      window.history.replaceState({ path: defaultPath, module: activeModule }, "", defaultPath);
    }
  }, [user, accessibleModules, activeModule, setActiveModule]);

  // Push real URLs to browser history so links are shareable/bookmarkable
  // and the back/forward buttons work as expected.
  function navigate(path: string) {
    window.history.pushState({ path, module: activeModule }, "", path);
    setActivePath(path);
  }

  // Listen for browser back/forward
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const path = e.state?.path ?? window.location.pathname;
      setActivePath(path);
      if (e.state?.module) setActiveModule(e.state.module);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setActiveModule]);

  if (!user) return null;

  if (activePath.startsWith("/admin/settings")) {
    return (
      <AdminSettingsPage
        activePath={activePath}
        onNavigate={navigate}
        onExit={() => navigate(MODULE_CONFIG[activeModule].defaultPath)}
      />
    );
  }

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
          width: "100%",
          margin: "0 auto",
          paddingLeft: "clamp(16px, 2vw, 32px)",
          paddingRight: "clamp(16px, 2vw, 32px)",
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
