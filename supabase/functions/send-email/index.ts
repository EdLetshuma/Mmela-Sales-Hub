import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_ADDRESS = "Mmela Hub <onboarding@resend.dev>";

// ── Email templates ──────────────────────────────────────────

function leadAssignedHtml(agentName: string, leadName: string, source: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="background: #1A348C; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <p style="color: #fff; font-size: 16px; font-weight: 600; margin: 0;">Mmela Hub</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; font-weight: 600; margin: 0 0 8px;">Hi ${agentName},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          A new lead has been assigned to you on Mmela Hub.
        </p>
        <div style="background: #fff; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Lead name</p>
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px;">${leadName}</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Source</p>
          <p style="font-size: 14px; color: #374151; margin: 0;">${source}</p>
        </div>
        <p style="font-size: 13px; color: #6B7280; margin: 0;">
          Log in to Mmela Hub to view and action this lead.
        </p>
      </div>
    </div>
  `;
}

function docsPendingHtml(recipientName: string, clientName: string, policyNumber: string, agentName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="background: #1A348C; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <p style="color: #fff; font-size: 16px; font-weight: 600; margin: 0;">Mmela Hub</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; font-weight: 600; margin: 0 0 8px;">Hi ${recipientName},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          A new policy has been added and requires documentation.
        </p>
        <div style="background: #fff; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Policy number</p>
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px; font-family: monospace;">${policyNumber}</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Client</p>
          <p style="font-size: 14px; color: #374151; margin: 0 0 12px;">${clientName}</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Sold by</p>
          <p style="font-size: 14px; color: #374151; margin: 0;">${agentName}</p>
        </div>
        <p style="font-size: 13px; color: #6B7280; margin: 0;">
          Please upload the policy document via Mmela Hub → Policies.
        </p>
      </div>
    </div>
  `;
}

function newReferralHtml(recipientName: string, leadName: string, referredBy: string, productInterest: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="background: #1A348C; padding: 20px 28px; border-radius: 8px 8px 0 0;">
        <p style="color: #fff; font-size: 16px; font-weight: 600; margin: 0;">Mmela Hub</p>
      </div>
      <div style="background: #f9fafb; padding: 28px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; font-weight: 600; margin: 0 0 8px;">Hi ${recipientName},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          A new referral has been captured and needs to be assigned.
        </p>
        <div style="background: #fff; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Lead name</p>
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px;">${leadName}</p>
          ${referredBy ? `
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Referred by</p>
          <p style="font-size: 14px; color: #374151; margin: 0 0 12px;">${referredBy}</p>
          ` : ""}
          ${productInterest ? `
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Product interest</p>
          <p style="font-size: 14px; color: #374151; margin: 0;">${productInterest}</p>
          ` : ""}
        </div>
        <p style="font-size: 13px; color: #6B7280; margin: 0;">
          Go to Mmela Hub → Leads → Lead pool to assign this referral.
        </p>
      </div>
    </div>
  `;
}

// ── Send via Resend ──────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send");
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    throw new Error(`Resend failed: ${err}`);
  }

  return res.json();
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { type, payload } = body as {
      type: "lead_assigned" | "docs_pending" | "new_referral";
      payload: Record<string, string>;
    };

    let result;

    switch (type) {
      case "lead_assigned": {
        // payload: { agentEmail, agentName, leadName, source }
        result = await sendEmail(
          payload.agentEmail,
          `New lead assigned: ${payload.leadName}`,
          leadAssignedHtml(payload.agentName, payload.leadName, payload.source ?? "Hub")
        );
        break;
      }

      case "docs_pending": {
        // payload: { recipientEmail, recipientName, clientName, policyNumber, agentName }
        result = await sendEmail(
          payload.recipientEmail,
          `Documentation required: Policy ${payload.policyNumber}`,
          docsPendingHtml(payload.recipientName, payload.clientName, payload.policyNumber, payload.agentName ?? "—")
        );
        break;
      }

      case "new_referral": {
        // payload: { recipientEmail, recipientName, leadName, referredBy, productInterest }
        result = await sendEmail(
          payload.recipientEmail,
          `New referral captured: ${payload.leadName}`,
          newReferralHtml(payload.recipientName, payload.leadName, payload.referredBy ?? "", payload.productInterest ?? "")
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${type}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
