"use client";

import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export function SortableTh<K extends string>({
  label, sortKey, activeKey, dir, onSort, className,
}: {
  label: string;
  sortKey: K;
  activeKey: K | null;
  dir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-gray-300" />
        )}
      </span>
    </th>
  );
}

export function sortRows<T, K extends string>(
  rows: T[],
  key: K | null,
  dir: SortDir,
  accessor: (row: T, key: K) => string | number | null | undefined
): T[] {
  if (!key) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = accessor(a, key);
    const bv = accessor(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  });
  return dir === "asc" ? sorted : sorted.reverse();
}
