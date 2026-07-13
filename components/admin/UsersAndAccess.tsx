"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createUser, type CreateUserPayload } from "@/lib/user-api";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  Plus, Search, X, Eye, EyeOff, Key, RefreshCw, Check, ArrowLeft,
} from "lucide-react";

// ── Shared reference data ──────────────────────────────────────

const ALL_ROLES = [
  "Admin", "Manager", "Team Leader", "Sales Agent",
  "Lead Admin", "Policy Admin", "Call Centre Assistance Supervisor",
  "Marketing Admin", "Concierge Agent", "Credit Health Agent",
];

const SPECIALIZATIONS = ["Individual", "Commercial", "Both"];
const SALES_ROLES = ["Sales Agent", "Team Leader", "Manager", "Admin", "Lead Admin", "Policy Admin", "Marketing Admin"];

const ROLE_DESC: Record<string, string> = {
  "Admin": "Full access to all modules, settings and user management.",
  "Manager": "Access to all modules and analytics. Cannot manage users.",
  "Team Leader": "Sales module. Can view team performance and manage leads.",
  "Sales Agent": "Sales module only. Sees assigned leads, clients and policies.",
  "Lead Admin": "Lead pool, import and assignment only.",
  "Policy Admin": "Clients, policies, retentions and alerts. No leads.",
  "Concierge Agent": "Concierge module only.",
  "Credit Health Agent": "Credit Health module only.",
  "Marketing Admin": "Campaigns module only.",
  "Call Centre Assistance Supervisor": "Read-only view of Sales module.",
};

const PERMISSION_GROUPS: Record<string, string[]> = {
  "Dashboard & Analytics": ["View Dashboard", "View Analytics", "View Agent Performance", "View Reporting", "View Campaign Analytics"],
  "Leads": ["View Leads", "See All Leads", "Manage Lead Pool", "View Lead Import", "View Referrals", "Delete Leads"],
  "Clients": ["View Clients", "Edit Clients", "Delete Clients"],
  "Policies": ["View Policies", "Edit Policies", "Delete Policies", "View Retentions", "View Alerts"],
  "Campaigns": ["Manage Campaigns", "Manage Forms", "Manage Routing"],
  "Administration": ["Access Admin Panel", "Manage Catalog", "Delete Users"],
};

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  specialization: string;
  business_unit_id?: string;
  see_all_leads?: boolean | null;
}

interface BusinessUnit { id: string; name: string; slug: string; }
interface RolePerm { role: string; permission: string; granted: boolean; }
interface UserOverride { user_id: string; permission: string; granted: boolean; }

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Admin": { bg: "#EEF4FD", color: "#1A348C" },
    "Manager": { bg: "#E1F5EE", color: "#085041" },
    "Team Leader": { bg: "#FAEEDA", color: "#633806" },
    "Sales Agent": { bg: "#F1EFE8", color: "#444441" },
    "Lead Admin": { bg: "#E6F1FB", color: "#0C447C" },
    "Policy Admin": { bg: "#FAEEDA", color: "#633806" },
    "Marketing Admin": { bg: "#EAF3DE", color: "#27500A" },
    "Concierge Agent": { bg: "#FAEEDA", color: "#633806" },
    "Credit Health Agent": { bg: "#E1F5EE", color: "#085041" },
    "Call Centre Assistance Supervisor": { bg: "#F1EFE8", color: "#5F5E5A" },
  };
  const s = map[role] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>{role}</span>;
}

// ── Create user modal (creation is a short, self-contained flow — stays a modal) ──

function CreateUserModal({ units, onClose, onCreated }: { units: BusinessUnit[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserPayload & { business_unit_id?: string }>({
    name: "", email: "", password: "", role: "Sales Agent", specialization: "Individual",
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true); setError(null);
    try {
      const { userId } = await createUser(form);
      if (form.business_unit_id && userId) {
        await supabase.from("users").update({ business_unit_id: form.business_unit_id }).eq("id", userId);
      }
      onCreated(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add new user</h2>
            <p className="text-xs text-gray-400 mt-0.5">Creates login account and profile in one step</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1 }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Sipho Dlamini" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email address</label>
                <input className="input-field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required placeholder="sipho@mmela.net" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <div style={{ position: "relative" }}>
                <input className="input-field" style={{ paddingRight: 36 }} type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required placeholder="Min 8 characters" autoComplete="new-password" />
                <button type="button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }} onClick={() => setShowPw((s) => !s)}>
                  {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Role</label>
                <select className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, specialization: SALES_ROLES.includes(e.target.value) ? (f.specialization || "Individual") : "" }))}>
                  {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
                <select className="input-field" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}>
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {units.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Business unit <span className="text-gray-400">(optional)</span></label>
                <select className="input-field" value={form.business_unit_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, business_unit_id: e.target.value || undefined }))}>
                  <option value="">Not assigned</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="p-3 rounded-lg text-xs text-gray-600" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
              {ROLE_DESC[form.role] ?? ""}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: "1px solid #E5E7EB" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create user"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role defaults matrix ────────────────────────────────────────

function RoleMatrix({ isAdmin }: { isAdmin: boolean }) {
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPerms = useCallback(async () => {
    const { data } = await supabase.from("role_permissions").select("role, permission, granted").order("role");
    setRolePerms((data as RolePerm[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  function has(role: string, perm: string) {
    return rolePerms.some((p) => p.role === role && p.permission === perm && p.granted);
  }

  async function toggle(role: string, perm: string) {
    if (!isAdmin || role === "Admin") return;
    const current = has(role, perm);
    const key = `${role}::${perm}`;
    setSaving(key);
    await supabase.from("role_permissions")
      .upsert({ role, permission: perm, granted: !current, updated_at: new Date().toISOString() }, { onConflict: "role,permission" });
    setRolePerms((prev) => {
      const exists = prev.find((p) => p.role === role && p.permission === perm);
      if (exists) return prev.map((p) => (p.role === role && p.permission === perm ? { ...p, granted: !current } : p));
      return [...prev, { role, permission: perm, granted: !current }];
    });
    setSaving(null);
  }

  if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-lg" />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Default permissions per role. Per-user overrides (set on each user&apos;s profile) take priority over these.
      </p>
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 whitespace-nowrap" style={{ minWidth: 200, borderRight: "1px solid #E5E7EB" }}>Permission</th>
                {ALL_ROLES.map((r) => (
                  <th key={r} className="px-2 py-3 text-center font-medium text-gray-500 bg-gray-50 whitespace-nowrap" style={{ minWidth: 72, fontSize: 10 }}>
                    {r.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                <React.Fragment key={group}>
                  <tr>
                    <td colSpan={ALL_ROLES.length + 1} className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                      style={{ background: "#F8F9FB", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                      {group}
                    </td>
                  </tr>
                  {perms.map((perm, i) => (
                    <tr key={perm} style={{ background: i % 2 === 0 ? "#fff" : "#F8F9FB" }}>
                      <td className="px-4 py-2 text-gray-700 sticky left-0 font-medium whitespace-nowrap"
                        style={{ background: i % 2 === 0 ? "#fff" : "#F8F9FB", borderRight: "1px solid #E5E7EB", zIndex: 1 }}>
                        {perm}
                      </td>
                      {ALL_ROLES.map((role) => {
                        const granted = has(role, perm);
                        const key = `${role}::${perm}`;
                        return (
                          <td key={role} className="px-2 py-2 text-center">
                            <button
                              disabled={!isAdmin || saving === key || role === "Admin"}
                              onClick={() => toggle(role, perm)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md transition-all"
                              style={{ background: granted ? "#EAF3DE" : "#F1F3F5", cursor: isAdmin && role !== "Admin" ? "pointer" : "default", opacity: saving === key ? 0.5 : 1 }}
                              title={role === "Admin" ? "Admin always has full access" : `${role}: ${perm} — ${granted ? "Granted" : "Not granted"}`}
                            >
                              {granted ? <Check style={{ width: 12, height: 12, color: "#27500A" }} /> : <X style={{ width: 12, height: 12, color: "#9CA3AF" }} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Segmented tri-state toggle: Default / Granted / Denied ────

type OverrideState = "default" | "granted" | "denied";

function SegmentedToggle({
  value, onChange, disabled,
}: { value: OverrideState; onChange: (v: OverrideState) => void; disabled?: boolean }) {
  const index = value === "default" ? 0 : value === "granted" ? 1 : 2;
  return (
    <div
      style={{
        position: "relative", display: "flex", width: 84, height: 22,
        background: "#F1F3F5", borderRadius: 11, padding: 2, flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute", top: 2, bottom: 2, left: 2,
          width: 24, borderRadius: 9,
          background: index === 1 ? "#0F6E56" : index === 2 ? "#A32D2D" : "#fff",
          boxShadow: index === 0 ? "0 1px 2px rgba(0,0,0,0.15)" : "none",
          transform: `translateX(${index * 26}px)`,
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
      />
      {(["default", "granted", "denied"] as OverrideState[]).map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          title={v === "default" ? "Role default" : v === "granted" ? "Granted" : "Denied"}
          style={{
            position: "relative", zIndex: 1, width: 24, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: disabled ? "default" : "pointer",
          }}
        >
          {v === "granted" && <Check style={{ width: 11, height: 11, color: index === 1 ? "#fff" : "#9CA3AF" }} />}
          {v === "denied" && <X style={{ width: 11, height: 11, color: index === 2 ? "#fff" : "#9CA3AF" }} />}
          {v === "default" && <span style={{ width: 4, height: 4, borderRadius: "50%", background: index === 0 ? "#6B7280" : "#D1D5DB" }} />}
        </button>
      ))}
    </div>
  );
}

// ── Per-user detail: account + lead visibility + permission overrides share
// one draft + Save button; password stays a separate immediate action ──

function UserDetail({
  user, units, isAdmin, overrides, onBack, onSaved, onOverridesChanged,
}: {
  user: AdminUser;
  units: BusinessUnit[];
  isAdmin: boolean;
  overrides: UserOverride[];
  onBack: () => void;
  onSaved: () => void;
  onOverridesChanged: (overrides: UserOverride[]) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    specialization: user.specialization ?? "Individual",
    status: user.status,
    business_unit_id: user.business_unit_id ?? "",
  });
  const [leadVisibility, setLeadVisibility] = useState<string>(
    user.see_all_leads === true ? "true" : user.see_all_leads === false ? "false" : "default"
  );

  const allPerms = Object.values(PERMISSION_GROUPS).flat();
  function initialOverrideState(perm: string): OverrideState {
    const o = overrides.find((ov) => ov.user_id === user.id && ov.permission === perm);
    return o ? (o.granted ? "granted" : "denied") : "default";
  }
  const [permDraft, setPermDraft] = useState<Record<string, OverrideState>>(
    () => Object.fromEntries(allPerms.map((p) => [p, initialOverrideState(p)]))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [showPwField, setShowPwField] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSaveAll() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const seeAllLeads = leadVisibility === "true" ? true : leadVisibility === "false" ? false : null;
      const { error: userErr } = await supabase.from("users").update({
        name: form.name,
        role: form.role,
        specialization: form.specialization,
        status: form.status,
        business_unit_id: form.business_unit_id || null,
        see_all_leads: seeAllLeads,
      }).eq("id", user.id);
      if (userErr) throw userErr;

      const nextOverrides = overrides.filter((o) => o.user_id !== user.id);
      for (const perm of allPerms) {
        const draftState = permDraft[perm];
        if (draftState === "default") continue;
        nextOverrides.push({ user_id: user.id, permission: perm, granted: draftState === "granted" });
      }

      await supabase.from("user_permission_overrides").delete().eq("user_id", user.id);
      const toInsert = nextOverrides.filter((o) => o.user_id === user.id);
      if (toInsert.length > 0) {
        await supabase.from("user_permission_overrides").insert(toInsert);
      }
      onOverridesChanged(nextOverrides);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) { setPwResult({ ok: false, msg: "Password must be at least 8 characters." }); return; }
    setResetting(true); setPwResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://tslovjdrcbnewcajawiq.supabase.co/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "reset_password", userId: user.id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwResult({ ok: true, msg: "Password updated successfully." });
      setNewPassword(""); setShowPwField(false);
    } catch (err: unknown) {
      setPwResult({ ok: false, msg: err instanceof Error ? err.message : "Failed to reset password." });
    } finally { setResetting(false); }
  }

  async function handleSendReset() {
    setResetting(true); setPwResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://tslovjdrcbnewcajawiq.supabase.co/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "send_reset_email", userId: user.id, userEmail: user.email, userName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwResult({ ok: true, msg: `Reset email sent to ${user.email}` });
    } catch (err: unknown) {
      setPwResult({ ok: false, msg: err instanceof Error ? err.message : "Failed to send reset email." });
    } finally { setResetting(false); }
  }


  return (
    <div className="space-y-4">
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> Back to users
      </button>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-sm font-semibold text-white">
            {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="ml-auto"><RoleBadge role={user.role} /></div>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>}
      {saved && <div className="p-3 rounded-lg text-xs" style={{ background: "#EAF3DE", color: "#085041" }}>Changes saved.</div>}

      {/* Account fields */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Full name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required disabled={!isAdmin} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Role</label>
              <select className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} disabled={!isAdmin}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
              <select className="input-field" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} disabled={!isAdmin}>
                {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={!isAdmin}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Business unit</label>
              <select className="input-field" value={form.business_unit_id} onChange={(e) => setForm((f) => ({ ...f, business_unit_id: e.target.value }))} disabled={!isAdmin}>
                <option value="">Not assigned</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="text-xs text-gray-400 p-2 rounded" style={{ background: "#F8F9FB" }}>
            {ROLE_DESC[form.role] ?? ""}
          </div>
        </div>
      </div>

      {/* Password management */}
      {isAdmin && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Password</h2>
          {pwResult && (
            <div className="mb-3 p-3 rounded-lg text-xs" style={pwResult.ok ? { background: "#EAF3DE", color: "#085041" } : { background: "#FCEBEB", color: "#791F1F" }}>
              {pwResult.msg}
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <button className="btn btn-secondary text-xs gap-1.5 flex-1" onClick={handleSendReset} disabled={resetting}>
              <RefreshCw className="w-3.5 h-3.5" /> Send reset email
            </button>
            <button className="btn btn-secondary text-xs gap-1.5 flex-1" onClick={() => setShowPwField((s) => !s)}>
              <Key className="w-3.5 h-3.5" /> Set new password
            </button>
          </div>
          {showPwField && (
            <div className="space-y-2">
              <div style={{ position: "relative" }}>
                <input
                  className="input-field" style={{ paddingRight: 36 }}
                  type={showPw ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)" autoComplete="new-password"
                />
                <button type="button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }} onClick={() => setShowPw((s) => !s)}>
                  {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
              <button className="btn btn-primary w-full text-xs" onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}>
                {resetting ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lead visibility */}
      <div className="card space-y-2">
        <p className="text-sm font-semibold text-gray-900">Lead visibility</p>
        <p className="text-xs text-gray-400">Controls whether this user sees all leads or only leads assigned to them.</p>
        <select
          className="input-field mt-1"
          style={{ width: 240 }}
          value={leadVisibility}
          onChange={(e) => setLeadVisibility(e.target.value)}
          disabled={!isAdmin}
        >
          <option value="default">Role default ({user.role === "Sales Agent" ? "assigned only" : "all leads"})</option>
          <option value="true">See all leads</option>
          <option value="false">Assigned only</option>
        </select>
      </div>

      {/* Permission overrides */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">Permission overrides</p>
        <p className="text-xs text-gray-400">Grant or deny specific permissions for this user, overriding their role defaults.</p>
        {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
          <div key={group} className="card">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</p>
            <div className="space-y-1">
              {perms.map((perm) => (
                <div key={perm} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                  <span className="text-xs text-gray-700">{perm}</span>
                  <SegmentedToggle
                    value={permDraft[perm]}
                    disabled={!isAdmin}
                    onChange={(v) => setPermDraft((prev) => ({ ...prev, [perm]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex justify-end sticky bottom-0 bg-[#F8F9FB] py-3" style={{ borderTop: "1px solid #E5E7EB" }}>
          <button className="btn btn-primary" disabled={saving} onClick={handleSaveAll}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function UsersAndAccess() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";
  const [tab, setTab] = useState<"users" | "roles">("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [ur, bur, or] = await Promise.all([
      supabase.from("users").select("id, name, email, role, status, specialization, business_unit_id, see_all_leads").order("name"),
      supabase.from("business_units").select("id, name, slug").order("name"),
      supabase.from("user_permission_overrides").select("user_id, permission, granted"),
    ]);
    setUsers((ur.data as AdminUser[]) ?? []);
    setUnits((bur.data as BusinessUnit[]) ?? []);
    setOverrides((or.data as UserOverride[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (!search || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (!roleFilter || u.role === roleFilter);
  });

  const unitName = (id?: string) => units.find((u) => u.id === id)?.name ?? "—";
  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  if (loading) return <div className="card h-40 animate-pulse bg-gray-50" />;

  if (selectedUser) {
    return (
      <UserDetail
        user={selectedUser}
        units={units}
        isAdmin={isAdmin}
        overrides={overrides}
        onBack={() => setSelectedUserId(null)}
        onSaved={fetchAll}
        onOverridesChanged={setOverrides}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {([["users", "Users"], ["roles", "Role defaults"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium relative transition-colors"
            style={{ color: tab === t ? "#1A348C" : "#6B7280" }}>
            {label}
            {tab === t && <span style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 2, background: "#1A348C", borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {tab === "roles" ? (
        <RoleMatrix isAdmin={isAdmin} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Users — {users.filter((u) => u.status === "Active").length} active of {users.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Click a user to manage their account, password, and permissions</p>
            </div>
            {isAdmin && (
              <button className="btn btn-primary gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> Add user
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input className="input-field pl-8" style={{ width: 220 }} placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field" style={{ width: 180 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {(search || roleFilter) && <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setRoleFilter(""); }}>Clear</button>}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Name", "Email", "Role", "Unit", "Specialization", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: "#EEF4FD", color: "#1A348C" }}>
                            {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{unitName(u.business_unit_id)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.specialization ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="badge" style={u.status === "Active" ? { background: "#EAF3DE", color: "#27500A" } : { background: "#FCEBEB", color: "#791F1F" }}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showCreate && <CreateUserModal units={units} onClose={() => setShowCreate(false)} onCreated={fetchAll} />}
    </div>
  );
}
