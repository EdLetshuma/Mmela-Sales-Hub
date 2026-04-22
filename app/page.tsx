"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import LoginForm from "@/components/auth/LoginForm";
import PlatformShell from "@/components/layout/PlatformShell";
import IntroScreen from "@/components/layout/IntroScreen";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [showIntro, setShowIntro] = useState(false);
  const [prevUser, setPrevUser] = useState<string | null>(null);

  // Show intro only on first login, not on page refresh
  useEffect(() => {
    if (user && prevUser === null) {
      // First time we see a user this session — show intro
      const sessionKey = `mmela_intro_shown_${user.id}`;
      const alreadyShown = sessionStorage.getItem(sessionKey);
      if (!alreadyShown) {
        setShowIntro(true);
        sessionStorage.setItem(sessionKey, "1");
      }
    }
    if (user) setPrevUser(user.id);
    if (!user) setPrevUser(null);
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1A348C", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 16, letterSpacing: ".04em" }}>Mmela</p>
          <div style={{ width: 24, height: 24, border: "2px solid rgba(204,224,245,.3)", borderTopColor: "#CCE0F5", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) return <LoginForm />;

  return (
    <>
      {showIntro && (
        <IntroScreen
          userName={user.name}
          onDone={() => setShowIntro(false)}
        />
      )}
      <PlatformShell />
    </>
  );
}
