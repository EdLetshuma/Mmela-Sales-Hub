"use client";

import React, { useEffect, useState } from "react";
import {
  getClient,
  getPolicies,
  updateClient,
  getSalesUsers,
  type SalesClient,
  type SalesPolicy,
  type SalesUser,
} from "@/lib/sales-api";
import { ArrowLeft } from "lucide-react";

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

function getInitials(name: string): string {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatCurrency(val?: number | string | null): string {
  const n = Number(val ?? 0);
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-900 break-words">{value}</span>
    </div>
  );
}

function PolicyStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Active: { bg: "#EAF3DE", color: "#27500A" },
    Pending: { bg: "#FAEEDA", color: "#633806" },
    Canceled: { bg: "#FCEBEB", color: "#791F1F" },
    Expired: { bg: "#FCEBEB", color: "#791F1F" },
    Retained: { bg: "#E1F5EE", color: "#085041" },
  };
  const style = map[status ?? ""] ?? { bg: "#F1F3F5", color: "#6B7280" };
  return (
    <span className="badge" style={{ background: style.bg, color: style.color }}>
      {status ?? "Unknown"}
    </span>
  );
}

export default function ClientDetail({
  clientId,
  onBack,
  onNavigate,
}: ClientDetailProps) {
  const [client, setClient] = useState<SalesClient | null>(null);
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SalesClient>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getClient(clientId),
      getPolicies({ clientId }),
      getSalesUsers(),
    ])
      .then(([clientData, policyData, usersData]) => {
        setClient(clientData);
        setPolicies(policyData);
        setUsers(usersData);
      })
      .catch(() => setError("Failed to load client."))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleSave() {
    if (!client) return;
    setSaving(true);
    try {
      const updated = await updateClient(client.id, editForm);
      setClient(updated);
      setEditing(false);
      setEditForm({});
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="card h-48 animate-pulse bg-gray-50" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-red-500">{error ?? "Client not found."}</p>
        <button className="btn btn-secondary mt-3" onClick={onBack}>Go back</button>
      </div>
    );
  }

  const activePolicies = policies.filter((p) => p.status === "Active");
  const totalPremium = activePolicies.reduce(
    (sum, p) => sum + Number(p.premium ?? 0), 0
  );
  const soldByName = (id?: string | null) =>
    users.find((u) => u.id === id)?.name ?? null;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button className="btn btn-ghost text-sm gap-1.5 -ml-1" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back to clients
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-base font-semibold text-brand-800 flex-shrink-0">
              {getInitials(client.name)}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">
                {client.name.trim()}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
              {client.phone && (
                <p className="text-sm text-gray-500">{client.phone}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <span
              className="badge"
              style={
                client.segment === "Commercial"
                  ? { background: "#FAEEDA", color: "#633806" }
                  : { background: "#EEF4FD", color: "#1A348C" }
              }
            >
              {client.segment ?? "Individual"}
            </span>
            {!editing && (
              <button
                className="btn btn-secondary text-xs"
                onClick={() => {
                  setEditForm({
                    name: client.name,
                    email: client.email,
                    phone: client.phone ?? "",
                    address: client.address ?? "",
                    occupation: client.occupation ?? "",
                    id_number: client.id_number ?? "",
                  });
                  setEditing(true);
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Policies</p>
            <p className="text-xl font-semibold text-gray-900">{policies.length}</p>
            <p className="text-xs text-gray-400">{activePolicies.length} active</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Monthly premium</p>
            <p className="text-xl font-semibold text-gray-900">
              {formatCurrency(totalPremium)}
            </p>
            <p className="text-xs text-gray-400">active policies only</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Client since</p>
            <p className="text-xl font-semibold text-gray-900">
              {client.join_date
                ? new Date(client.join_date).toLocaleDateString("en-ZA", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: details or edit */}
        <div className="col-span-2 space-y-4">
          {editing ? (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Edit client</h2>
              {(
                [
                  { key: "name", label: "Full name", type: "text" },
                  { key: "email", label: "Email", type: "email" },
                  { key: "phone", label: "Phone", type: "text" },
                  { key: "id_number", label: "ID number", type: "text" },
                  { key: "address", label: "Address", type: "text" },
                  { key: "occupation", label: "Occupation", type: "text" },
                ] as { key: keyof SalesClient; label: string; type: string }[]
              ).map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input
                    className="input-field"
                    type={type}
                    value={(editForm[key] as string) ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setEditing(false); setEditForm({}); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Details</h2>
              <FieldRow label="ID number" value={client.id_number} />
              <FieldRow label="Title" value={client.title} />
              <FieldRow label="Occupation" value={client.occupation} />
              <FieldRow label="Marital status" value={client.marital_status} />
              <FieldRow label="Address" value={client.address} />
              <FieldRow label="Source" value={client.source} />
              <FieldRow label="Communication" value={client.communication_preference} />
            </div>
          )}

          {/* Policies */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Policies</h2>
              <button
                className="btn btn-primary text-xs"
                onClick={() => onNavigate("/sales/policies")}
              >
                + New policy
              </button>
            </div>

            {policies.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No policies on record.</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Policy #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Insurer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Premium</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Docs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {policies.map((policy) => (
                    <tr
                      key={policy.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onNavigate(`/sales/policies?id=${policy.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-brand-800 font-medium">
                        {policy.policy_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{policy.product_name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{policy.product_category ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{policy.insurer ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(policy.premium)}
                      </td>
                      <td className="px-4 py-3">
                        <PolicyStatusBadge status={policy.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="badge"
                          style={
                            policy.documentation_status === "Complete"
                              ? { background: "#EAF3DE", color: "#27500A" }
                              : { background: "#FAEEDA", color: "#633806" }
                          }
                        >
                          {policy.documentation_status ?? "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-brand-700 font-medium">View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Contact</h2>
            <FieldRow label="Email" value={client.email} />
            <FieldRow label="Phone" value={client.phone} />
            <FieldRow label="Address" value={client.address} />
          </div>

          {client.notes && Array.isArray(client.notes) && client.notes.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
              <div className="space-y-2">
                {(client.notes as Array<{ text?: string; timestamp?: string }>).map(
                  (note, i) => (
                    <div key={i} className="text-sm text-gray-700 border-b border-gray-100 pb-2 last:border-0">
                      <p className="leading-relaxed">{note.text ?? String(note)}</p>
                      {note.timestamp && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(note.timestamp).toLocaleDateString("en-ZA")}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
