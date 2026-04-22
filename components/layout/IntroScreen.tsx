"use client";

import React, { useEffect, useState } from "react";

interface IntroScreenProps {
  userName: string;
  onDone: () => void;
}

const LOGO_URL =
  "https://tslovjdrcbnewcajawiq.supabase.co/storage/v1/object/public/Logos/MFS%20LOGO%20ROTATED.png";

type Phase = "welcome" | "zoom" | "exit";

export default function IntroScreen({ userName, onDone }: IntroScreenProps) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const firstName = (userName ?? "there").split(" ")[0];

  useEffect(() => {
    // Phase 1: show welcome text for 1.2s
    const t1 = setTimeout(() => setPhase("zoom"), 1200);
    // Phase 2: logo zooms in + spins, hold 2s then exit
    const t2 = setTimeout(() => setPhase("exit"), 3400);
    // Phase 3: after exit animation completes, call onDone
    const t3 = setTimeout(onDone, 4100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes _iWelcome {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _iLogoIn {
          0%   { opacity: 0; transform: scale(0.3) rotate(0deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(360deg); }
          100% { opacity: 1; transform: scale(1) rotate(360deg); }
        }
        @keyframes _iExit {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes _iGlow {
          0%,100% { opacity: .08; transform: scale(1); }
          50%      { opacity: .18; transform: scale(1.08); }
        }
      `}</style>

      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#1A348C",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 0,
          animation: phase === "exit" ? "_iExit .7s ease forwards" : undefined,
          overflow: "hidden",
        }}
      >
        {/* Background radial */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 30% 40%, rgba(0,88,163,.35) 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(35,93,203,.22) 0%, transparent 50%)",
        }} />

        {/* Welcome text — phase 1 */}
        <div style={{
          position: "relative", zIndex: 2, textAlign: "center",
          transition: "opacity .4s ease, transform .4s ease",
          opacity: phase === "welcome" ? 1 : phase === "zoom" ? 0 : 0,
          transform: phase === "zoom" ? "translateY(-8px)" : "translateY(0)",
          animation: phase === "welcome" ? "_iWelcome .6s ease both" : undefined,
          pointerEvents: "none",
        }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", letterSpacing: ".1em", textTransform: "uppercase", margin: "0 0 12px" }}>
            Mmela Financial Services
          </p>
          <p style={{ fontSize: 36, fontWeight: 300, color: "#fff", margin: 0, lineHeight: 1.2 }}>
            Welcome back,
          </p>
          <p style={{ fontSize: 36, fontWeight: 600, color: "#CCE0F5", margin: 0, lineHeight: 1.2 }}>
            {firstName}
          </p>
        </div>

        {/* Logo zoom — phase 2 */}
        {phase !== "welcome" && (
          <div style={{
            position: "absolute", zIndex: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 24,
          }}>
            {/* Glow disc */}
            <div style={{
              position: "absolute",
              width: 200, height: 200, borderRadius: "50%",
              background: "rgba(204,224,245,.1)",
              animation: "_iGlow 2.5s ease-in-out infinite",
            }} />
            {/* Logo */}
            <img
              src={LOGO_URL}
              alt="Mmela"
              style={{
                width: 140, height: "auto", maxHeight: 140,
                objectFit: "contain",
                position: "relative",
                zIndex: 1,
                filter: "brightness(0) invert(1) drop-shadow(0 4px 24px rgba(0,0,0,.3))",
                animation: "_iLogoIn .9s cubic-bezier(.34,1.56,.64,1) both",
              }}
            />
            <p style={{
              fontSize: 13, color: "rgba(255,255,255,.45)",
              letterSpacing: ".06em", margin: 0,
              animation: "_iWelcome .5s .5s ease both", opacity: 0,
            }}>
              Your workspace is ready
            </p>
          </div>
        )}
      </div>
    </>
  );
}
