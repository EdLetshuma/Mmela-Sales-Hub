"use client";

import React, { useEffect, useState } from "react";
import { getProductPerformance, type ProductRow } from "@/lib/sales-performance-api";
import type { ExecutiveRange } from "@/lib/sales-api";
import { RangeSelect, formatCurrency } from "@/components/executive/leads/shared";

function ProductTable({ title, rows }: { title: string; rows: ProductRow[] }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No data for this period.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right">Policies</th>
                <th className="pb-2 font-medium text-right">Premium</th>
                <th className="pb-2 font-medium text-right">Avg. premium</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right">{r.policies}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(r.premium)}</td>
                  <td className="py-2 text-right">{formatCurrency(r.averagePremium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductsTab() {
  const [range, setRange] = useState<ExecutiveRange>("30d");
  const [data, setData] = useState<{ byProduct: ProductRow[]; byCategory: ProductRow[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefreshing(true);
    setError(null);
    getProductPerformance(range)
      .then(setData)
      .catch((err) => { console.error(err); setError("Failed to load product performance."); })
      .finally(() => setRefreshing(false));
  }, [range]);

  if (!data && !error) return <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />;
  if (error || !data) return <div className="card text-center py-12"><p className="text-sm text-red-500">{error ?? "No data available."}</p></div>;

  return (
    <div className="space-y-6" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 150ms ease" }} aria-busy={refreshing}>
      <RangeSelect range={range} setRange={setRange} refreshing={refreshing} />
      <p className="text-xs text-gray-400">Policies sold within the selected period, grouped by product and category.</p>
      <ProductTable title="By product" rows={data.byProduct} />
      <ProductTable title="By category" rows={data.byCategory} />
    </div>
  );
}
