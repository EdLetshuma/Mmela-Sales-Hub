"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserRole } from "@/types";
import LeadsAnalyticsTab from "@/components/executive/leads/LeadsAnalyticsTab";

// A Concierge Agent only sees their own leads here — Admin/Manager see the
// whole Concierge division. No policies/premium concept for this unit.
export default function ConciergeAnalyticsHub() {
  const { user } = useAuth();
  const onlyUserId = user?.role === UserRole.ConciergeAgent ? user.id : undefined;

  return <LeadsAnalyticsTab division="concierge" onlyUserId={onlyUserId} />;
}
