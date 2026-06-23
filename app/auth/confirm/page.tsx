"use client";

import React, { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function confirm() {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as "signup" | "recovery" | "email_change" | null;

      if (!tokenHash || !type) {
        setStatus("error");
        setMessage("Invalid or expired link.");
        return;
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

      if (error) {
        setStatus("error");
        setMessage(error.message ?? "This link is invalid or has expired.");
        return;
      }

      if (type === "recovery") {
        router.push("/auth/reset-password");
      } else {
        setStatus("success");
        setMessage("Your account has been confirmed. Redirecting…");
        setTimeout(() => router.push("/"), 2000);
      }
    }

    confirm();
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, background: "#1A348C", borderRadius: 12, marginBottom: 12 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>M</span>
        </div>
        <p style={{ color: "#1A348C", fontWeight: 700, fontSize: 20, margin: 0 }}>Mmela Hub</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px 28px", width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        {status === "loading" && (
          <>
            <div style={{ width: 40, height: 40, border: "3px solid #E5E7EB", borderTopColor: "#1A348C", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>Verifying your link…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ width: 48, height: 48, background: "#EAF3DE", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✓</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Confirmed</p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ width: 48, height: 48, background: "#FCEBEB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✕</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Link expired</p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>{message}</p>
            <a href="/login" style={{ display: "inline-block", background: "#1A348C", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600, padding: "10px 24px", borderRadius: 6 }}>Back to sign in</a>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6B7280", fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  );
}