"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import UsersAndAccess from "@/components/admin/UsersAndAccess";
import CatalogSettings from "@/components/admin/CatalogSettings";
import AuditLogPanel from "@/components/admin/AuditLogPanel";
import {
  Users, Bell, Shield, Database, ArrowLeft, ClipboardList, BookOpen,
} from "lucide-react";

type Section = "users" | "catalog" | "audit" | "notifications" | "security" | "system";

const ALL_ROLES = [
  "Admin", "Manager", "Team Leader", "Sales Agent",
  "Lead Admin", "Policy Admin", "Concierge Agent",
  "Credit Health Agent", "Marketing Admin", "Call Centre Assistance Supervisor",
];

function SidebarItem({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
      style={{ background: active ? "#EEF4FD" : "transparent", color: active ? "#1A348C" : "#6B7280" }}
    >
      <span style={{ color: active ? "#1A348C" : "#9CA3AF", flexShrink: 0 }}>{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

// ── Notifications ───────────────────────────────────────────────

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
    const { data } = await supabase.from("notification_rules").select("*").order("notification_type");
    setRules((data as NotificationRule[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function handleToggleEnabled(rule: NotificationRule) {
    if (!isAdmin) return;
    await supabase.from("notification_rules").update({ enabled: !rule.enabled, updated_at: new Date().toISOString() }).eq("id", rule.id);
    await fetchRules();
  }

  async function handleToggleRole(rule: NotificationRule, role: string) {
    if (!isAdmin) return;
    setSaving(rule.id);
    const current = rule.recipient_roles ?? [];
    const updated = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    await supabase.from("notification_rules").update({ recipient_roles: updated, updated_at: new Date().toISOString() }).eq("id", rule.id);
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
          <div key={rule.id} className="rounded-xl p-4" style={{ border: `1px solid ${rule.enabled ? "#E5E7EB" : "#F1F3F5"}`, background: rule.enabled ? "#fff" : "#FAFAFA", opacity: rule.enabled ? 1 : 0.7 }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{rule.label}</p>
                  {saved === rule.id && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#EAF3DE", color: "#085041" }}>Saved</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  style={{ width: 40, height: 22, borderRadius: 11, padding: 2, flexShrink: 0, background: rule.enabled ? "#1A348C" : "#E5E7EB", border: "none", cursor: "pointer", transition: "background 0.2s", position: "relative" }}
                  title={rule.enabled ? "Disable this notification" : "Enable this notification"}
                >
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: rule.enabled ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </button>
              )}
            </div>
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
                      style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500, border: `1px solid ${active ? "#1A348C" : "#E5E7EB"}`, background: active ? "#EEF4FD" : "#F8F9FB", color: active ? "#1A348C" : "#9CA3AF", cursor: isAdmin ? "pointer" : "default", transition: "all 0.15s" }}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
              {(rule.recipient_roles ?? []).length === 0 && (
                <p className="text-xs text-red-400 mt-1.5">⚠ No recipients — this notification won&apos;t be sent</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────

interface SessionRow { id: string; ip_address: string; user_agent: string; signed_in_at: string; refreshed_at: string; }
interface AllSessionRow { session_id: string; user_id: string; user_name: string; user_email: string; user_role: string; ip_address: string; user_agent: string; signed_in_at: string; refreshed_at: string; }

function parseUA(ua: string): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Desktop" };
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /MSIE|Trident/.test(ua) ? "Internet Explorer" : "Unknown";
  const os = /Windows NT/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "macOS" : /iPhone/.test(ua) ? "iOS (iPhone)" : /iPad/.test(ua) ? "iOS (iPad)" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "Unknown";
  const device = /Mobi|Android|iPhone/.test(ua) ? "Mobile" : /iPad|Tablet/.test(ua) ? "Tablet" : "Desktop";
  return { browser, os, device };
}

function DeviceDetailCard({
  label, ip, ua, signedIn, lastActive, onSignOut, signingOut,
}: {
  label: string; ip: string; ua: string; signedIn: string; lastActive?: string;
  onSignOut?: () => void; signingOut?: boolean;
}) {
  const p = parseUA(ua);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#F8F9FB", borderBottom: "1px solid #E5E7EB" }}>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {onSignOut && (
          <button
            className="btn text-xs text-white"
            style={{ background: "#A32D2D", padding: "4px 10px" }}
            disabled={signingOut}
            onClick={onSignOut}
          >
            {signingOut ? "Signing out…" : "Sign out this device"}
          </button>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-3">
        {[
          { label: "IP address", value: ip || "Not available" },
          { label: "Device type", value: p.device },
          { label: "Browser", value: p.browser },
          { label: "Operating system", value: p.os },
          { label: "Signed in", value: new Date(signedIn).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
          { label: "Last activity", value: lastActive ? new Date(lastActive).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
        ].map(({ label: l, value }) => (
          <div key={l}>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{l}</p>
            <p className="text-sm text-gray-900 font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <p className="text-[10px] text-gray-400 break-all">{ua}</p>
      </div>
    </div>
  );
}

function SecuritySection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [mySessions, setMySessions] = useState<SessionRow[]>([]);
  const [allSessions, setAllSessions] = useState<AllSessionRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMine, setSelectedMine] = useState<string | null>(null);
  const [selectedOther, setSelectedOther] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: mine } = await supabase.rpc("get_my_sessions");
    setMySessions((mine as SessionRow[]) ?? []);
    if (isAdmin) {
      const { data: all } = await supabase.rpc("get_all_sessions_admin");
      setAllSessions((all as AllSessionRow[]) ?? []);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function handleSignOutAll() {
    if (!window.confirm("Sign out of all sessions? You will be logged out immediately.")) return;
    setSigningOut(true);
    await supabase.auth.signOut({ scope: "global" });
  }

  async function handleRevoke(sessionId: string, isSelf: boolean) {
    if (!window.confirm(isSelf ? "Sign out this device? You'll need to log in again on it." : "Sign out this device?")) return;
    setRevokingId(sessionId);
    try {
      await supabase.rpc("revoke_session", { target_session_id: sessionId });
      setSelectedMine((v) => (v === sessionId ? null : v));
      setSelectedOther((v) => (v === sessionId ? null : v));
      await load();
    } finally {
      setRevokingId(null);
    }
  }

  const mineSelected = mySessions.find((s) => s.id === selectedMine);
  const otherSelected = allSessions.find((s) => s.session_id === selectedOther);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">Security</p>
        <p className="text-xs text-gray-400 mt-0.5">Your active devices and login details</p>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
      ) : mySessions.length === 0 ? (
        <div className="p-4 rounded-xl text-sm text-gray-400" style={{ border: "1px solid #E5E7EB" }}>No session data available.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Your devices ({mySessions.length})</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: mineSelected ? "1fr 1.5fr" : "1fr" }}>
            <div className="space-y-1.5">
              {mySessions.map((s, i) => {
                const p = parseUA(s.user_agent);
                const active = selectedMine === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedMine(active ? null : s.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                    style={{ background: active ? "#EEF4FD" : "#F8F9FB", border: `1px solid ${active ? "#B5D4F4" : "#E5E7EB"}` }}
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900">{p.browser} · {p.os} · {p.device}{i === 0 ? " (this device)" : ""}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.ip_address || "—"} · Signed in {new Date(s.signed_in_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {mineSelected && (
              <DeviceDetailCard
                label="Selected device"
                ip={mineSelected.ip_address}
                ua={mineSelected.user_agent}
                signedIn={mineSelected.signed_in_at}
                lastActive={mineSelected.refreshed_at}
                onSignOut={() => handleRevoke(mineSelected.id, true)}
                signingOut={revokingId === mineSelected.id}
              />
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">All active user sessions ({allSessions.length})</p>
          {allSessions.length === 0 ? (
            <p className="text-sm text-gray-400">No other active sessions.</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: otherSelected ? "1fr 1.5fr" : "1fr" }}>
              <div className="card p-0 overflow-hidden">
                <div className="table-scroll">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {["User", "Role", "IP address", "Device", "Signed in", "Last active"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allSessions.map((s) => {
                        const p = parseUA(s.user_agent);
                        const active = selectedOther === s.session_id;
                        return (
                          <tr
                            key={s.session_id}
                            className="hover:bg-gray-50 cursor-pointer"
                            style={active ? { background: "#EEF4FD" } : undefined}
                            onClick={() => setSelectedOther(active ? null : s.session_id)}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.user_name}</td>
                            <td className="px-3 py-2 text-gray-500">{s.user_role}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{s.ip_address || "—"}</td>
                            <td className="px-3 py-2 text-gray-500">{p.device} · {p.browser}</td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(s.signed_in_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{s.refreshed_at ? new Date(s.refreshed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {otherSelected && (
                <DeviceDetailCard
                  label={`${otherSelected.user_name}'s device`}
                  ip={otherSelected.ip_address}
                  ua={otherSelected.user_agent}
                  signedIn={otherSelected.signed_in_at}
                  lastActive={otherSelected.refreshed_at}
                  onSignOut={() => handleRevoke(otherSelected.session_id, false)}
                  signingOut={revokingId === otherSelected.session_id}
                />
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="p-4 rounded-xl" style={{ border: "1px solid #FAEEDA", background: "#FFFBF5" }}>
          <p className="text-sm font-semibold text-gray-900 mb-1">Sign out everywhere</p>
          <p className="text-xs text-gray-500 mb-3">Admin tool — terminates all active sessions for all users immediately.</p>
          <button className="btn btn-secondary text-xs" style={{ borderColor: "#F5A623", color: "#854F0B" }} disabled={signingOut} onClick={handleSignOutAll}>
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
            { label: "Leads", value: counts.leads },
            { label: "Clients", value: counts.clients },
            { label: "Policies", value: counts.policies },
            { label: "Users", value: counts.users },
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

// ── Main page ─────────────────────────────────────────────────

interface AdminSettingsPageProps {
  activePath: string;
  onNavigate: (path: string) => void;
  onExit: () => void;
}

export default function AdminSettingsPage({ activePath, onNavigate, onExit }: AdminSettingsPageProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const section: Section = (activePath.split("/")[3] as Section) || (isAdmin ? "users" : "notifications");

  const adminSections = [
    { id: "users" as const, icon: <Users className="w-4 h-4" />, label: "Users & Access" },
    { id: "catalog" as const, icon: <BookOpen className="w-4 h-4" />, label: "Catalog" },
    { id: "audit" as const, icon: <ClipboardList className="w-4 h-4" />, label: "Audit trail" },
    { id: "system" as const, icon: <Database className="w-4 h-4" />, label: "System" },
  ];

  const commonSections = [
    { id: "notifications" as const, icon: <Bell className="w-4 h-4" />, label: "Notifications" },
    { id: "security" as const, icon: <Shield className="w-4 h-4" />, label: "Security" },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div style={{ borderBottom: "1px solid #E5E7EB", background: "#fff" }}>
        <div className="flex items-center gap-3 px-5" style={{ height: 56 }}>
          <button className="btn btn-ghost text-sm gap-1.5 -ml-2" onClick={onExit}>
            <ArrowLeft className="w-4 h-4" /> Back to app
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <p className="text-sm font-semibold text-gray-900">Settings</p>
        </div>
      </div>

      <div className="flex" style={{ minHeight: "calc(100vh - 56px)" }}>
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #E5E7EB", padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {isAdmin && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px 4px" }}>
                Administration
              </p>
              {adminSections.map(({ id, icon, label }) => (
                <SidebarItem key={id} icon={icon} label={label} active={section === id} onClick={() => onNavigate(`/admin/settings/${id}`)} />
              ))}
              <div style={{ height: 1, background: "#E5E7EB", margin: "8px 4px" }} />
            </>
          )}
          <p style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px 4px" }}>
            My account
          </p>
          {commonSections.map(({ id, icon, label }) => (
            <SidebarItem key={id} icon={icon} label={label} active={section === id} onClick={() => onNavigate(`/admin/settings/${id}`)} />
          ))}
        </div>

        <div className="flex-1 p-6" style={{ minWidth: 0 }}>
          {section === "users" && isAdmin && <UsersAndAccess />}
          {section === "catalog" && isAdmin && <CatalogSettings />}
          {section === "audit" && isAdmin && <AuditLogPanel />}
          {section === "system" && isAdmin && <SystemSection />}
          {section === "notifications" && <NotificationsSection isAdmin={isAdmin} />}
          {section === "security" && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}
