"use client";

import React from "react";
import { X, Pencil } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ProfileViewModal({
  onClose,
  onEdit,
}: {
  onClose: () => void;
  onEdit: () => void;
}) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">My profile</h2>
          <button className="btn btn-ghost p-1" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-sm font-semibold text-brand-800 flex-shrink-0">
            {user.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm" style={{ borderTop: "1px solid #F1F3F5", paddingTop: 12 }}>
          <div className="flex gap-4">
            <span className="text-gray-400 w-20 flex-shrink-0 text-xs">Email</span>
            <span className="text-gray-700 text-xs">{user.email}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-400 w-20 flex-shrink-0 text-xs">Phone</span>
            <span className="text-gray-700 text-xs">{user.phone || "—"}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-400 w-20 flex-shrink-0 text-xs">Specialization</span>
            <span className="text-gray-700 text-xs">{user.specialization ?? "—"}</span>
          </div>
        </div>

        <button className="btn btn-primary w-full text-xs gap-1.5 mt-5" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" /> Edit profile
        </button>
      </div>
    </div>
  );
}
