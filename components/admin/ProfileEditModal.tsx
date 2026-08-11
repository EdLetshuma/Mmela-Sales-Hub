"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

export default function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true); setError(null); setSaved(null);
    try {
      await supabase.from("users").update({ name: name.trim(), phone: phone.trim() || null }).eq("id", user.id);

      if (email.trim() && email.trim() !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailErr) throw emailErr;
        setSaved(`Saved. A confirmation link was sent to ${email.trim()} — your login email updates once you confirm it.`);
      } else {
        setSaved("Profile updated.");
      }

      await refreshUser();
      setTimeout(() => setSaved(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
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
      setNewPw(""); setConfirmPw("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Edit profile</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }} className="space-y-6">
          {/* Profile fields */}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            {saved && <div className="p-3 rounded-lg text-xs" style={{ background: "#EAF3DE", color: "#085041" }}>{saved}</div>}
            {error && <div className="p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{error}</div>}

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full name</label>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone number</label>
              <input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 082 123 4567" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email address</label>
              <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <p className="text-[11px] text-gray-400 mt-1">Changing this sends a confirmation link to the new address before it takes effect.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>

          <div style={{ borderTop: "1px solid #E5E7EB" }} />

          {/* Password */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Change password</h3>
            {pwSaved && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#EAF3DE", color: "#085041" }}>Password updated successfully.</div>}
            {pwError && <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#FCEBEB", color: "#791F1F" }}>{pwError}</div>}
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
                <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? "Updating…" : "Update password"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
