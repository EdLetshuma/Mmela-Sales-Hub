"use client";

import React, { useEffect, useState } from "react";
import { getPremiumAnalytics, type PremiumData, type ProductRow } from "@/lib/sales-performance-api";
import { formatCurrency } from "@/components/executive/leads/shared";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function PremiumTable({ title, rows }: { title: string; rows: ProductRow[] }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No data.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right">Policies</th>
                <th className="pb-2 font-medium text-right">Premium</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right">{r.policies}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(r.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PremiumTab() {
  const [data, setData] = useState<PremiumData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPremiumAnalytics()
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load premium analytics."); });
  }, []);

  if (!data && !error) return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />;
  if (error || !data) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Premium trend</h3>
        <p className="text-xs text-gray-400 mb-4">Premium sold per month, last 6 months</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={data.trend}>
              <defs>
                <linearGradient id="premiumTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F6E56" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0F6E56" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="premium" stroke="#0F6E56" fill="url(#premiumTrend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <PremiumTable title="By client segment" rows={data.bySegment} />
      <PremiumTable title="By agent" rows={data.byAgent} />
    </div>
  );
}
