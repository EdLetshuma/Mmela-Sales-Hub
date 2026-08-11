"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserRole } from "@/types";
import LeadsAnalyticsTab from "@/components/executive/leads/LeadsAnalyticsTab";

// A Credit Health Agent only sees their own leads here — Admin/Manager see
// the whole Credit Health division. No policies/premium concept for this unit.
export default function CreditHealthAnalyticsHub() {
  const { user } = useAuth();
  const onlyUserId = user?.role === UserRole.CreditHealthAgent ? user.id : undefined;

  return <LeadsAnalyticsTab division="creditHealth" onlyUserId={onlyUserId} />;
}
