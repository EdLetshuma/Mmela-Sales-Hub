"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserRole } from "@/types";
import { TabBar } from "@/components/executive/leads/shared";
import LeadsAnalyticsTab from "@/components/executive/leads/LeadsAnalyticsTab";
import SalesPerformanceTab from "./SalesPerformanceTab";
import ProductsTab from "./ProductsTab";
import PremiumTab from "./PremiumTab";

type Tab = "leads" | "performance" | "products" | "premium";

const TABS: { key: Tab; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "performance", label: "Performance" },
  { key: "products", label: "Products" },
  { key: "premium", label: "Premium" },
];

// A Sales Agent only ever sees their own numbers here — everyone else
// (Team Leader, Policy Admin, Lead Admin, Call Centre Supervisor, Admin,
// Manager) sees the whole Sales division.
export default function SalesAnalyticsHub() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("leads");
  const onlyUserId = user?.role === UserRole.SalesAgent ? user.id : undefined;

  return (
    <div className="space-y-6">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "leads" && <LeadsAnalyticsTab division="sales" onlyUserId={onlyUserId} />}
      {tab === "performance" && <SalesPerformanceTab onlyUserId={onlyUserId} />}
      {tab === "products" && <ProductsTab />}
      {tab === "premium" && <PremiumTab />}
    </div>
  );
}
