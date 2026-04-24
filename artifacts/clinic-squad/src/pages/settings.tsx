import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Sun, Moon, Shield, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { formatDate, getTrialDaysLeft } from "@/lib/utils";

export default function SettingsPage() {
  const { user, clinic } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const trialDaysLeft = clinic?.subscriptionStatus === "trial"
    ? getTrialDaysLeft(clinic.trialEndDate)
    : null;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>

          <div className="space-y-5">
            {/* Profile */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Profile</h2>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{user?.name?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge className="mt-1 text-xs capitalize">{user?.role}</Badge>
                </div>
              </div>
            </div>

            {/* Clinic */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Clinic Information</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Clinic Name</span>
                  <span className="text-sm font-medium">{clinic?.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Account Status</span>
                  <Badge className="capitalize text-xs">{clinic?.status}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Subscription</span>
                  <div className="flex items-center gap-2">
                    {clinic?.subscriptionStatus === "premium" && <Crown className="w-3.5 h-3.5 text-accent" />}
                    <Badge className="capitalize text-xs">{clinic?.subscriptionStatus}</Badge>
                  </div>
                </div>
                {clinic?.subscriptionStatus === "trial" && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Trial Ends</span>
                    <span className="text-sm font-medium">{formatDate(clinic.trialEndDate)} ({trialDaysLeft} days left)</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Registered</span>
                  <span className="text-sm font-medium">{formatDate(clinic?.createdAt ?? "")}</span>
                </div>
              </div>
            </div>

            {/* Subscription upgrade */}
            {(clinic?.subscriptionStatus === "trial" || clinic?.subscriptionStatus === "basic") && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <div className="flex items-start gap-3">
                  {clinic.subscriptionStatus === "trial" ? (
                    <AlertTriangle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  ) : (
                    <Crown className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {clinic.subscriptionStatus === "trial" ? "Trial Period Active" : "Upgrade to Premium"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {clinic.subscriptionStatus === "trial"
                        ? `You have ${trialDaysLeft} days left in your trial. Choose a plan to continue.`
                        : "Unlock the financial dashboard, analytics, and unlimited features."}
                    </p>
                    <Link href="/subscription">
                      <Button size="sm">
                        <Crown className="w-3.5 h-3.5 mr-1.5" />
                        {clinic.subscriptionStatus === "trial" ? "Choose a Plan" : "Upgrade to Premium"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Appearance</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">Currently using {theme === "dark" ? "dark" : "light"} mode</p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleTheme} data-testid="toggle-theme-settings">
                  {theme === "dark" ? <><Sun className="w-4 h-4 mr-2" />Light Mode</> : <><Moon className="w-4 h-4 mr-2" />Dark Mode</>}
                </Button>
              </div>
            </div>

            {/* Security */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Security</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Your data is secured with role-based access control. Only authorized staff can access patient information.</span>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
