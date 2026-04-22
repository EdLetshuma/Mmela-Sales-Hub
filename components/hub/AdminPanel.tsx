"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getSystemSettings, clearSettingsCache, type SystemSettings } from "@/lib/settings-api";
import { Plus, Trash2, X, Search, Edit2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  specialization: string;
  permissions: string[] | null;
}

const ALL_ROLES = [
  "Admin", "Manager", "Team Leader", "Sales Agent",
  "Lead Admin", "Policy Admin", "Call Centre Assistance Supervisor",
  "Marketing Admin", "Concierge Agent", "Credit Health Agent",
];

const ALL_SPECIALIZATIONS = ["Individual", "Commercial", "Both"];
const ALL_STATUSES = ["Active", "Inactive"];

type AdminTab = "users" | "settings";

// ── Role badge ───────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Admin:           { bg: "#EEF4FD", color: "#1A348C" },
    Manager:         { bg: "#E1F5EE", color: "#085041" },
    "Team Leader":   { bg: "#FAEEDA", color: "#633806" },
    "Sales Agent":   { bg: "#F1EFE8", color: "#444441" },
    "Lead Admin":    { bg: "#E6F1FB", color: "#0C447C" },
    "Policy Admin":  { bg: "#FAEEDA", color: "#633806" },
    "Marketing Admin": { bg: "#EAF3DE", color: "#27500A" },
    "Concierge Agent":    { bg: "#FAEEDA", color: "#633806" },
    "Credit Health Agent": { bg: "#E1F5EE", color: "#085041" },
  };
  const s = map[role] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
      {role}
    </span>
  );
}

// ── User modal ───────────────────────────────────────────────

interface UserModalProps {
  user?: AdminUser;
  onClose: () => void;
  onSave: (data: Partial<AdminUser> & { password?: string }) => Promise<void>;
}

function UserModal({ user, onClose, onSave }: UserModalProps) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "Sales Agent",
    status: user?.status ?? "Active",
    specialization: user?.specialization ?? "Individual",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? `Edit — ${user.name}` : "Add new user"}
          </h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input className="input-field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password</label>
              <input className="input-field" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!isEdit} placeholder="Min 8 characters" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Role</label>
              <select className="input-field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
              <select className="input-field" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}>
                {ALL_SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <select className="input-field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Settings editor ──────────────────────────────────────────

function SettingsEditor({ settings, onSaved }: { settings: SystemSettings; onSaved: () => void }) {
  const [underwriters, setUnderwriters] = useState<string[]>(settings.underwriters);
  const [newUW, setNewUW] = useState("");
  const [productCatalog, setProductCatalog] = useState<Record<string, string[]>>(
    JSON.parse(JSON.stringify(settings.productCatalog))
  );
  const [newCategory, setNewCategory] = useState("");
  const [newProduct, setNewProduct] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addUnderwriter() {
    const v = newUW.trim();
    if (!v || underwriters.includes(v)) return;
    setUnderwriters([...underwriters, v].sort());
    setNewUW("");
  }

  function removeUnderwriter(uw: string) {
    setUnderwriters(underwriters.filter((u) => u !== uw));
  }

  function addCategory() {
    const v = newCategory.trim();
    if (!v || productCatalog[v]) return;
    setProductCatalog({ ...productCatalog, [v]: [] });
    setNewCategory("");
  }

  function removeCategory(cat: string) {
    const updated = { ...productCatalog };
    delete updated[cat];
    setProductCatalog(updated);
  }

  function addProduct(cat: string) {
    const v = (newProduct[cat] ?? "").trim();
    if (!v || productCatalog[cat]?.includes(v)) return;
    setProductCatalog({ ...productCatalog, [cat]: [...(productCatalog[cat] ?? []), v] });
    setNewProduct({ ...newProduct, [cat]: "" });
  }

  function removeProduct(cat: string, product: string) {
    setProductCatalog({ ...productCatalog, [cat]: productCatalog[cat].filter((p) => p !== product) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const current = await supabase.from("system_settings").select("settings_data").eq("id", 1).single();
      const existing = (current.data?.settings_data ?? {}) as Record<string, unknown>;
      await supabase.from("system_settings").upsert({
        id: 1,
        settings_data: { ...existing, underwriters, productCatalog },
      });
      clearSettingsCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "#EAF3DE", color: "#085041" }}>
          Settings saved successfully.
        </div>
      )}

      {/* Underwriters */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Underwriters / Insurers</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {underwriters.map((uw) => (
            <span key={uw} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "#EEF4FD", color: "#1A348C" }}>
              {uw}
              <button onClick={() => removeUnderwriter(uw)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Add underwriter…"
            value={newUW}
            onChange={(e) => setNewUW(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnderwriter(); } }}
          />
          <button className="btn btn-secondary" onClick={addUnderwriter}>Add</button>
        </div>
      </div>

      {/* Product catalog */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Product catalog</h3>
        <div className="space-y-4">
          {Object.entries(productCatalog).map(([cat, products]) => (
            <div key={cat} className="p-3 rounded-lg" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">{cat}</p>
                <button className="text-xs text-red-500 hover:text-red-700" onClick={() => removeCategory(cat)}>
                  Remove category
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {products.map((p) => (
                  <span key={p} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "#fff", border: "1px solid #E5E7EB", color: "#374151" }}>
                    {p}
                    <button onClick={() => removeProduct(cat, p)} className="hover:opacity-70">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1 text-xs"
                  placeholder={`Add product to ${cat}…`}
                  value={newProduct[cat] ?? ""}
                  onChange={(e) => setNewProduct({ ...newProduct, [cat]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(cat); } }}
                />
                <button className="btn btn-secondary text-xs" onClick={() => addProduct(cat)}>Add</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            className="input-field flex-1"
            placeholder="New category name…"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
          />
          <button className="btn btn-secondary" onClick={addCategory}>
            <Plus className="w-4 h-4 mr-1" />
            Add category
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ── Main AdminPanel component ────────────────────────────────

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | undefined>();
  const [showUserModal, setShowUserModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, status, specialization, permissions")
      .order("name");
    setUsers((data as AdminUser[]) ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchUsers(), getSystemSettings().then(setSettings)]);
      setLoading(false);
    }
    init();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  async function handleSaveUser(data: Partial<AdminUser> & { password?: string }) {
    if (editingUser) {
      // Update existing user in users table
      const { password, ...rest } = data;
      await supabase.from("users").update(rest).eq("id", editingUser.id);
    } else {
      // Create auth user then insert profile
      const { data: authData, error: authError } = await supabase.auth.admin
        ? // Use service role if available
          { data: null, error: new Error("Use Supabase dashboard to create auth users") }
        : { data: null, error: new Error("Use Supabase dashboard to create auth users") };

      // For now insert into users table — auth user must be created separately in Supabase dashboard
      await supabase.from("users").insert({
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status ?? "Active",
        specialization: data.specialization ?? "Individual",
      });
    }
    await fetchUsers();
  }

  async function handleDeactivate(user: AdminUser) {
    if (!window.confirm(`Deactivate ${user.name}? They will no longer be able to log in.`)) return;
    await supabase.from("users").update({ status: "Inactive" }).eq("id", user.id);
    await fetchUsers();
  }

  async function handleActivate(user: AdminUser) {
    await supabase.from("users").update({ status: "Active" }).eq("id", user.id);
    await fetchUsers();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="card h-64 animate-pulse bg-gray-50" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Admin panel</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, roles, and system settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {(["users", "settings"] as AdminTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize relative transition-colors ${
              tab === t ? "text-brand-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "users" ? `Users (${users.length})` : "System settings"}
            {tab === t && (
              <span style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 2, background: "#1A348C", borderRadius: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="input-field pl-8"
                style={{ width: 240 }}
                placeholder="Search name, email, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary gap-1.5"
              onClick={() => { setEditingUser(undefined); setShowUserModal(true); }}
            >
              <Plus className="w-4 h-4" />
              Add user
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Name", "Email", "Role", "Specialization", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{user.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{user.specialization ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={
                          user.status === "Active"
                            ? { background: "#EAF3DE", color: "#27500A" }
                            : { background: "#FCEBEB", color: "#791F1F" }
                        }
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="btn btn-ghost p-1 text-gray-400 hover:text-gray-700"
                          title="Edit user"
                          onClick={() => { setEditingUser(user); setShowUserModal(true); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {user.status === "Active" ? (
                          <button
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                            onClick={() => handleDeactivate(user)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                            onClick={() => handleActivate(user)}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            To create a new user's login credentials, use the Supabase dashboard (Authentication → Users), then their profile will appear here automatically.
          </p>
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && settings && (
        <SettingsEditor settings={settings} onSaved={() => getSystemSettings().then(setSettings)} />
      )}

      {/* User modal */}
      {showUserModal && (
        <UserModal
          user={editingUser}
          onClose={() => { setShowUserModal(false); setEditingUser(undefined); }}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
}
