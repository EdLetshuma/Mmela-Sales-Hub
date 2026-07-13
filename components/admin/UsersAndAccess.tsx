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

// ── Per-user detail: account + password + lead visibility + permission overrides ──

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPwField, setShowPwField] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [savingPerm, setSavingPerm] = useState<string | null>(null);
  const [leadVisSaving, setLeadVisSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.from("users").update({
        name: form.name,
        role: form.role,
        specialization: form.specialization,
        status: form.status,
        business_unit_id: form.business_unit_id || null,
      }).eq("id", user.id);
      if (error) throw error;
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

  async function toggleLeadVisibility(val: boolean | null) {
    if (!isAdmin) return;
    setLeadVisSaving(true);
    await supabase.from("users").update({ see_all_leads: val }).eq("id", user.id);
    setLeadVisSaving(false);
    onSaved();
  }

  function getOverride(perm: string) {
    return overrides.find((o) => o.user_id === user.id && o.permission === perm);
  }

  async function toggleOverride(perm: string) {
    if (!isAdmin) return;
    const key = `${user.id}::${perm}`;
    setSavingPerm(key);
    const existing = getOverride(perm);
    if (existing) {
      await supabase.from("user_permission_overrides").update({ granted: !existing.granted }).eq("user_id", user.id).eq("permission", perm);
      onOverridesChanged(overrides.map((o) => (o.user_id === user.id && o.permission === perm ? { ...o, granted: !existing.granted } : o)));
    } else {
      await supabase.from("user_permission_overrides").insert({ user_id: user.id, permission: perm, granted: true });
      onOverridesChanged([...overrides, { user_id: user.id, permission: perm, granted: true }]);
    }
    setSavingPerm(null);
  }

  async function removeOverride(perm: string) {
    if (!isAdmin) return;
    await supabase.from("user_permission_overrides").delete().eq("user_id", user.id).eq("permission", perm);
    onOverridesChanged(overrides.filter((o) => !(o.user_id === user.id && o.permission === perm)));
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

      {/* Account fields */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>}
        <form onSubmit={handleSave} className="space-y-3">
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
          {isAdmin && (
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          )}
        </form>
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
        <div className="flex gap-2 mt-2">
          {[
            { val: null, label: "Role default", desc: user.role === "Sales Agent" ? "Assigned only" : "All leads" },
            { val: true, label: "See all leads", desc: "Overrides role" },
            { val: false, label: "Assigned only", desc: "Overrides role" },
          ].map(({ val, label, desc }) => {
            const active = user.see_all_leads === val;
            return (
              <button
                key={String(val)}
                disabled={!isAdmin || leadVisSaving}
                onClick={() => toggleLeadVisibility(val)}
                className="flex-1 p-2.5 rounded-lg text-left transition-all"
                style={{ background: active ? "#1A348C" : "#F8F9FB", border: `1px solid ${active ? "#1A348C" : "#E5E7EB"}`, cursor: isAdmin ? "pointer" : "default" }}
              >
                <p className="text-xs font-semibold" style={{ color: active ? "#fff" : "#374151" }}>{label}</p>
                <p className="text-[10px]" style={{ color: active ? "#B5D4F4" : "#9CA3AF" }}>{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Permission overrides */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">Permission overrides</p>
        <p className="text-xs text-gray-400">Grant or deny specific permissions for this user, overriding their role defaults.</p>
        {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
          <div key={group} className="card">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</p>
            <div className="space-y-1">
              {perms.map((perm) => {
                const override = getOverride(perm);
                const key = `${user.id}::${perm}`;
                return (
                  <div key={perm} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
                    <span className="text-xs text-gray-700">{perm}</span>
                    <div className="flex items-center gap-2">
                      {override ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={override.granted ? { background: "#EAF3DE", color: "#27500A" } : { background: "#FCEBEB", color: "#791F1F" }}>
                          {override.granted ? "Granted" : "Denied"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Role default</span>
                      )}
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            disabled={savingPerm === key}
                            onClick={() => toggleOverride(perm)}
                            className="text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                            style={{ background: "#EEF4FD", color: "#1A348C", border: "1px solid #B5D4F4" }}
                          >
                            {override ? "Toggle" : "+ Override"}
                          </button>
                          {override && (
                            <button
                              onClick={() => removeOverride(perm)}
                              className="text-[10px] px-2 py-0.5 rounded font-medium"
                              style={{ background: "#F8F9FB", color: "#9CA3AF", border: "1px solid #E5E7EB" }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
