"use client";

import React, { useState } from "react";
import { updatePassword } from "@/lib/auth";
import { Eye, EyeOff, Check, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "Passwords match", met: password.length > 0 && password === confirmPassword },
  ];

  const allMet = requirements.every((r) => r.met);

  const LOGO = "https://tslovjdrcbnewcajawiq.supabase.co/storage/v1/object/public/Logos/MFS%20LOGO%20ROTATED.png";
  const LogoHeader = ({ sub }: { sub?: string }) => (
    <div style={{ textAlign:"center", marginBottom:32 }}>
      <img src={LOGO} alt="Mmela" style={{ width:100, height:"auto", objectFit:"contain", margin:"0 auto 12px", display:"block", filter:"brightness(0) invert(1)" }} />
      {sub && <p style={{ color:"rgba(204,224,245,.6)", fontSize:13, margin:0 }}>{sub}</p>}
    </div>
  );

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;

    setIsLoading(true);
    setError(null);

    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
        <div className="w-full max-w-[400px]">
          <LogoHeader />
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Password updated
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been changed. You can now sign in with your new
              password.
            </p>
            <a href="/" className="btn btn-primary w-full inline-flex">
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <LogoHeader sub="Set a new password" />

        <div className="bg-white rounded-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Confirm new password"
                required
              />
            </div>

            <div className="space-y-1.5 pt-1">
              {requirements.map((req) => (
                <div
                  key={req.label}
                  className="flex items-center gap-2 text-xs"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      req.met
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-300"
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span
                    className={
                      req.met ? "text-green-700" : "text-gray-400"
                    }
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || !allMet}
              className="btn btn-primary w-full h-10 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
