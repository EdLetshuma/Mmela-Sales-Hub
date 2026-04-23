"use client";

import React, { useState, useEffect } from "react";
import {
  getRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  getBusinessUnits,
  getCampaigns,
  getActiveUsers,
} from "@/lib/campaigns-api";
import type { RoutingRule, BusinessUnit, Campaign } from "@/types";
import { RoutingMethod } from "@/types";
import { Plus, X, Settings, Trash2, Power, PowerOff } from "lucide-react";

export default function RoutingRules() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [r, u, c, us] = await Promise.all([
        getRoutingRules(), getBusinessUnits(), getCampaigns(), getActiveUsers(),
      ]);
      setRules(r); setUnits(u); setCampaigns(c); setUsers(us);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const getName = (list: { id: string; name: string }[], id?: string) =>
    list.find((i) => i.id === id)?.name || "—";

  const handleToggle = async (rule: RoutingRule) => {
    await updateRoutingRule(rule.id, { is_active: !rule.is_active });
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Routing rules</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-assign incoming leads to agents</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New rule
        </button>
      </div>

      {isLoading ? (
        <div className="card animate-pulse h-48" />
      ) : rules.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Settings className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No routing rules yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Leads will need to be assigned manually until you create rules</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary text-sm">
            <Plus className="w-4 h-4" /> Create rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="card flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">
                    {getName(units, rule.business_unit_id)}
                  </span>
                  {rule.campaign_id && (
                    <span className="badge bg-gray-100 text-gray-600">
                      {getName(campaigns as any, rule.campaign_id)}
                    </span>
                  )}
                  <span className={`badge ${rule.is_active ? "badge-contacted" : "bg-gray-100 text-gray-500"}`}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Method: <span className="font-medium">{rule.method.replace("_", " ")}</span>
                  {" · "}
                  {rule.assigned_user_ids.length} agent{rule.assigned_user_ids.length !== 1 ? "s" : ""}
                  {": "}
                  {rule.assigned_user_ids.map((id) => getName(users, id)).join(", ")}
                </p>
              </div>
              <button onClick={() => handleToggle(rule)} className="btn btn-ghost px-2">
                {rule.is_active ? <Power className="w-5 h-5 text-green-600" /> : <PowerOff className="w-5 h-5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRuleModal
          units={units} campaigns={campaigns} users={users}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </div>
  );
}

function CreateRuleModal({ units, campaigns, users, onClose, onSaved }: {
  units: BusinessUnit[]; campaigns: Campaign[];
  users: { id: string; name: string; role: string }[];
  onClose: () => void; onSaved: () => void;
}) {
  const [unitId, setUnitId] = useState(units[0]?.id || "");
  const [campaignId, setCampaignId] = useState("");
  const [method, setMethod] = useState<RoutingMethod>(RoutingMethod.RoundRobin);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId || selectedUsers.size === 0) return;
    setIsSaving(true);
    try {
      await createRoutingRule({
        business_unit_id: unitId,
        campaign_id: campaignId || undefined,
        method,
        assigned_user_ids: Array.from(selectedUsers),
        is_active: true,
      } as any);
      onSaved();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const filteredCampaigns = campaigns.filter((c) => c.business_unit_id === unitId && c.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New routing rule</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business unit</label>
            <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setCampaignId(""); }} className="input-field">
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign (optional — leave blank for all)</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-field">
              <option value="">All campaigns in this unit</option>
              {filteredCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Routing method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as RoutingMethod)} className="input-field">
              <option value="round_robin">Round robin — distribute evenly</option>
              <option value="specific_user">Specific user — always assign to one person</option>
              <option value="manual">Manual — no auto-assignment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Assign to ({selectedUsers.size} selected)
            </label>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleUser(u.id)} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{u.name}</span>
                  <span className="text-xs text-gray-400">{u.role}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSaving || selectedUsers.size === 0} className="btn btn-primary flex-1 disabled:opacity-50">
              {isSaving ? "Saving..." : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
