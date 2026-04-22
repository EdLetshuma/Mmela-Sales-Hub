"use client";

import React, { useEffect, useState } from "react";
import { getConciergeLeads, CONCIERGE_STATUSES, type ConciergeLead } from "@/lib/concierge-api";

export default function ConciergeActivity() {
  const [leads, setLeads] = useState<ConciergeLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConciergeLeads()
      .then((data) => setLeads(data.slice(0, 50)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group by status
  const grouped = CONCIERGE_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.unit_status === s);
    return acc;
  }, {} as Record<string, ConciergeLead[]>);

  const STATUS_COLORS: Record<string, string> = {
    "New": "#235DCB", "Contacted": "#0F6E56", "Sourcing": "#854F0B",
    "Quote Sent": "#1A348C", "Won": "#27500A", "Lost": "#791F1F", "On Hold": "#5F5E5A",
  };

  if (loading) return <div className="card h-40 animate-pulse bg-gray-50" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Activity</h1>
        <p className="text-sm text-gray-500 mt-1">Lead pipeline by status</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {CONCIERGE_STATUSES.filter((s) => grouped[s]?.length > 0).map((status) => (
          <div key={status} className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600">{status}</p>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ background: STATUS_COLORS[status] ?? "#6B7280" }}
              >
                {grouped[status].length}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[status].slice(0, 5).map((lead) => (
                <div key={lead.id} className="p-2 rounded-lg text-xs" style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}>
                  <p className="font-medium text-gray-900 truncate">{lead.name}</p>
                  {(lead.vehicle_make || lead.vehicle_model) && (
                    <p className="text-gray-400 truncate">
                      {[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(" ")}
                    </p>
                  )}
                </div>
              ))}
              {grouped[status].length > 5 && (
                <p className="text-xs text-gray-400 text-center">+{grouped[status].length - 5} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
