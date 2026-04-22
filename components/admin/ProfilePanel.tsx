"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function ProfilePanel() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSavingName(true);
    try {
      await supabase.from("users").update({ name: name.trim() }).eq("id", user.id);
      await refreshUser();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSavingPw(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-base font-semibold text-brand-800 flex-shrink-0">
          {user.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-500">{user.role}</p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #E5E7EB" }} />

      {/* Edit name */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Display name</h3>
        {nameSaved && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#EAF3DE", color: "#085041" }}>Name updated.</div>
        )}
        <form onSubmit={handleSaveName} className="flex gap-3">
          <input
            className="input-field flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={savingName}>
            {savingName ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      <div style={{ borderTop: "1px solid #E5E7EB" }} />

      {/* Change password */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Change password</h3>
        {pwSaved && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#EAF3DE", color: "#085041" }}>Password updated successfully.</div>
        )}
        {pwError && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{pwError}</div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New password</label>
            <input className="input-field" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirm new password</label>
            <input className="input-field" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={savingPw}>
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ borderTop: "1px solid #E5E7EB" }} />

      {/* Read-only info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-gray-400 w-28 flex-shrink-0">Email</span>
            <span className="text-gray-700">{user.email}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-400 w-28 flex-shrink-0">Role</span>
            <span className="text-gray-700">{user.role}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-400 w-28 flex-shrink-0">Specialization</span>
            <span className="text-gray-700">{user.specialization ?? "—"}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          To change your email or role, contact your administrator.
        </p>
      </div>
    </div>
  );
}
