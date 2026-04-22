"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getClients, deleteClient, type SalesClient } from "@/lib/sales-api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ClientSegment } from "@/types";
import { Search, ChevronRight, Trash2 } from "lucide-react";

interface SalesClientsProps {
  segment: ClientSegment;
  onViewClient: (clientId: string) => void;
}

const PAGE_SIZE = 20;

function getInitials(name: string): string {
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatCurrency(val: number): string {
  return `R ${val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SalesClients({
  segment,
  onViewClient,
}: SalesClientsProps) {
  const { user } = useAuth();
  const canDelete = user?.role === "Admin" || user?.role === "Manager";
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<ClientSegment | "">(segment);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function handleDelete(e: React.MouseEvent, client: SalesClient) {
    e.stopPropagation();
    if (!window.confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      setClients(prev => prev.filter(c => c.id !== client.id));
    } catch { /* silent */ }
    setDeletingId(null);
  }

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients({
        segment: segmentFilter || undefined,
        search: search || undefined,
      });
      setClients(data);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError("Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [segmentFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchClients, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  const totalPages = Math.ceil(clients.length / PAGE_SIZE);
  const paginated = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="input-field pl-8"
            style={{ width: 240 }}
            placeholder="Search name, email, ID number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          style={{ width: 150 }}
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value as ClientSegment | "")}
        >
          <option value="">All segments</option>
          <option value="Individual">Individual</option>
          <option value="Commercial">Commercial</option>
        </select>
        {(search || segmentFilter !== segment) && (
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              setSearch("");
              setSegmentFilter(segment);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {error ? (
        <div className="card text-center py-10">
          <p className="text-sm text-red-500">{error}</p>
          <button className="btn btn-secondary mt-3" onClick={fetchClients}>Retry</button>
        </div>
      ) : loading ? (
        <div className="card space-y-3 py-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-400">No clients match your search.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">ID number</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Segment</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Joined</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Policies</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((client) => {
                const policyCount = client.policy_ids?.length ?? 0;
                const joinDate = client.join_date
                  ? new Date(client.join_date).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onViewClient(client.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-semibold text-brand-800 flex-shrink-0">
                          {getInitials(client.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 leading-tight">
                            {client.name.trim()}
                          </p>
                          <p className="text-xs text-gray-400 leading-tight mt-0.5">
                            {client.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {client.id_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{joinDate}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 font-medium">
                        {policyCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {canDelete && (
                          <button
                            onClick={(e) => handleDelete(e, client)}
                            disabled={deletingId === client.id}
                            className="btn btn-ghost p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            title="Delete client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
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
            {Math.min(page * PAGE_SIZE, clients.length)} of {clients.length}
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
    </div>
  );
}
