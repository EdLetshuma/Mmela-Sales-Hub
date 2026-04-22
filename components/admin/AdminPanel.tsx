"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createUser, type CreateUserPayload } from "@/lib/user-api";
import { Plus, Search, Edit2, X, Eye, EyeOff, Key, RefreshCw } from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  specialization: string;
  business_unit_id?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  slug: string;
}

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

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Admin":           { bg: "#EEF4FD", color: "#1A348C" },
    "Manager":         { bg: "#E1F5EE", color: "#085041" },
    "Team Leader":     { bg: "#FAEEDA", color: "#633806" },
    "Sales Agent":     { bg: "#F1EFE8", color: "#444441" },
    "Lead Admin":      { bg: "#E6F1FB", color: "#0C447C" },
    "Policy Admin":    { bg: "#FAEEDA", color: "#633806" },
    "Marketing Admin": { bg: "#EAF3DE", color: "#27500A" },
    "Concierge Agent": { bg: "#FAEEDA", color: "#633806" },
    "Credit Health Agent": { bg: "#E1F5EE", color: "#085041" },
    "Call Centre Assistance Supervisor": { bg: "#F1EFE8", color: "#5F5E5A" },
  };
  const s = map[role] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>{role}</span>;
}

// ── Create User Modal ─────────────────────────────────────────

function CreateUserModal({
  units, onClose, onCreated,
}: { units: BusinessUnit[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserPayload & { business_unit_id?: string }>({
    name: "", email: "", password: "", role: "Sales Agent", specialization: "Individual",
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const sw = strength(form.password);
  const swLabel = ["","Weak","Fair","Good","Strong"][sw] ?? "";
  const swColor = ["","#A32D2D","#854F0B","#235DCB","#0F6E56"][sw] ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true); setError(null);
    try {
      const { userId } = await createUser(form);
      // Set business unit if selected
      if (form.business_unit_id && userId) {
        await supabase.from("users").update({ business_unit_id: form.business_unit_id }).eq("id", userId);
      }
      onCreated(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:70,padding:16 }} onClick={onClose}>
      <div className="card" style={{ width:"100%",maxWidth:500,maxHeight:"90vh",display:"flex",flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add new user</h2>
            <p className="text-xs text-gray-400 mt-0.5">Creates login account and profile in one step</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background:"#FCEBEB",color:"#791F1F" }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ overflowY:"auto",flex:1 }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} required placeholder="e.g. Sipho Dlamini" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email address</label>
                <input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({...f,email:e.target.value}))} required placeholder="sipho@mmela.net" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <div style={{ position:"relative" }}>
                <input className="input-field" style={{ paddingRight:36 }} type={showPw?"text":"password"} value={form.password} onChange={e => setForm(f => ({...f,password:e.target.value}))} required placeholder="Min 8 characters" autoComplete="new-password" />
                <button type="button" style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9CA3AF" }} onClick={() => setShowPw(s => !s)}>
                  {showPw ? <EyeOff style={{width:14,height:14}} /> : <Eye style={{width:14,height:14}} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex gap-0.5 flex-1">
                    {[1,2,3,4].map(i => <div key={i} style={{ flex:1,height:3,borderRadius:2,background:i<=sw?swColor:"#E5E7EB",transition:"background 0.2s" }} />)}
                  </div>
                  <span style={{ fontSize:11,color:swColor,fontWeight:500 }}>{swLabel}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Role</label>
                <select className="input-field" value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value, specialization: SALES_ROLES.includes(e.target.value) ? (f.specialization||"Individual") : ""}))}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
                <select className="input-field" value={form.specialization} onChange={e => setForm(f => ({...f,specialization:e.target.value}))}>
                  {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {units.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Business unit <span className="text-gray-400">(optional)</span></label>
                <select className="input-field" value={form.business_unit_id ?? ""} onChange={e => setForm(f => ({...f,business_unit_id:e.target.value||undefined}))}>
                  <option value="">Not assigned</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="p-3 rounded-lg text-xs text-gray-600" style={{ background:"#F8F9FB",border:"1px solid #E5E7EB" }}>
              {ROLE_DESC[form.role] ?? ""}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop:"1px solid #E5E7EB" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create user"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────

function EditUserModal({
  user, units, onClose, onSaved,
}: { user: AdminUser; units: BusinessUnit[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    specialization: user.specialization ?? "Individual",
    status: user.status,
    business_unit_id: user.business_unit_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPwField, setShowPwField] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwResult, setPwResult] = useState<{ok:boolean;msg:string}|null>(null);
  const [error, setError] = useState<string|null>(null);

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
      onSaved(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setSaving(false); }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) { setPwResult({ok:false,msg:"Password must be at least 8 characters."}); return; }
    setResetting(true); setPwResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://tslovjdrcbnewcajawiq.supabase.co/functions/v1/create-user`,
        {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}` },
          body: JSON.stringify({ action:"reset_password", userId: user.id, password: newPassword }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwResult({ok:true,msg:"Password updated successfully."});
      setNewPassword(""); setShowPwField(false);
    } catch (err: unknown) {
      setPwResult({ok:false,msg:err instanceof Error ? err.message : "Failed to reset password."});
    } finally { setResetting(false); }
  }

  async function handleSendReset() {
    setResetting(true); setPwResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://tslovjdrcbnewcajawiq.supabase.co/functions/v1/create-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: "send_reset_email", userId: user.id, userEmail: user.email, userName: user.name }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwResult({ ok: true, msg: `Branded reset email sent to ${user.email} via Resend` });
    } catch (err: unknown) {
      setPwResult({ ok: false, msg: err instanceof Error ? err.message : "Failed to send reset email." });
    } finally { setResetting(false); }
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:70,padding:16 }} onClick={onClose}>
      <div className="card" style={{ width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit — {user.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background:"#FCEBEB",color:"#791F1F" }}>{error}</div>}

        <div style={{ overflowY:"auto",flex:1 }}>
          <form onSubmit={handleSave}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Role</label>
                  <select className="input-field" value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
                  <select className="input-field" value={form.specialization} onChange={e => setForm(f => ({...f,specialization:e.target.value}))}>
                    {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Status</label>
                  <select className="input-field" value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Business unit</label>
                  <select className="input-field" value={form.business_unit_id} onChange={e => setForm(f => ({...f,business_unit_id:e.target.value}))}>
                    <option value="">Not assigned</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-xs text-gray-400 p-2 rounded" style={{ background:"#F8F9FB" }}>
                {ROLE_DESC[form.role] ?? ""}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop:"1px solid #E5E7EB" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Saving…":"Save changes"}</button>
            </div>
          </form>

          {/* Password section */}
          <div className="mt-4 pt-4" style={{ borderTop:"1px solid #E5E7EB" }}>
            <p className="text-xs font-semibold text-gray-700 mb-3">Password management</p>

            {pwResult && (
              <div className="mb-3 p-3 rounded-lg text-xs" style={pwResult.ok ? {background:"#EAF3DE",color:"#085041"} : {background:"#FCEBEB",color:"#791F1F"}}>
                {pwResult.msg}
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                className="btn btn-secondary text-xs gap-1.5 flex-1"
                onClick={handleSendReset}
                disabled={resetting}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Send reset email
              </button>
              <button
                className="btn btn-secondary text-xs gap-1.5 flex-1"
                onClick={() => setShowPwField(s => !s)}
              >
                <Key className="w-3.5 h-3.5" />
                Set new password
              </button>
            </div>

            {showPwField && (
              <div className="space-y-2">
                <div style={{ position:"relative" }}>
                  <input
                    className="input-field"
                    style={{ paddingRight:36 }}
                    type={showPw?"text":"password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    autoComplete="new-password"
                  />
                  <button type="button" style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#9CA3AF" }} onClick={() => setShowPw(s => !s)}>
                    {showPw ? <EyeOff style={{width:14,height:14}} /> : <Eye style={{width:14,height:14}} />}
                  </button>
                </div>
                <button
                  className="btn btn-primary w-full text-xs"
                  onClick={handleResetPassword}
                  disabled={resetting || newPassword.length < 8}
                >
                  {resetting ? "Updating…" : "Update password"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const fetchAll = useCallback(async () => {
    const [ur, bur] = await Promise.all([
      supabase.from("users").select("id, name, email, role, status, specialization, business_unit_id").order("name"),
      supabase.from("business_units").select("id, name, slug").order("name"),
    ]);
    setUsers((ur.data as AdminUser[]) ?? []);
    setUnits((bur.data as BusinessUnit[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!search || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (!roleFilter || u.role === roleFilter);
  });

  const unitName = (id?: string) => units.find(u => u.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Users — {users.filter(u => u.status === "Active").length} active of {users.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Manage access, roles, passwords and business unit assignments</p>
        </div>
        <button className="btn btn-primary gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Add user
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input className="input-field pl-8" style={{ width:220 }} placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ width:180 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || roleFilter) && <button className="btn btn-ghost text-xs" onClick={() => { setSearch(""); setRoleFilter(""); }}>Clear</button>}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Name","Email","Role","Unit","Specialization","Status",""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background:"#EEF4FD",color:"#1A348C" }}>
                          {u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)}
                        </div>
                        <span className="font-medium text-gray-900 whitespace-nowrap">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{unitName(u.business_unit_id)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.specialization ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={u.status === "Active" ? {background:"#EAF3DE",color:"#27500A"} : {background:"#FCEBEB",color:"#791F1F"}}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="btn btn-ghost p-1 text-gray-400 hover:text-gray-700" onClick={() => setEditingUser(u)} title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateUserModal units={units} onClose={() => setShowCreate(false)} onCreated={fetchAll} />}
      {editingUser && <EditUserModal user={editingUser} units={units} onClose={() => setEditingUser(null)} onSaved={fetchAll} />}
    </div>
  );
}
