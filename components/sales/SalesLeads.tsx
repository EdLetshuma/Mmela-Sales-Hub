"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getLeads,
  getSalesUsers,
  assignLead,
  type SalesLead,
  type SalesUser,
} from "@/lib/sales-api";
import type { ClientSegment } from "@/types";
import { Search, ChevronRight } from "lucide-react";

interface SalesLeadsProps {
  segment: ClientSegment;
  onNavigate: (path: string) => void;
  onViewLead: (leadId: string) => void;
}

const STATUSES = ["Prospect", "Contacted", "Quoted", "Won", "Lost"];
const SOURCES = [
  "Campaign", "DS RT58", "Incoming Call", "Manual",
  "Other", "Rand Show", "Referral", "Website",
];
const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Prospect: "badge-prospect",
    Contacted: "badge-contacted",
    Quoted: "badge-quoted",
    Won: "badge-won",
    Lost: "badge-lost",
    "Retention Failure": "badge-lost",
  };
  return (
    <span className={`badge ${map[status] ?? "badge-prospect"}`}>{status}</span>
  );
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function isPlaceholderEmail(email: string): boolean {
  return email.includes("@placeholder.com");
}

export default function SalesLeads({
  segment,
  onNavigate,
  onViewLead,
}: SalesLeadsProps) {
  const { user } = useAuth();

  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Assignment modal
  const [assigningLead, setAssigningLead] = useState<SalesLead | null>(null);
  const [assigningTo, setAssigningTo] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeads({
        segment,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        assigned:
          assignedFilter === "mine"
            ? "mine"
            : assignedFilter === "unassigned"
            ? "unassigned"
            : undefined,
        userId: user?.id,
      });
      setLeads(data);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [segment, statusFilter, sourceFilter, assignedFilter, user?.id]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    getSalesUsers().then(setUsers).catch(console.error);
  }, []);

  // Client-side search filter
  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (!isPlaceholderEmail(l.email) && l.email.toLowerCase().includes(q)) ||
      (l.phone ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleAssign() {
    if (!assigningLead || !assigningTo) return;
    setAssignLoading(true);
    try {
      await assignLead(assigningLead.id, assigningTo);
      await fetchLeads();
      setAssigningLead(null);
      setAssigningTo("");
    } catch (err) {
      console.error(err);
    } finally {
      setAssignLoading(false);
    }
  }

  const agentName = (id?: string) => {
    if (!id) return null;
    return users.find((u) => u.id === id)?.name ?? null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} of {leads.length} leads
            {leads.filter((l) => !l.assigned_to_user_id).length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {leads.filter((l) => !l.assigned_to_user_id).length} unassigned
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="input-field pl-8"
            style={{ width: 220 }}
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="input-field"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="input-field"
          style={{ width: 150 }}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="input-field"
          style={{ width: 150 }}
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
        >
          <option value="">All leads</option>
          <option value="mine">My leads</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
        </select>

        {(search || statusFilter || sourceFilter || assignedFilter) && (
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setSourceFilter("");
              setAssignedFilter("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {error ? (
        <div className="card text-center py-10">
          <p className="text-sm text-red-500">{error}</p>
          <button className="btn btn-secondary mt-3" onClick={fetchLeads}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="card space-y-3 py-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-400">No leads match your filters.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Source</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Assigned to</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((lead) => {
                const agent = agentName(lead.assigned_to_user_id ?? undefined);
                const displayEmail = isPlaceholderEmail(lead.email)
                  ? null
                  : lead.email;
                const addedDate = lead.created_at
                  ? new Date(lead.created_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onViewLead(lead.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                          {getInitials(lead.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 leading-tight">
                            {lead.name}
                          </p>
                          {displayEmail && (
                            <p className="text-xs text-gray-400 leading-tight mt-0.5">
                              {displayEmail}
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-xs text-gray-400 leading-tight mt-0.5">
                              {lead.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status ?? "Prospect"} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {lead.source ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {agent ? (
                        <span className="text-gray-700">{agent}</span>
                      ) : (
                        <button
                          className="text-xs text-brand-700 font-medium hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningLead(lead);
                          }}
                        >
                          Assign
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {addedDate}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assigningLead && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setAssigningLead(null)}
        >
          <div
            className="card"
            style={{ width: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Assign lead
            </h3>
            <p className="text-xs text-gray-500 mb-4">{assigningLead.name}</p>
            <select
              className="input-field mb-4"
              value={assigningTo}
              onChange={(e) => setAssigningTo(e.target.value)}
            >
              <option value="">Select agent…</option>
              {users
                .filter((u) =>
                  ["Sales Agent", "Team Leader", "Manager"].includes(u.role)
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setAssigningLead(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!assigningTo || assignLoading}
                onClick={handleAssign}
              >
                {assignLoading ? "Saving…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
