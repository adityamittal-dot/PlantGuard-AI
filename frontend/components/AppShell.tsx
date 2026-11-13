"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./Navbar";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/analyze",
  "/diagnosis",
  "/history",
  "/analytics",
  "/research",
  "/admin",
];

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    const needsAuth = PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (needsAuth && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-charcoal/50">
        Loading session…
      </div>
    );
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (needsAuth && !isAuthenticated) return null;

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mist">
      <Navbar variant="app" />
      <RequireAuth>
        <main className="container-narrow section-pad py-10">{children}</main>
      </RequireAuth>
    </div>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-forest text-cream">
      <Navbar variant="marketing" />
      {children}
    </div>
  );
}
