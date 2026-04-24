import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requireRole?: "admin" | "secretary" | "superadmin";
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { isAuthenticated, isLoading, user, clinic } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  if (requireRole && user?.role !== requireRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
    );
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
