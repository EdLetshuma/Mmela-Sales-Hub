"use client";

import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { SalesPolicy } from "@/lib/sales-api";

interface SalesTrendChartProps {
  policies: SalesPolicy[];
  userId?: string;
  year: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatYAxis(value: number) {
  if (value >= 1_000_000) return `R${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R${Math.round(value / 1_000)}k`;
  return `R${value}`;
}

export default function SalesTrendChart({ policies, userId, year }: SalesTrendChartProps) {
  const data = useMemo(() => {
    const relevant = userId
      ? policies.filter((p) => p.sold_by_user_id === userId)
      : policies;

    if (year === "All") {
      const map: Record<string, number> = {};
      const dates = relevant
        .map((p) => p.sale_date ? new Date(p.sale_date) : null)
        .filter(Boolean) as Date[];

      if (dates.length === 0) return [];

      const min = new Date(Math.min(...dates.map((d) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d) => d.getTime())));
      let cur = new Date(min.getFullYear(), min.getMonth(), 1);
      while (cur <= max) {
        const key = `${MONTHS[cur.getMonth()]} '${String(cur.getFullYear()).slice(2)}`;
        map[key] = 0;
        cur.setMonth(cur.getMonth() + 1);
      }

      relevant.forEach((p) => {
        if (p.sale_date) {
          const d = new Date(p.sale_date);
          const key = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
          if (key in map) map[key] += Number(p.premium ?? 0);
        }
      });

      return Object.entries(map).map(([name, Sales]) => ({ name, Sales }));
    } else {
      const y = parseInt(year);
      const map = MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<string, number>);
      relevant.forEach((p) => {
        if (p.sale_date) {
          const d = new Date(p.sale_date);
          if (d.getFullYear() === y) map[MONTHS[d.getMonth()]] += Number(p.premium ?? 0);
        }
      });
      return MONTHS.map((name) => ({ name, Sales: map[name] }));
    }
  }, [policies, userId, year]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-gray-400">No sales data available.</div>;
  }

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#235DCB" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#235DCB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9CA3AF" tickFormatter={formatYAxis} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [
              `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
              "Sales",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
          />
          <Area
            type="monotone"
            dataKey="Sales"
            stroke="#235DCB"
            strokeWidth={2}
            fill="url(#colorSales)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
