"use client";

import React, { useState } from "react";
import { signIn, sendPasswordReset } from "@/lib/auth";
import { Eye, EyeOff, ArrowRight, Mail } from "lucide-react";

const LOGO_URL =
  "https://tslovjdrcbnewcajawiq.supabase.co/storage/v1/object/public/Logos/MFS%20LOGO%20ROTATED.png";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true); setError(null);
    try { await signIn(email, password); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Login failed."); }
    finally { setIsLoading(false); }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true); setError(null);
    try { await sendPasswordReset(email); setResetSent(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to send reset email."); }
    finally { setIsLoading(false); }
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
        <div className="w-full max-w-[400px]">
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <img src={LOGO_URL} alt="Mmela" style={{ width:120, height:"auto", maxHeight:100, objectFit:"contain", margin:"0 auto 12px", display:"block", filter:"brightness(0) invert(1)" }} />
            <p style={{ color:"rgba(204,224,245,.6)", fontSize:13, margin:0 }}>Reset your password</p>
          </div>
          <div className="bg-white rounded-xl p-8">
            {resetSent ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
                <p className="text-sm text-gray-500 mb-6">Reset link sent to <span className="font-medium text-gray-700">{email}</span></p>
                <button onClick={() => { setShowForgotPassword(false); setResetSent(false); }} className="btn btn-secondary w-full">Back to login</button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-500">Enter your email and we'll send you a reset link.</p>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@mmela.co.za" required />
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full h-10">{isLoading ? "Sending…" : "Send reset link"}</button>
                <button type="button" onClick={() => { setShowForgotPassword(false); setError(null); }} className="btn btn-ghost w-full text-sm text-gray-500">Back to login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo — static, no animation on login page */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <img
            src={LOGO_URL}
            alt="Mmela Financial Services"
            style={{ width:140, height:"auto", maxHeight:120, objectFit:"contain", margin:"0 auto 16px", display:"block", filter:"brightness(0) invert(1)" }}
          />
          <p style={{ color:"rgba(204,224,245,.45)", fontSize:12, margin:0, letterSpacing:".06em" }}>
            MMELA FINANCIAL SERVICES · FSP 20557
          </p>
        </div>

        <div className="bg-white rounded-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@mmela.co.za" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="input-field pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => { setShowForgotPassword(true); setError(null); }} className="text-xs text-brand-700 hover:text-brand-800 font-medium">
              Forgot your password?
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary w-full h-11 gap-2">
              {isLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
