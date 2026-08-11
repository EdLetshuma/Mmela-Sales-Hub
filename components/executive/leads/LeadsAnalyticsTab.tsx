"use client";

import React, { useState } from "react";
import type { FunnelDivision } from "@/lib/lead-analytics-api";
import LeadOverview from "./LeadOverview";
import LeadFunnel from "./LeadFunnel";
import LeadSources from "./LeadSources";
import LeadAging from "./LeadAging";
import LostLeads from "./LostLeads";
import { TabBar } from "./shared";

type SubTab = "overview" | "funnel" | "sources" | "aging" | "lost";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "funnel", label: "Funnel" },
  { key: "sources", label: "Sources" },
  { key: "aging", label: "Aging" },
  { key: "lost", label: "Lost" },
];

export default function LeadsAnalyticsTab({ division, onlyUserId }: { division: FunnelDivision; onlyUserId?: string }) {
  const [sub, setSub] = useState<SubTab>("overview");
  const scope = { division, onlyUserId };

  return (
    <div className="space-y-6">
      <TabBar tabs={SUB_TABS} active={sub} onChange={setSub} />
      {sub === "overview" && <LeadOverview scope={scope} />}
      {sub === "funnel" && <LeadFunnel fixedDivision={division} onlyUserId={onlyUserId} />}
      {sub === "sources" && <LeadSources scope={scope} />}
      {sub === "aging" && <LeadAging scope={scope} />}
      {sub === "lost" && <LostLeads scope={scope} />}
    </div>
  );
}
