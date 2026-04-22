"use client";

import React, { useEffect, useState } from "react";
import { getPolicies, getLeads, getClients, type SalesPolicy, type SalesClient, type SalesLead } from "@/lib/sales-api";
import type { ClientSegment } from "@/types";
import { AlertTriangle, Users } from "lucide-react";

interface SalesAlertsProps {
  segment: ClientSegment;
  onNavigate: (path: string) => void;
  onViewClient: (clientId: string) => void;
}

export default function SalesAlerts({ segment, onNavigate, onViewClient }: SalesAlertsProps) {
  const [policies, setPolicies] = useState<SalesPolicy[]>([]);
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [referrals, setReferrals] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPolicies({ segment, documentation_status: "Pending" }),
      getClients({ segment }),
      getLeads({ segment, source: "Referral", assigned: "unassigned" }),
    ])
      .then(([p, c, r]) => { setPolicies(p); setClients(c); setReferrals(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [segment]);

  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name ?? "Unknown client";

  if (loading) return (
    <div className="space-y-4">
      <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="card h-40 animate-pulse bg-gray-50" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">Items that require your attention.</p>
      </div>

      {/* Pending documentation */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Pending policy documentation ({policies.length})
          </h2>
        </div>
        {policies.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-gray-500">All clear — no pending documentation.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {policies.map((policy) => (
              <li key={policy.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{clientName(policy.client_id)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Upload document for policy <span className="font-medium text-gray-600">{policy.policy_number}</span>
                  </p>
                </div>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => { if (policy.client_id) onViewClient(policy.client_id); }}
                >
                  View client
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Unassigned referrals */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <Users className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            Unassigned referrals ({referrals.length})
          </h2>
        </div>
        {referrals.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-gray-500">All referrals are assigned.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {referrals.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">This referral needs to be assigned to a sales agent.</p>
                </div>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => onNavigate("/sales/leads/pool")}
                >
                  Assign lead
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
