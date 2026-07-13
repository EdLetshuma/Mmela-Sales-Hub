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
interface SessionSummaryRow {
  user_id: string; user_name: string; user_email: string; user_role: string;
  session_count: number; last_active: string | null;
  current_session_id: string | null; current_ip: string | null; current_user_agent: string | null; current_signed_in_at: string | null;
}

const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

function UserSessionHistory({
  userName, history, loading, onRevoke, revokingId,
}: {
  userName: string; history: SessionRow[]; loading: boolean;
  onRevoke: (id: string) => void; revokingId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRow = history.find((h) => h.id === selected);

  if (loading) return <div className="h-24 animate-pulse bg-gray-50 rounded-xl" />;
  if (history.length === 0) return <p className="text-xs text-gray-400 px-1">No session history for {userName}.</p>;

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: selectedRow ? "1fr 1.5fr" : "1fr" }}>
      <div className="space-y-1.5">
        {history.map((s, i) => {
          const p = parseUA(s.user_agent);
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelected(active ? null : s.id)}
              className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
              style={{ background: active ? "#EEF4FD" : "#F8F9FB", border: `1px solid ${active ? "#B5D4F4" : "#E5E7EB"}` }}
            >
              <div>
                <p className="text-xs font-medium text-gray-900">
                  {p.browser} · {p.os} · {p.device}{i === 0 ? " (current)" : ""}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {s.ip_address || "—"} · Signed in {new Date(s.signed_in_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {selectedRow && (
        <DeviceDetailCard
          label={`${userName}'s device`}
          ip={selectedRow.ip_address}
          ua={selectedRow.user_agent}
          signedIn={selectedRow.signed_in_at}
          lastActive={selectedRow.refreshed_at}
          onSignOut={() => onRevoke(selectedRow.id)}
          signingOut={revokingId === selectedRow.id}
        />
      )}
    </div>
  );
}

function SecuritySection() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [mySessions, setMySessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<SessionSummaryRow[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMine, setSelectedMine] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<SessionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: mine } = await supabase.rpc("get_my_sessions");
    setMySessions((mine as SessionRow[]) ?? []);
    if (isAdmin) {
      const { data: sum } = await supabase.rpc("get_sessions_summary_admin");
      setSummary((sum as SessionSummaryRow[]) ?? []);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const loadHistoryFor = useCallback(async (userId: string) => {
    setHistoryLoading(true);
    const { data } = await supabase.rpc("get_user_session_history_admin", { p_user_id: userId });
    setUserHistory((data as SessionRow[]) ?? []);
    setHistoryLoading(false);
  }, []);

  function toggleUser(userId: string) {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setUserHistory([]);
      return;
    }
    setSelectedUserId(userId);
    loadHistoryFor(userId);
  }

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
      await load();
      if (selectedUserId) await loadHistoryFor(selectedUserId);
    } finally {
      setRevokingId(null);
    }
  }

  const mineSelected = mySessions.find((s) => s.id === selectedMine);
  const now = Date.now();
  const activeUsers = summary.filter((s) => s.last_active && now - new Date(s.last_active).getTime() < ACTIVE_WINDOW_MS);
  const inactiveUsers = summary.filter((s) => !s.last_active || now - new Date(s.last_active).getTime() >= ACTIVE_WINDOW_MS);
  const selectedUser = summary.find((s) => s.user_id === selectedUserId);

  function UserRow({ s }: { s: SessionSummaryRow }) {
    const p = parseUA(s.current_user_agent ?? "");
    const active = selectedUserId === s.user_id;
    return (
      <button
        onClick={() => toggleUser(s.user_id)}
        className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
        style={{ background: active ? "#EEF4FD" : "#F8F9FB", border: `1px solid ${active ? "#B5D4F4" : "#E5E7EB"}` }}
      >
        <div>
          <p className="text-xs font-medium text-gray-900">{s.user_name} <span className="text-gray-400 font-normal">· {s.user_role}</span></p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {s.current_ip || "—"} · {p.device} · {p.browser} · {s.session_count} session{s.session_count !== 1 ? "s" : ""} on record
          </p>
        </div>
        <p className="text-[10px] text-gray-400 whitespace-nowrap ml-3">
          {s.last_active
            ? `Last active ${new Date(s.last_active).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
            : "Never logged in"}
        </p>
      </button>
    );
  }

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
          <p className="text-xs font-semibold text-gray-700">Active users ({activeUsers.length})</p>
          <p className="text-[11px] text-gray-400 -mt-1">Active in the last 24 hours. Click a user to see their current session and full sign-in history.</p>
          {activeUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No users active in the last 24 hours.</p>
          ) : (
            <div className="space-y-1.5">
              {activeUsers.map((s) => (
                <div key={s.user_id}>
                  <UserRow s={s} />
                  {selectedUserId === s.user_id && (
                    <div className="mt-1.5 pl-1">
                      <UserSessionHistory
                        userName={s.user_name}
                        history={userHistory}
                        loading={historyLoading}
                        revokingId={revokingId}
                        onRevoke={(id) => handleRevoke(id, false)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Inactive users ({inactiveUsers.length})</p>
          <p className="text-[11px] text-gray-400 -mt-1">Not active in the last 24 hours — shows when they last logged in.</p>
          {inactiveUsers.length === 0 ? (
            <p className="text-sm text-gray-400">All users are currently active.</p>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="table-scroll">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["User", "Role", "Sessions on record", "Last active"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inactiveUsers.map((s) => (
                      <React.Fragment key={s.user_id}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          style={selectedUserId === s.user_id ? { background: "#EEF4FD" } : undefined}
                          onClick={() => toggleUser(s.user_id)}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.user_name}</td>
                          <td className="px-3 py-2 text-gray-500">{s.user_role}</td>
                          <td className="px-3 py-2 text-gray-500">{s.session_count}</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                            {s.last_active
                              ? new Date(s.last_active).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                              : "Never logged in"}
                          </td>
                        </tr>
                        {selectedUserId === s.user_id && (
                          <tr>
                            <td colSpan={4} className="px-3 py-2" style={{ background: "#FAFBFC" }}>
                              <UserSessionHistory
                                userName={s.user_name}
                                history={userHistory}
                                loading={historyLoading}
                                revokingId={revokingId}
                                onRevoke={(id) => handleRevoke(id, false)}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
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
