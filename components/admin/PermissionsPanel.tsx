"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { Check, X, User, Users, Search, ChevronDown } from "lucide-react";

const ALL_ROLES = [
  "Admin","Manager","Team Leader","Sales Agent",
  "Policy Admin","Lead Admin","Marketing Admin",
  "Concierge Agent","Credit Health Agent","Call Centre Assistance Supervisor",
];

const PERMISSION_GROUPS: Record<string, string[]> = {
  "Dashboard & Analytics": ["View Dashboard","View Analytics","View Agent Performance","View Reporting","View Campaign Analytics","Export Reports"],
  "Leads": ["View Leads","See All Leads","Manage Lead Pool","View Lead Import","View Referrals","Delete Leads"],
  "Clients": ["View Clients","Edit Clients","Delete Clients"],
  "Policies": ["View Policies","Edit Policies","Delete Policies","View Retentions","View Alerts"],
  "Campaigns": ["Manage Campaigns","Manage Forms","Manage Routing"],
  "Administration": ["Access Admin Panel","Manage Catalog","Delete Users"],
};

const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flat();

interface RolePerm { role: string; permission: string; granted: boolean; }
interface UserOverride { user_id: string; permission: string; granted: boolean; reason?: string; }
interface UserRow { id: string; name: string; email: string; role: string; see_all_leads: boolean | null; }

type Tab = "roles" | "users";

// ── Role matrix tab ────────────────────────────────────────────

function RoleMatrix({ rolePerms, onToggle, isAdmin, saving }: {
  rolePerms: RolePerm[];
  onToggle: (role: string, perm: string) => void;
  isAdmin: boolean;
  saving: string | null;
}) {
  function has(role: string, perm: string) {
    return rolePerms.some(p => p.role === role && p.permission === perm && p.granted);
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="table-scroll">
        <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 whitespace-nowrap" style={{ minWidth: 200, borderRight: "1px solid #E5E7EB" }}>Permission</th>
              {ALL_ROLES.map(r => (
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
                    {ALL_ROLES.map(role => {
                      const granted = has(role, perm);
                      const key = `${role}::${perm}`;
                      return (
                        <td key={role} className="px-2 py-2 text-center">
                          <button
                            disabled={!isAdmin || saving === key || role === "Admin"}
                            onClick={() => onToggle(role, perm)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-all"
                            style={{ background: granted ? "#EAF3DE" : "#FCEBEB", cursor: isAdmin && role !== "Admin" ? "pointer" : "default", opacity: saving === key ? 0.5 : 1 }}
                            title={role === "Admin" ? "Admin always has full access" : `${role}: ${perm} — ${granted ? "Granted" : "Denied"}`}
                          >
                            {granted ? <Check style={{ width: 10, height: 10, color: "#27500A" }} /> : <X style={{ width: 10, height: 10, color: "#791F1F" }} />}
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
  );
}

// ── User overrides tab ─────────────────────────────────────────

function UserOverrides({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("users").select("id, name, email, role, see_all_leads").eq("status", "Active").order("name"),
      supabase.from("user_permission_overrides").select("user_id, permission, granted, reason"),
    ]).then(([ur, or]) => {
      setUsers((ur.data as UserRow[]) ?? []);
      setOverrides((or.data as UserOverride[]) ?? []);
      setLoading(false);
    });
  }, []);

  function getRoleDefault(role: string, perm: string): boolean {
    // Admin always has everything
    if (role === "Admin") return true;
    // Default conservative - Sales Agents can't see all leads by default
    if (perm === "See All Leads" && role === "Sales Agent") return false;
    return false;
  }

  function getUserOverride(userId: string, perm: string): UserOverride | undefined {
    return overrides.find(o => o.user_id === userId && o.permission === perm);
  }

  async function toggleOverride(user: UserRow, perm: string) {
    if (!isAdmin) return;
    const key = `${user.id}::${perm}`;
    setSaving(key);
    const existing = getUserOverride(user.id, perm);

    if (existing) {
      // Flip it
      const { error } = await supabase.from("user_permission_overrides")
        .update({ granted: !existing.granted, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("permission", perm);
      if (!error) setOverrides(prev => prev.map(o => o.user_id === user.id && o.permission === perm ? { ...o, granted: !existing.granted } : o));
    } else {
      // Create override (opposite of role default to make it useful)
      // If not currently in overrides, we want to explicitly grant it
      const { error } = await supabase.from("user_permission_overrides")
        .insert({ user_id: user.id, permission: perm, granted: true });
      if (!error) setOverrides(prev => [...prev, { user_id: user.id, permission: perm, granted: true }]);
    }
    setSaving(null);
  }

  async function removeOverride(userId: string, perm: string) {
    await supabase.from("user_permission_overrides").delete().eq("user_id", userId).eq("permission", perm);
    setOverrides(prev => prev.filter(o => !(o.user_id === userId && o.permission === perm)));
  }

  async function toggleLeadVisibility(user: UserRow) {
    if (!isAdmin) return;
    const newVal = user.see_all_leads === true ? false : user.see_all_leads === false ? null : true;
    await supabase.from("users").update({ see_all_leads: newVal }).eq("id", user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, see_all_leads: newVal } : u));
  }

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-lg" />;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: selectedUser ? "1fr 1.5fr" : "1fr" }}>
      {/* User list */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          {filtered.map(user => {
            const userOverrides = overrides.filter(o => o.user_id === user.id);
            const isSelected = selectedUser?.id === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setSelectedUser(isSelected ? null : user)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{ background: isSelected ? "#EEF4FD" : "#F8F9FB", border: `1px solid ${isSelected ? "#B5D4F4" : "#E5E7EB"}` }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                  style={{ background: isSelected ? "#1A348C" : "#E5E7EB", color: isSelected ? "#fff" : "#6B7280" }}>
                  {user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.role}</p>
                </div>
                {userOverrides.length > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#EEF4FD", color: "#1A348C" }}>
                    {userOverrides.length} override{userOverrides.length !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User detail */}
      {selectedUser && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: "#EEF4FD", border: "1px solid #B5D4F4" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-sm font-semibold text-white">
                {selectedUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedUser.name}</p>
                <p className="text-xs text-gray-500">{selectedUser.role} · {selectedUser.email}</p>
              </div>
            </div>
          </div>

          {/* Lead visibility control */}
          <div className="p-4 rounded-xl space-y-2" style={{ border: "1px solid #E5E7EB" }}>
            <p className="text-xs font-semibold text-gray-700">Lead visibility</p>
            <p className="text-xs text-gray-400">Controls whether this user can see all leads or only leads assigned to them.</p>
            <div className="flex gap-2 mt-2">
              {[
                { val: null,  label: "Role default", desc: selectedUser.role === "Sales Agent" ? "Assigned only" : "All leads" },
                { val: true,  label: "See all leads",  desc: "Overrides role" },
                { val: false, label: "Assigned only",  desc: "Overrides role" },
              ].map(({ val, label, desc }) => {
                const active = selectedUser.see_all_leads === val;
                return (
                  <button
                    key={String(val)}
                    disabled={!isAdmin}
                    onClick={() => toggleLeadVisibility(selectedUser)}
                    className="flex-1 p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: active ? "#1A348C" : "#F8F9FB",
                      border: `1px solid ${active ? "#1A348C" : "#E5E7EB"}`,
                      cursor: isAdmin ? "pointer" : "default",
                    }}
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
            <p className="text-xs font-semibold text-gray-700">Permission overrides</p>
            <p className="text-xs text-gray-400">Grant or deny specific permissions for this user, overriding their role defaults.</p>
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <div key={group} className="card">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{group}</p>
                <div className="space-y-1">
                  {perms.map(perm => {
                    const override = getUserOverride(selectedUser.id, perm);
                    const key = `${selectedUser.id}::${perm}`;
                    return (
                      <div key={perm} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
                        <span className="text-xs text-gray-700">{perm}</span>
                        <div className="flex items-center gap-2">
                          {override && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={override.granted ? { background: "#EAF3DE", color: "#27500A" } : { background: "#FCEBEB", color: "#791F1F" }}>
                              {override.granted ? "Granted" : "Denied"}
                            </span>
                          )}
                          {!override && (
                            <span className="text-[10px] text-gray-400">Role default</span>
                          )}
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button
                                disabled={saving === key}
                                onClick={() => toggleOverride(selectedUser, perm)}
                                className="text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                                style={{ background: "#EEF4FD", color: "#1A348C", border: "1px solid #B5D4F4" }}
                                title={override ? "Toggle override" : "Add override"}
                              >
                                {override ? "Toggle" : "+ Override"}
                              </button>
                              {override && (
                                <button
                                  onClick={() => removeOverride(selectedUser.id, perm)}
                                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                                  style={{ background: "#F8F9FB", color: "#9CA3AF", border: "1px solid #E5E7EB" }}
                                  title="Remove override (use role default)"
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
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function PermissionsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roles");

  const fetchPerms = useCallback(async () => {
    const { data } = await supabase.from("role_permissions").select("role, permission, granted").order("role");
    setRolePerms((data as RolePerm[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPerms(); }, [fetchPerms]);

  async function toggleRolePermission(role: string, perm: string) {
    if (!isAdmin || role === "Admin") return;
    const current = rolePerms.some(p => p.role === role && p.permission === perm && p.granted);
    const key = `${role}::${perm}`;
    setSaving(key);
    await supabase.from("role_permissions")
      .upsert({ role, permission: perm, granted: !current, updated_at: new Date().toISOString() }, { onConflict: "role,permission" });
    setRolePerms(prev => {
      const exists = prev.find(p => p.role === role && p.permission === perm);
      if (exists) return prev.map(p => p.role === role && p.permission === perm ? { ...p, granted: !current } : p);
      return [...prev, { role, permission: perm, granted: !current }];
    });
    setSaving(null);
  }

  if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Permissions</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? "Manage role defaults and individual user overrides." : "View current permission configuration."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {([["roles", <Users key="u" className="w-3.5 h-3.5" />, "Role defaults"], ["users", <User key="u2" className="w-3.5 h-3.5" />, "Per-user overrides"]] as const).map(([t, icon, label]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium relative transition-colors"
            style={{ color: tab === t ? "#1A348C" : "#6B7280" }}>
            {icon}{label}
            {tab === t && <span style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 2, background: "#1A348C", borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {tab === "roles" && <RoleMatrix rolePerms={rolePerms} onToggle={toggleRolePermission} isAdmin={isAdmin} saving={saving} />}
      {tab === "users" && <UserOverrides isAdmin={isAdmin} />}

      {!isAdmin && <p className="text-xs text-gray-400 text-center">Contact an Admin to modify permissions.</p>}
    </div>
  );
}
