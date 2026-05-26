import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type Role } from "@/context/AuthContext";

export function ProtectedRoute({
  requiredRole,
  children,
}: {
  requiredRole: Exclude<Role, null>;
  children: ReactNode;
}) {
  const { role, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (role !== requiredRole) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}
