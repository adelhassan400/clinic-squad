import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useCurrency } from "@/lib/currency";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Sun, Moon, Shield, AlertTriangle, Coins, Stethoscope, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { formatDate, getTrialDaysLeft } from "@/lib/utils";
import { useUpdateProfile, useChangePassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(6, "At least 6 characters"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "New password must be different from current",
  });
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, clinic, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currency, setCurrencyCode, options: currencyOptions, format: formatMoney } = useCurrency();
  const { toast } = useToast();
  const [specialty, setSpecialty] = useState(user?.specialty ?? "");
  useEffect(() => { setSpecialty(user?.specialty ?? ""); }, [user?.specialty]);
  const updateProfile = useUpdateProfile();
  const isDoctor = user?.role === "admin" || user?.role === "superadmin";

  const [showPw, setShowPw] = useState(false);
  const changePassword = useChangePassword();
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function saveSpecialty() {
    try {
      const updated = await updateProfile.mutateAsync({ data: { specialty: specialty.trim() || null } });
      updateUser({ ...(user as any), specialty: updated.specialty ?? null });
      toast({ title: "Specialty updated" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err?.message, variant: "destructive" });
    }
  }

  async function onChangePassword(data: PasswordFormData) {
    try {
      await changePassword.mutateAsync({
        data: { currentPassword: data.currentPassword, newPassword: data.newPassword },
      });
      passwordForm.reset();
      toast({ title: "Password changed", description: "Use your new password next time you sign in." });
    } catch (err: any) {
      const status = err?.status;
      toast({
        title: "Couldn't change password",
        description:
          status === 401
            ? "Your current password is incorrect."
            : "Please double-check your input and try again.",
        variant: "destructive",
      });
    }
  }

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
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{user?.name?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge className="mt-1 text-xs capitalize">{user?.role}</Badge>
                </div>
              </div>
              {isDoctor && (
                <div className="border-t border-border pt-4">
                  <Label htmlFor="specialty" className="flex items-center gap-1.5 mb-1.5 text-sm">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Medical Specialty
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Shown on every prescription you issue (e.g. Cardiology, Pediatrics, Internal Medicine).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="e.g. General Practitioner"
                      data-testid="input-specialty"
                    />
                    <Button
                      onClick={saveSpecialty}
                      disabled={updateProfile.isPending || specialty === (user?.specialty ?? "")}
                      data-testid="button-save-specialty"
                    >
                      {updateProfile.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}
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

            {/* Currency */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4" /> Currency
              </h2>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Display currency</p>
                  <p className="text-xs text-muted-foreground">
                    Used for fees, finances and dashboard amounts. Example: {formatMoney(1000)}
                  </p>
                </div>
                <Select value={currency.code} onValueChange={setCurrencyCode}>
                  <SelectTrigger className="w-[220px]" data-testid="select-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {currencyOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code} data-testid={`currency-option-${c.code}`}>
                        <span className="mr-2">{c.flag}</span>
                        {c.country} — {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Change password */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-1 flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Change Password
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Use a strong password you don't use anywhere else.
              </p>
              <form
                onSubmit={passwordForm.handleSubmit(onChangePassword)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="currentPassword">Current password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="currentPassword"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...passwordForm.register("currentPassword")}
                      data-testid="input-current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label="Toggle password visibility"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-xs text-destructive mt-1">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type={showPw ? "text" : "password"}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      {...passwordForm.register("newPassword")}
                      data-testid="input-new-password"
                      className="mt-1.5"
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-destructive mt-1">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPw ? "text" : "password"}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      {...passwordForm.register("confirmPassword")}
                      data-testid="input-confirm-password"
                      className="mt-1.5"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={changePassword.isPending}
                    data-testid="button-change-password"
                  >
                    {changePassword.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Update Password
                  </Button>
                </div>
              </form>
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
