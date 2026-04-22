"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import AdminPanel from "@/components/admin/AdminPanel";
import PermissionsPanel from "@/components/admin/PermissionsPanel";
import AuditLogPanel from "@/components/admin/AuditLogPanel";
import {
  Users, Bell, Shield, Database,
  Building2, ChevronRight, X, Lock, ClipboardList,
} from "lucide-react";

type SettingsSection = "users" | "permissions" | "audit" | "notifications" | "business-units" | "security" | "system";

const ALL_ROLES = [
  "Admin", "Manager", "Team Leader", "Sales Agent",
  "Lead Admin", "Policy Admin", "Concierge Agent",
  "Credit Health Agent", "Marketing Admin", "Call Centre Assistance Supervisor",
];

// ── Sidebar item ──────────────────────────────────────────────

function SidebarItem({
  icon, label, section, active, onClick,
}: {
  icon: React.ReactNode; label: string;
  section: SettingsSection; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
      style={{
        background: active ? "#EEF4FD" : "transparent",
        color: active ? "#1A348C" : "#6B7280",
      }}
    >
      <span style={{ color: active ? "#1A348C" : "#9CA3AF", flexShrink: 0 }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5" style={{ color: "#1A348C", flexShrink: 0 }} />}
    </button>
  );
}

// ── Notification rules (Admin) ────────────────────────────────

interface NotificationRule {
  id: string;
  notification_type: string;
  label: string;
  description: string;
  recipient_roles: string[];
  enabled: boolean;
}

function NotificationsSection({ isAdmin }: { isAdmin: boolean }) {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from("notification_rules")
      .select("*")
      .order("notification_type");
    setRules((data as NotificationRule[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function handleToggleEnabled(rule: NotificationRule) {
    if (!isAdmin) return;
    await supabase
      .from("notification_rules")
      .update({ enabled: !rule.enabled, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    await fetchRules();
  }

  async function handleToggleRole(rule: NotificationRule, role: string) {
    if (!isAdmin) return;
    setSaving(rule.id);
    const current = rule.recipient_roles ?? [];
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    await supabase
      .from("notification_rules")
      .update({ recipient_roles: updated, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    await fetchRules();
    setSaving(null);
    setSaved(rule.id);
    setTimeout(() => setSaved(null), 1500);
  }

  if (loading) return <div className="h-40 bg-gray-50 rounded-lg animate-pulse" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">Notification rules</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isAdmin
            ? "Control which roles receive each notification type. Changes apply to all users in that role immediately."
            : "These are the current notification rules. Contact an Admin to change who receives each notification."}
        </p>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-xl p-4"
            style={{
              border: `1px solid ${rule.enabled ? "#E5E7EB" : "#F1F3F5"}`,
              background: rule.enabled ? "#fff" : "#FAFAFA",
              opacity: rule.enabled ? 1 : 0.7,
            }}
          >
            {/* Rule header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{rule.label}</p>
                  {saved === rule.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#EAF3DE", color: "#085041" }}>
                      Saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
              </div>
              {/* Enabled toggle — Admin only */}
              {isAdmin && (
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, padding: 2, flexShrink: 0,
                    background: rule.enabled ? "#1A348C" : "#E5E7EB",
                    border: "none", cursor: "pointer", transition: "background 0.2s",
                    position: "relative",
                  }}
                  title={rule.enabled ? "Disable this notification" : "Enable this notification"}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2,
                    left: rule.enabled ? 20 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }} />
                </button>
              )}
            </div>

            {/* Role chips */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">Recipients</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((role) => {
                  const active = (rule.recipient_roles ?? []).includes(role);
                  return (
                    <button
                      key={role}
                      disabled={!isAdmin || saving === rule.id}
                      onClick={() => handleToggleRole(rule, role)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 500,
                        border: `1px solid ${active ? "#1A348C" : "#E5E7EB"}`,
                        background: active ? "#EEF4FD" : "#F8F9FB",
                        color: active ? "#1A348C" : "#9CA3AF",
                        cursor: isAdmin ? "pointer" : "default",
                        transition: "all 0.15s",
                      }}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
              {(rule.recipient_roles ?? []).length === 0 && (
                <p className="text-xs text-red-400 mt-1.5">⚠ No recipients — this notification won't be sent</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Business units ────────────────────────────────────────────

function BusinessUnitsSection() {
  const [units, setUnits] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [uRes, userRes] = await Promise.all([
        supabase.from("business_units").select("id, name, slug").order("name"),
        supabase.from("users").select("id, role"),
      ]);
      setUnits(uRes.data ?? []);
      const users = userRes.data ?? [];
      setCounts({
        "Concierge":     users.filter((u) => u.role === "Concierge Agent").length,
        "Credit Health": users.filter((u) => u.role === "Credit Health Agent").length,
        "Sales":         users.filter((u) => ["Sales Agent","Team Leader","Lead Admin","Policy Admin"].includes(u.role)).length,
      });
      setLoading(false);
    }
    load();
  }, []);

  const COLORS: Record<string, { bg: string; color: string }> = {
    sales:           { bg: "#EEF4FD", color: "#1A348C" },
    concierge:       { bg: "#FAEEDA", color: "#633806" },
    "credit-health": { bg: "#E1F5EE", color: "#085041" },
  };

  if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Business units</p>
        <p className="text-xs text-gray-400 mt-0.5">The three operational units that make up Mmela Hub</p>
      </div>
      {units.map((unit) => {
        const style = COLORS[unit.slug] ?? { bg: "#F1F3F5", color: "#6B7280" };
        return (
          <div key={unit.id} className="p-4 rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: style.bg }}>
                  <Building2 style={{ width: 15, height: 15, color: style.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{unit.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{unit.id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{counts[unit.name] ?? 0}</p>
                <p className="text-xs text-gray-400">users</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────

interface SessionRow {
  id: string;
  ip_address: string;
  user_agent: string;
  signed_in_at: string;
  refreshed_at: string;
}

interface AllSessionRow {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  ip_address: string;
  user_agent: string;
  signed_in_at: string;
  refreshed_at: string;
}

function parseUA(ua: string): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Desktop" };
  const browser =
    /Edg\//.test(ua)     ? "Edge" :
    /Chrome\//.test(ua)  ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua)  ? "Safari" :
    /MSIE|Trident/.test(ua) ? "Internet Explorer" : "Unknown";
  const os =
    /Windows NT/.test(ua)  ? "Windows" :
    /Macintosh/.test(ua)   ? "macOS" :
    /iPhone/.test(ua)      ? "iOS (iPhone)" :
    /iPad/.test(ua)        ? "iOS (iPad)" :
    /Android/.test(ua)     ? "Android" :
    /Linux/.test(ua)       ? "Linux" : "Unknown";
  const device =
    /Mobi|Android|iPhone/.test(ua) ? "Mobile" :
    /iPad|Tablet/.test(ua)         ? "Tablet" : "Desktop";
  return { browser, os, device };
}

function SecuritySection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [mySessions, setMySessions] = useState<SessionRow[]>([]);
  const [allSessions, setAllSessions] = useState<AllSessionRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: mine } = await supabase.rpc("get_my_sessions");
      setMySessions((mine as SessionRow[]) ?? []);
      if (isAdmin) {
        const { data: all } = await supabase.rpc("get_all_sessions_admin");
        setAllSessions((all as AllSessionRow[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  async function handleSignOutAll() {
    if (!window.confirm("Sign out of all sessions? You will be logged out immediately.")) return;
    setSigningOut(true);
    await supabase.auth.signOut({ scope: "global" });
  }

  const currentSession = mySessions[0];
  const parsed = currentSession ? parseUA(currentSession.user_agent) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">Security</p>
        <p className="text-xs text-gray-400 mt-0.5">Your active sessions and login details</p>
      </div>

      {/* Current session */}
      {loading ? (
        <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
      ) : currentSession ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
          <div className="px-4 py-3" style={{ background: "#F8F9FB", borderBottom: "1px solid #E5E7EB" }}>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-700">Current session</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "#EAF3DE", color: "#27500A" }}>Active</span>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              { label: "IP address",    value: currentSession.ip_address || "Not available" },
              { label: "Device type",   value: parsed?.device ?? "—" },
              { label: "Browser",       value: parsed?.browser ?? "—" },
              { label: "Operating system", value: parsed?.os ?? "—" },
              { label: "Signed in",     value: new Date(currentSession.signed_in_at).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
              { label: "Last activity", value: currentSession.refreshed_at ? new Date(currentSession.refreshed_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm text-gray-900 font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3">
            <p className="text-[10px] text-gray-400 break-all">{currentSession.user_agent}</p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl text-sm text-gray-400" style={{ border: "1px solid #E5E7EB" }}>No session data available.</div>
      )}

      {/* Other sessions */}
      {mySessions.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Other active sessions ({mySessions.length - 1})</p>
          {mySessions.slice(1).map((s) => {
            const p = parseUA(s.user_agent);
            return (
              <div key={s.id} className="p-3 rounded-xl flex items-center justify-between" style={{ border: "1px solid #E5E7EB" }}>
                <div>
                  <p className="text-xs font-medium text-gray-900">{p.browser} · {p.os} · {p.device}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {s.ip_address} · Signed in {new Date(s.signed_in_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin: all active sessions */}
      {isAdmin && allSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">All active user sessions ({allSessions.length})</p>
          <div className="card p-0 overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["User","Role","IP address","Device","Browser","OS","Signed in","Last active"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allSessions.map((s, i) => {
                    const p = parseUA(s.user_agent);
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.user_name}</td>
                        <td className="px-3 py-2 text-gray-500">{s.user_role}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{s.ip_address || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{p.device}</td>
                        <td className="px-3 py-2 text-gray-500">{p.browser}</td>
                        <td className="px-3 py-2 text-gray-500">{p.os}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(s.signed_in_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{s.refreshed_at ? new Date(s.refreshed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sign out everywhere — Admin only */}
      {isAdmin && (
        <div className="p-4 rounded-xl" style={{ border: "1px solid #FAEEDA", background: "#FFFBF5" }}>
          <p className="text-sm font-semibold text-gray-900 mb-1">Sign out everywhere</p>
          <p className="text-xs text-gray-500 mb-3">Admin tool — terminates all active sessions for all users immediately.</p>
          <button
            className="btn btn-secondary text-xs"
            style={{ borderColor: "#F5A623", color: "#854F0B" }}
            disabled={signingOut}
            onClick={handleSignOutAll}
          >
            {signingOut ? "Signing out…" : "Sign out of all devices"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── System ────────────────────────────────────────────────────

function SystemSection() {
  const [counts, setCounts] = useState<{ leads: number; clients: number; policies: number; users: number } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("policies").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }),
    ]).then(([l, c, p, u]) => {
      setCounts({ leads: l.count ?? 0, clients: c.count ?? 0, policies: p.count ?? 0, users: u.count ?? 0 });
    });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">System</p>
        <p className="text-xs text-gray-400 mt-0.5">Platform information and database overview</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Platform", value: "Mmela Hub" },
          { label: "Version", value: "1.0.0" },
          { label: "Database", value: "Supabase PostgreSQL" },
          { label: "Region", value: "af-south-1 (Cape Town)" },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>
      {counts ? (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Leads",    value: counts.leads },
            { label: "Clients",  value: counts.clients },
            { label: "Policies", value: counts.policies },
            { label: "Users",    value: counts.users },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg text-center" style={{ background: "#EEF4FD" }}>
              <p className="text-xl font-semibold" style={{ color: "#1A348C" }}>{value.toLocaleString()}</p>
              <p className="text-xs mt-0.5" style={{ color: "#235DCB" }}>{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-20 animate-pulse bg-gray-50 rounded-lg" />
      )}
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────

export default function SettingsOverlay({
  isAdmin,
  onClose,
}: {
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<SettingsSection>(isAdmin ? "users" : "notifications");

  const adminSections = [
    { section: "users" as const,          icon: <Users className="w-4 h-4" />,         label: "Users & Access" },
    { section: "permissions" as const,    icon: <Lock className="w-4 h-4" />,           label: "Permissions" },
    { section: "audit" as const,          icon: <ClipboardList className="w-4 h-4" />,  label: "Audit trail" },
    { section: "business-units" as const, icon: <Building2 className="w-4 h-4" />,     label: "Business units" },
    { section: "system" as const,         icon: <Database className="w-4 h-4" />,       label: "System" },
  ];

  const commonSections = [
    { section: "notifications" as const,  icon: <Bell className="w-4 h-4" />,      label: "Notifications" },
    { section: "security" as const,       icon: <Shield className="w-4 h-4" />,    label: "Security" },
  ];

  return (
    // Full-screen backdrop
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
        zIndex: 60, paddingTop: 56,
      }}
      onClick={onClose}
    >
      {/* Panel — 960px wide */}
      <div
        style={{
          width: "100%", maxWidth: 1100,
          height: "calc(100vh - 56px)",
          background: "#fff",
          borderLeft: "1px solid #E5E7EB",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px", borderBottom: "1px solid #E5E7EB",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Settings</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6B7280" }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Panel body — sidebar + content */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar — 200px */}
          <div style={{
            width: 220, flexShrink: 0,
            borderRight: "1px solid #E5E7EB",
            padding: "12px 10px",
            display: "flex", flexDirection: "column", gap: 2,
            overflowY: "auto",
          }}>
            {isAdmin && (
              <>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px 4px" }}>
                  Administration
                </p>
                {adminSections.map(({ section: s, icon, label }) => (
                  <SidebarItem key={s} icon={icon} label={label} section={s} active={section === s} onClick={() => setSection(s)} />
                ))}
                <div style={{ height: 1, background: "#E5E7EB", margin: "8px 4px" }} />
              </>
            )}
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px 4px" }}>
              My account
            </p>
            {commonSections.map(({ section: s, icon, label }) => (
              <SidebarItem key={s} icon={icon} label={label} section={s} active={section === s} onClick={() => setSection(s)} />
            ))}
          </div>

          {/* Content — fills remaining width */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", minWidth: 0 }}>
            {section === "users"          && <AdminPanel />}
            {section === "permissions"    && <PermissionsPanel />}
            {section === "audit"          && <AuditLogPanel />}
            {section === "notifications"  && <NotificationsSection isAdmin={isAdmin} />}
            {section === "business-units" && <BusinessUnitsSection />}
            {section === "security"       && <SecuritySection />}
            {section === "system"         && <SystemSection />}
          </div>

        </div>
      </div>
    </div>
  );
}
