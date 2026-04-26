import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

type Role = "admin" | "secretary" | "nurse" | "superadmin";

interface Props {
  children: ReactNode;
  requireRole?: Role | Role[];
}

// Pages a super admin should never see (clinic-scoped); they get bounced to /admin.
const CLINIC_ONLY_PREFIXES = [
  "/dashboard", "/patients", "/appointments", "/prescriptions",
  "/finances", "/insights", "/team", "/subscription",
];

export function ProtectedRoute({ children, requireRole }: Props) {
  const { isAuthenticated, isLoading, user, clinic } = useAuth();
  const [location, setLocation] = useLocation();

  const subscriptionExpired = clinic?.subscriptionStatus === "expired";
  const isSuperAdmin = user?.role === "superadmin";
  const onClinicOnlyPage = CLINIC_ONLY_PREFIXES.some(p => location.startsWith(p));
  const isPendingApproval = clinic?.status === "pending_approval";

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (isSuperAdmin && onClinicOnlyPage) {
      setLocation("/admin");
      return;
    }
    if (!isSuperAdmin && isPendingApproval) {
      setLocation("/pending-activation");
      return;
    }
    if (!isSuperAdmin && subscriptionExpired) {
      setLocation("/subscription/expired");
    }
  }, [isLoading, isAuthenticated, isSuperAdmin, onClinicOnlyPage, isPendingApproval, subscriptionExpired, setLocation]);

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

  if (clinic?.status === "pending_approval" && !isSuperAdmin) {
    return null;
  }

  if (clinic?.status === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Account Suspended</h1>
          <p className="text-muted-foreground">Your clinic account has been suspended. Please contact support.</p>
        </div>
      </div>
    );
  }

  if (clinic?.subscriptionStatus === "expired") {
    setLocation("/subscription/expired");
    return null;
  }

  return <>{children}</>;
}
