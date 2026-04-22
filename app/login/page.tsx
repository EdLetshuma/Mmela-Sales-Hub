"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Canonical login is at /auth/login
// This redirect ensures /login also works for any old links
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/auth/login"); }, [router]);
  return null;
}
