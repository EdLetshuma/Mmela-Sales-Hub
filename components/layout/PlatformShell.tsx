"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import TopNav from "@/components/layout/TopNav";
import ModuleHome from "@/components/layout/ModuleHome";
import { MODULE_CONFIG } from "@/lib/modules";
import type { ClientSegment } from "@/types";

export default function PlatformShell() {
  const { user, activeModule } = useAuth();
  const [segment, setSegment] = useState<ClientSegment>("Individual");
  const [activePath, setActivePath] = useState("");

  // Set default path when module changes
  useEffect(() => {
    const mod = MODULE_CONFIG[activeModule];
    setActivePath(mod.defaultPath);
  }, [activeModule]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <TopNav
        segment={segment}
        onSegmentChange={setSegment}
        activePath={activePath}
        onNavigate={setActivePath}
      />
      <main className="p-5 max-w-[1400px] mx-auto">
        <div className="fade-in" key={activeModule + activePath}>
          <ModuleHome
            module={activeModule}
            segment={segment}
            activePath={activePath}
            onNavigate={setActivePath}
          />
        </div>
      </main>
    </div>
  );
}
