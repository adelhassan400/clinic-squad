import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang";

type Role = "admin" | "doctor" | "manager" | "assistant" | "secretary" | "nurse" | "superadmin";

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
  const { t } = useLang();
  const [location, setLocation] = useLocation();

  const isSuperAdmin = user?.role === "superadmin";
  const onClinicOnlyPage = CLINIC_ONLY_PREFIXES.some((p) => location.startsWith(p));
  const canAccessRenewalPage = location.startsWith("/subscription") || location === "/subscription-expired";
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

    if (!clinicIsActive && !canAccessRenewalPage) {
      setLocation(clinic?.status === "deactivated" ? "/subscription-expired" : "/pending-activation");
    }
  }, [
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    onClinicOnlyPage,
    clinicIsActive,
    clinic?.status,
    canAccessRenewalPage,
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

  if (!isSuperAdmin && !clinicIsActive && !canAccessRenewalPage) {
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

  const financeOnlyPage = location.startsWith("/finances") || location.startsWith("/insights");
  const canFinance = isSuperAdmin || user?.role === "admin" || (!!user && clinic?.ownerId === user.id);
  if ((allowedRoles && (!user?.role || !allowedRoles.includes(user.role as Role))) || (financeOnlyPage && !canFinance)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("x.accessDenied")}</h1>
          <p className="text-muted-foreground mt-2">{t("x.noPermission")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
