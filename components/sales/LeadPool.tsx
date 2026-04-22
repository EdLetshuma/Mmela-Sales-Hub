"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getLeads, getSalesUsers, assignLead, type SalesLead, type SalesUser } from "@/lib/sales-api";
import { notifyLeadAssigned } from "@/lib/email-api";
import type { ClientSegment } from "@/types";

interface LeadPoolProps {
  segment: ClientSegment;
}

export default function LeadPool({ segment }: LeadPoolProps) {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [agentId, setAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [l, u] = await Promise.all([
        getLeads({ segment, assigned: "unassigned", status: "Prospect" }),
        getSalesUsers(),
      ]);
      setLeads(l);
      setUsers(u.filter((u) => ["Sales Agent", "Team Leader"].includes(u.role)));
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? leads.map((l) => l.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
  }

  async function handleAssign() {
    if (!selected.length || !agentId) return;
    setAssigning(true);
    try {
      await Promise.all(selected.map((id) => assignLead(id, agentId)));
      // Notify assigned agent
      const agent = users.find((u) => u.id === agentId);
      if (agent?.email) {
        const assignedLeads = leads.filter((l) => selected.includes(l.id));
        await Promise.all(
          assignedLeads.map((lead) =>
            notifyLeadAssigned({
              agentEmail: agent.email!,
              agentName: agent.name,
              leadName: lead.name,
              source: lead.source ?? undefined,
            })
          )
        );
      }
      setSelected([]);
      setAgentId("");
      await fetchLeads();
    } finally {
      setAssigning(false);
    }
  }

  const isPlaceholder = (email: string) => email.includes("@placeholder.com");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lead pool</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign unassigned prospects to your sales agents.
        </p>
      </div>

      {/* Assignment bar */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-3">
        <p className="text-sm font-medium text-gray-700">
          {selected.length} lead{selected.length !== 1 ? "s" : ""} selected
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            className="input-field flex-1 sm:w-48"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">Select agent…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={!selected.length || !agentId || assigning}
            onClick={handleAssign}
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card space-y-3 py-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm font-medium text-gray-500">All clear — no unassigned leads in the pool.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selected.length === leads.length && leads.length > 0}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                {["Name", "Contact", "Source", "Date added"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selected.includes(lead.id)}
                      onChange={(e) => toggleOne(lead.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <p className="text-xs text-gray-400">{lead.segment}</p>
                  </td>
                  <td className="px-4 py-3">
                    {!isPlaceholder(lead.email) && (
                      <p className="text-xs text-gray-600">{lead.email}</p>
                    )}
                    {lead.phone && <p className="text-xs text-gray-500">{lead.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
