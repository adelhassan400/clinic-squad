import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useCurrency } from "@/lib/currency";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Stethoscope,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, getTrialDaysLeft } from "@/lib/utils";
import { useUpdateProfile, useChangePassword, useListAuthEvents, getListAuthEventsQueryKey, useUpdateClinic } from "@workspace/api-client-react";
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

function eventMeta(type: string): {
  label: string;
  Icon: typeof CheckCircle2;
  fg: string;
  bg: string;
} {
  switch (type) {
    case "login_success":
      return { label: "Successful sign-in", Icon: CheckCircle2, fg: "text-primary", bg: "bg-primary/10" };
    case "login_failed":
      return { label: "Failed sign-in attempt", Icon: XCircle, fg: "text-destructive", bg: "bg-destructive/10" };
    case "password_changed":
      return { label: "Password changed", Icon: KeyRound, fg: "text-accent", bg: "bg-accent/10" };
    case "password_reset":
      return { label: "Password reset via link", Icon: KeyRound, fg: "text-accent", bg: "bg-accent/10" };
    default:
      return { label: type, Icon: Activity, fg: "text-muted-foreground", bg: "bg-muted" };
  }
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleString();
}

function shortUA(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return ua.length > 40 ? ua.slice(0, 40) + "…" : ua;
}

export default function SettingsPage() {
  const { user, clinic, updateUser, updateClinic } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const [specialty, setSpecialty] = useState(user?.specialty ?? "");
  useEffect(() => { setSpecialty(user?.specialty ?? ""); }, [user?.specialty]);
  const updateProfile = useUpdateProfile();
  const isDoctor = user?.role === "admin" || user?.role === "doctor";

  const [showPw, setShowPw] = useState(false);
  const changePassword = useChangePassword();
  const authEvents = useListAuthEvents({ query: { queryKey: getListAuthEventsQueryKey(), staleTime: 30_000 } });
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function saveSpecialty() {
    try {
      const updated = await updateProfile.mutateAsync({ data: { specialty: specialty.trim() || null } });
      updateUser({ ...(user as any), specialty: updated.specialty ?? null });
      toast({ title: t("settings.profile.updated") });
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
      authEvents.refetch();
      toast({ title: t("settings.pw.changed"), description: "Use your new password next time you sign in." });
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

  // Clinic identity (name, phone, address) — editable by admin/superadmin only
  const updateClinicMutation = useUpdateClinic();
  const isAdminOrOwner = user?.role === "admin" || user?.role === "doctor";
  const [clinicName, setClinicName] = useState(clinic?.name ?? "");
  const [clinicPhone, setClinicPhone] = useState(clinic?.phone ?? "");
  const [clinicAddress, setClinicAddress] = useState(clinic?.address ?? "");
  useEffect(() => {
    setClinicName(clinic?.name ?? "");
    setClinicPhone(clinic?.phone ?? "");
    setClinicAddress(clinic?.address ?? "");
  }, [clinic?.id, clinic?.name, clinic?.phone, clinic?.address]);

  const identityDirty =
    clinicName.trim() !== (clinic?.name ?? "").trim() ||
    clinicPhone.trim() !== (clinic?.phone ?? "").trim() ||
    clinicAddress.trim() !== (clinic?.address ?? "").trim();

  async function saveClinicIdentity() {
    if (!clinic?.id) return;
    if (!clinicName.trim()) {
      toast({ title: "Clinic name is required", variant: "destructive" });
      return;
    }
    try {
      const updated = await updateClinicMutation.mutateAsync({
        clinicId: clinic.id,
        data: {
          name: clinicName.trim(),
          phone: clinicPhone.trim() || null,
          address: clinicAddress.trim() || null,
        },
      });
      updateClinic({
        ...(clinic as any),
        name: updated.name,
        phone: updated.phone ?? null,
        address: updated.address ?? null,
      });
      toast({ title: t("settings.clinic.updated") });
    } catch (err: any) {
      toast({
        title: "Failed to update clinic",
        description: err?.data?.error ?? err?.message ?? "Try again",
        variant: "destructive",
      });
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary" />
            {t("settings.title")}
          </h1>

          <div className="space-y-5">
            {/* Profile */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">{t("settings.profile.title")}</h2>
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
                    {t("settings.profile.specialty")}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("settings.profile.specialtyDesc")}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder={t("settings.profile.specialtyPh")}
                      data-testid="input-specialty"
                    />
                    <Button
                      onClick={saveSpecialty}
                      disabled={updateProfile.isPending || specialty === (user?.specialty ?? "")}
                      data-testid="button-save-specialty"
                    >
                      {updateProfile.isPending ? t("settings.profile.saving") : t("settings.profile.save")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Clinic Identity (editable, admin only) — appears on prescriptions */}
            {isAdminOrOwner && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold mb-1">{t("settings.clinic.title")}</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("settings.clinic.desc")}
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clinic-name" className="mb-1.5 block text-sm">{t("settings.clinic.name")}</Label>
                    <Input
                      id="clinic-name"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder={t("settings.clinic.namePh")}
                      maxLength={200}
                      data-testid="input-clinic-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clinic-phone" className="mb-1.5 block text-sm">{t("settings.clinic.phone")}</Label>
                    <Input
                      id="clinic-phone"
                      value={clinicPhone}
                      onChange={(e) => setClinicPhone(e.target.value)}
                      placeholder={t("settings.clinic.phonePh")}
                      maxLength={50}
                      data-testid="input-clinic-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clinic-address" className="mb-1.5 block text-sm">{t("settings.clinic.address")}</Label>
                    <textarea
                      id="clinic-address"
                      value={clinicAddress}
                      onChange={(e) => setClinicAddress(e.target.value)}
                      placeholder={t("settings.clinic.addressPh")}
                      rows={3}
                      maxLength={500}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="input-clinic-address"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={saveClinicIdentity}
                      disabled={updateClinicMutation.isPending || !identityDirty}
                      data-testid="button-save-clinic-identity"
                    >
                      {updateClinicMutation.isPending ? t("settings.profile.saving") : t("settings.clinic.save")}
                    </Button>
                  </div>
                </div>
              </div>
            )}



            {/* Password */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">{t("settings.pw.title")}</h2>
              <form
                onSubmit={passwordForm.handleSubmit(onChangePassword)}
                className="space-y-4"
                data-testid="form-change-password"
              >
                <div>
                  <Label htmlFor="currentPassword">{t("settings.pw.current")}</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="currentPassword"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...passwordForm.register("currentPassword")}
                      data-testid="input-current-password"
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
                    <Label htmlFor="newPassword">{t("settings.pw.new")}</Label>
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
                    <Label htmlFor="confirmPassword">{t("settings.pw.confirm")}</Label>
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
                    {changePassword.isPending ? t("settings.pw.changing") : t("settings.pw.change")}
                  </Button>
                </div>
              </form>
            </div>

            {/* Account activity */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" /> {t("settings.security.title")}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => authEvents.refetch()}
                  disabled={authEvents.isFetching}
                  data-testid="button-refresh-events"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${authEvents.isFetching ? "animate-spin" : ""}`}
                  />
                  {t("dash.viewAll")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {t("settings.security.desc")}
              </p>

              {authEvents.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("presc.saving")}
                </div>
              ) : authEvents.isError ? (
                <p className="text-sm text-destructive">Couldn't load activity. Try again.</p>
              ) : (authEvents.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t("settings.security.empty")}</p>
              ) : (
                <ul className="divide-y divide-border" data-testid="list-auth-events">
                  {authEvents.data!.map((evt) => {
                    const meta = eventMeta(evt.type);
                    return (
                      <li
                        key={evt.id}
                        className="py-3 flex items-start gap-3"
                        data-testid={`event-${evt.type}`}
                      >
                        <div
                          className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}
                        >
                          <meta.Icon className={`w-3.5 h-3.5 ${meta.fg}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-sm font-medium">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatEventTime(evt.createdAt as unknown as string)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {evt.ip ?? "Unknown IP"}
                            {evt.userAgent ? ` · ${shortUA(evt.userAgent)}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Security */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">{t("sidebar.secure.title")}</h2>
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
