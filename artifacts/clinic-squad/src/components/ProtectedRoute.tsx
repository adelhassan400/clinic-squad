import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

type Role = "admin" | "secretary" | "nurse" | "superadmin";

interface Props {
  children: ReactNode;
  requireRole?: Role | Role[];
}

const CLINIC_ONLY_PREFIXES = [
  "/dashboard", "/patients", "/appointments", "/prescriptions",
  "/finances", "/insights", "/team", "/subscription",
];

export function ProtectedRoute({ children, requireRole }: Props) {
  const { isAuthenticated, isLoading, user, clinic } = useAuth();
  const [location, setLocation] = useLocation();

  const isSuperAdmin = user?.role === "superadmin";
  const onClinicOnlyPage = CLINIC_ONLY_PREFIXES.some((p) => location.startsWith(p));
  const clinicIsActive =
    clinic?.status === "active" && clinic?.subscriptionStatus !== "expired";

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    if (isSuperAdmin) {
      if (onClinicOnlyPage) setLocation("/admin");
      return;
    }

    if (!clinicIsActive) {
      setLocation("/pending-activation");
    }
  }, [
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    onClinicOnlyPage,
    clinicIsActive,
    setLocation,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isSuperAdmin && !clinicIsActive) {
    return null;
  }

  if (isSuperAdmin && onClinicOnlyPage) {
    return null;
  }

  const allowedRoles = requireRole
    ? Array.isArray(requireRole)
      ? requireRole
      : [requireRole]
    : null;

  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role as Role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
