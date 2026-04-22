"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { MODULE_CONFIG } from "@/lib/modules";
import { signOut } from "@/lib/auth";
import type { MmelaModule, ClientSegment } from "@/types";
import {
  LogOut, Settings, ChevronDown, User as UserIcon, Bell, LayoutGrid, X,
} from "lucide-react";
import SettingsOverlay from "@/components/admin/SettingsOverlay";
import ProfilePanel from "@/components/admin/ProfilePanel";
import QuickReferralModal from "@/components/shared/QuickReferralModal";

const MODULE_ORDER = ["sales", "campaigns", "concierge", "credit-health", "hub"];

interface TopNavProps {
  segment: ClientSegment;
  onSegmentChange: (segment: ClientSegment) => void;
  canToggleSegment: boolean;
  activePath: string;
  onNavigate: (path: string) => void;
}

type OverlayType = "settings" | "profile" | null;

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
        zIndex: 60, paddingTop: 56,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 680, height: "calc(100vh - 56px)",
          background: "#fff", borderLeft: "1px solid #E5E7EB",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px", borderBottom: "1px solid #E5E7EB",
            position: "sticky", top: 0, background: "#fff", zIndex: 1,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{title}</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X style={{ width: 18, height: 18, color: "#6B7280" }} />
          </button>
        </div>
        <div style={{ padding: "24px", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TopNav({ segment, onSegmentChange, canToggleSegment, activePath, onNavigate }: TopNavProps) {
  const { user, activeModule, setActiveModule, accessibleModules } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const [showReferral, setShowReferral] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const currentModule = MODULE_CONFIG[activeModule];
  const showSwitcher = accessibleModules.length > 1;
  const isAdmin = user.role === "Admin";

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleLogout = async () => {
    try { await signOut(); } catch (err) { console.error(err); }
  };

  const handleModuleSwitch = (modId: MmelaModule) => {
    setActiveModule(modId);
    onNavigate(MODULE_CONFIG[modId].defaultPath);
  };

  const activeNavItem = currentModule.navItems.find(
    (item) => activePath === item.href || item.children?.some((c) => activePath === c.href)
  );
  const activeChildren = activeNavItem?.children;

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        {/* Brand bar */}
        <div className="bg-brand-900 text-white">
          <div className="flex items-center justify-between h-12 px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate(currentModule.defaultPath)}
                className="text-[15px] font-semibold tracking-tight hover:opacity-80 transition-opacity"
              >
                Mmela
              </button>

              {showSwitcher && (
                <>
                  <div className="w-px h-4 bg-brand-800" />
                  <div className="flex gap-1">
                    {MODULE_ORDER
                      .filter((id) => accessibleModules.some((m) => m.id === id))
                      .map((id) => {
                        const mod = accessibleModules.find((m) => m.id === id)!;
                        const isHub = id === "hub";
                        return (
                          <button
                            key={mod.id}
                            onClick={() => handleModuleSwitch(mod.id as MmelaModule)}
                            className={`px-3 py-1 rounded-md text-[13px] font-medium transition-all flex items-center gap-1 ${
                              activeModule === mod.id
                                ? "bg-brand-700 text-white"
                                : isHub
                                ? "text-brand-200 hover:text-white hover:bg-brand-800 border border-brand-700"
                                : "text-brand-300 hover:text-white hover:bg-brand-800"
                            }`}
                          >
                            {isHub && <LayoutGrid className="w-3 h-3" />}
                            {mod.label}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}

              {!showSwitcher && (
                <>
                  <div className="w-px h-4 bg-brand-800" />
                  <span className="text-[13px] font-medium text-brand-200">
                    {currentModule.label}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeModule === "sales" && (
                canToggleSegment ? (
                  // Toggle visible for TL / Manager / Admin
                  <div className="flex rounded-md overflow-hidden border border-brand-800">
                    <button
                      onClick={() => onSegmentChange("Individual")}
                      className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                        segment === "Individual" ? "bg-brand-700 text-white" : "text-brand-300 hover:text-white"
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      onClick={() => onSegmentChange("Commercial")}
                      className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                        segment === "Commercial" ? "bg-brand-700 text-white" : "text-brand-300 hover:text-white"
                      }`}
                    >
                      Commercial
                    </button>
                  </div>
                ) : (
                  // Locked badge for segment-specific agents
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-brand-800" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-300" />
                    <span className="text-[12px] font-medium text-brand-200">{segment}</span>
                  </div>
                )
              )}

              <button className="relative p-1.5 rounded-md hover:bg-brand-800 transition-colors text-brand-300 hover:text-white">
                <Bell className="w-4 h-4" />
              </button>

              {/* Global referral quick-add — visible to all users */}
              <button
                onClick={() => setShowReferral(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                title="Add a referral from anywhere"
              >
                + Referral
              </button>

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-brand-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-[11px] font-semibold text-white">
                    {initials}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-300" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{user.role}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                    </div>

                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => { setOverlay("profile"); setProfileOpen(false); }}
                    >
                      <UserIcon className="w-4 h-4" />
                      Profile
                    </button>

                    {isAdmin && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => { setOverlay("settings"); setProfileOpen(false); }}
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                    )}

                    <div className="border-t border-gray-100 mt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex items-center h-10 px-5 gap-0">
            {currentModule.navItems.map((item) => {
              const isActive =
                activePath === item.href ||
                item.children?.some((c) => activePath === c.href);
              return (
                <button
                  key={item.href}
                  onClick={() => onNavigate(item.href)}
                  className={`px-3 h-10 text-[13px] font-medium transition-colors relative ${
                    isActive ? "text-brand-900" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-brand-900 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-nav pills */}
        {activeChildren && activeChildren.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center h-9 px-5 gap-1.5">
              {activeChildren.map((child) => {
                const isChildActive = activePath === child.href;
                return (
                  <button
                    key={child.href}
                    onClick={() => onNavigate(child.href)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                      isChildActive
                        ? "bg-white text-gray-900 border border-gray-200 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                    }`}
                  >
                    {child.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Settings overlay — Admin only */}
      {overlay === "settings" && (
        <SettingsOverlay
          isAdmin={isAdmin}
          onClose={() => setOverlay(null)}
        />
      )}

      {/* Profile overlay — all users */}
      {overlay === "profile" && (
        <Overlay title="My profile" onClose={() => setOverlay(null)}>
          <ProfilePanel />
        </Overlay>
      )}

      {/* Global referral modal */}
      {showReferral && (
        <QuickReferralModal onClose={() => setShowReferral(false)} />
      )}
    </>
  );
}
