"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "./EmptyState";

/** UI-level gate; the API enforces the same roles server-side. */
export function RoleGuard({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  if (!roles.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="Your account role does not include access to this area. Contact an administrator if you need it."
      />
    );
  }
  return <>{children}</>;
}
