import { supabase } from "./supabase";

// ── Supabase Edge Function invoker ───────────────────────────

async function invokeEmailFunction(
  type: string,
  payload: Record<string, string>
) {
  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { type, payload },
    });
    if (error) {
      console.error(`Email send failed [${type}]:`, error);
    }
  } catch (err) {
    // Never throw — email failures should not break the UI
    console.error(`Email invoke error [${type}]:`, err);
  }
}

// ── Exported triggers ────────────────────────────────────────

/**
 * Notify an agent that a lead has been assigned to them.
 * Call this after assignLead() succeeds.
 */
export async function notifyLeadAssigned(params: {
  agentEmail: string;
  agentName: string;
  leadName: string;
  source?: string;
}) {
  await invokeEmailFunction("lead_assigned", {
    agentEmail: params.agentEmail,
    agentName: params.agentName,
    leadName: params.leadName,
    source: params.source ?? "Hub",
  });
}

/**
 * Notify Policy Admin that a new policy needs documentation.
 * Call this after createPolicy() succeeds.
 */
export async function notifyDocsPending(params: {
  recipientEmail: string;
  recipientName: string;
  clientName: string;
  policyNumber: string;
  agentName?: string;
}) {
  await invokeEmailFunction("docs_pending", {
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    clientName: params.clientName,
    policyNumber: params.policyNumber,
    agentName: params.agentName ?? "—",
  });
}

/**
 * Notify Lead Admin that a new referral has been captured.
 * Call this after createLead() with source=Referral succeeds.
 */
export async function notifyNewReferral(params: {
  recipientEmail: string;
  recipientName: string;
  leadName: string;
  referredBy?: string;
  productInterest?: string;
}) {
  await invokeEmailFunction("new_referral", {
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    leadName: params.leadName,
    referredBy: params.referredBy ?? "",
    productInterest: params.productInterest ?? "",
  });
}
