"use client";

import React, { useState, useEffect } from "react";
import {
  getCampaignLeads,
  getCampaigns,
  getBusinessUnits,
  getActiveUsers,
  assignLead,
  bulkAssignLeads,
} from "@/lib/campaigns-api";
import type { Lead, Campaign, BusinessUnit } from "@/types";
import {
  Search,
  Filter,
  UserPlus,
  Check,
  X,
  ChevronDown,
  Users,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
} from "lucide-react";

export default function LeadInbox() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterAssigned, setFilterAssigned] = useState<"" | "assigned" | "unassigned">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState<string | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterUnit, filterCampaign, filterAssigned, filterStatus]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadData, campaignData, unitData, userData] = await Promise.all([
        getCampaignLeads({
          business_unit_id: filterUnit || undefined,
          campaign_id: filterCampaign || undefined,
          assigned: (filterAssigned as "assigned" | "unassigned") || undefined,
          status: filterStatus || undefined,
        }),
        getCampaigns(),
        getBusinessUnits(),
        getActiveUsers(),
      ]);
      setLeads(leadData);
      setCampaigns(campaignData);
      setUnits(unitData);
      setUsers(userData);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q)
    );
  });

  const handleAssign = async (leadId: string, userId: string) => {
    try {
      await assignLead(leadId, userId);
      setShowAssignDropdown(null);
      await loadData();
    } catch (err) {
      console.error("Failed to assign lead:", err);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    try {
      await bulkAssignLeads(Array.from(selectedLeads), userId);
      setSelectedLeads(new Set());
      setShowBulkAssign(false);
      await loadData();
    } catch (err) {
      console.error("Failed to bulk assign:", err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filtered.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filtered.map((l) => l.id)));
    }
  };

  const getUnitName = (id?: string) => units.find((u) => u.id === id)?.name || "—";
  const getCampaignName = (id?: string) => campaigns.find((c) => c.id === id)?.name || "—";
  const getUserName = (id?: string) => users.find((u) => u.id === id)?.name || "Unassigned";

  const statusOptions = ["Prospect", "Contacted", "Quoted", "Won", "Lost"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lead inbox</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} leads
            {filterAssigned === "unassigned" ? " · unassigned" : ""}
            {filterUnit ? ` · ${getUnitName(filterUnit)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {selectedLeads.size} selected
            </span>
            <div className="relative">
              <button
                onClick={() => setShowBulkAssign(!showBulkAssign)}
                className="btn btn-primary"
              >
                <UserPlus className="w-4 h-4" />
                Assign to
              </button>
              {showBulkAssign && (
                <UserDropdown
                  users={users}
                  onSelect={handleBulkAssign}
                  onClose={() => setShowBulkAssign(false)}
                />
              )}
            </div>
            <button
              onClick={() => setSelectedLeads(new Set())}
              className="btn btn-ghost"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterAssigned}
          onChange={(e) => setFilterAssigned(e.target.value as any)}
          className="input-field w-auto"
        >
          <option value="">All leads</option>
          <option value="unassigned">Unassigned only</option>
          <option value="assigned">Assigned only</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Lead table */}
      {isLoading ? (
        <div className="card animate-pulse space-y-4 py-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-40 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No leads found</p>
          <p className="text-xs text-gray-400 mt-1">
            {leads.length === 0
              ? "Leads will appear here once forms start receiving submissions"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="card p-0" style={{ overflow: "visible" }}>
          <div className="table-scroll" style={{ borderRadius: 12 }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Name</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Contact</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Source</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Status</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Assigned to</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const isSelected = selectedLeads.has(lead.id);
                const initials = lead.name
                  ? lead.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "?";

                const statusClass =
                  lead.status === "Quoted" ? "badge-quoted"
                  : lead.status === "Contacted" ? "badge-contacted"
                  : lead.status === "Won" ? "badge-won"
                  : lead.status === "Lost" ? "badge-lost"
                  : "badge-prospect";

                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      isSelected ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-medium text-brand-800 flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-gray-900">{lead.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-500">
                        {getCampaignName(lead.campaign_id)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {getUnitName(lead.business_unit_id)}
                        {lead.source_type ? ` · ${lead.source_type}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${statusClass}`}>
                        {lead.status || "Prospect"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowAssignDropdown(
                              showAssignDropdown === lead.id ? null : lead.id
                            )
                          }
                          className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                            lead.assigned_to_user_id
                              ? "text-gray-700 hover:bg-gray-100"
                              : "text-brand-700 bg-brand-50 hover:bg-brand-100"
                          }`}
                        >
                          {lead.assigned_to_user_id
                            ? getUserName(lead.assigned_to_user_id)
                            : "+ Assign"}
                        </button>
                        {showAssignDropdown === lead.id && (
                          <UserDropdown
                            users={users}
                            onSelect={(userId) => handleAssign(lead.id, userId)}
                            onClose={() => setShowAssignDropdown(null)}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString("en-ZA")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDropdown({
  users,
  onSelect,
  onClose,
}: {
  users: { id: string; name: string; role: string }[];
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-40 max-h-64 overflow-y-auto">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
          >
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
              {u.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-gray-400">{u.role}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
