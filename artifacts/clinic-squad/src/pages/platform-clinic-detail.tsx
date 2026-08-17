import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Building2, CheckCircle, Clock, LogIn, Power, RefreshCw, Shield, Users } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type AuthClinic, type AuthUser } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { formatDate } from "@/lib/utils";

interface ClinicDetail {
  clinic: {
    id: string;
    name: string;
    ownerId: string;
    status: string;
    subscriptionStatus: string;
    subscriptionPlan: string | null;
    trialEndDate: string;
    createdAt: string;
  };
  owner: { id: string; name: string; email: string; role: string; specialty?: string | null; phone?: string | null; isBlocked: boolean; createdAt: string } | null;
  counts: { members: number; patients: number; appointments: number; membersByRole: Record<string, number> };
  members: Array<{ id: string; name: string; email: string; role: string; isBlocked: boolean; createdAt: string }>;
  subscriptions: Array<{ id: string; planType: string; paymentStatus: string; amount: number; startDate: string; endDate: string; createdAt: string }>;
  revenue: { totalConfirmed: number; lastConfirmedPayment: string | null; pendingPaymentId: string | null };
}

interface ImpersonationResponse {
  token: string;
  user: AuthUser;
  clinic: AuthClinic;
}

export default function PlatformClinicDetailPage() {
  const { clinicId = "" } = useParams<{ clinicId: string }>();
  const [, setLocation] = useLocation();
  const { t } = useLang();
  const { toast } = useToast();
  const { user, clinic: currentClinic, token, login } = useAuth();
  const queryClient = useQueryClient();
  const [trialDays, setTrialDays] = useState("7");

  const detailQ = useQuery<ClinicDetail>({
    queryKey: ["/api/admin/clinics", clinicId, "detail"],
    queryFn: () => customFetch<ClinicDetail>(`/api/admin/clinics/${clinicId}/detail`),
    enabled: !!clinicId,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: Record<string, unknown> }) =>
      customFetch(`/api/admin/clinics/${clinicId}/${action}`, { method: "POST", body: JSON.stringify(body ?? {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics", clinicId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
    },
    onError: () => toast({ title: t("platformClinicManagement.actionFailed"), variant: "destructive" }),
  });

  const trialMutation = useMutation({
    mutationFn: () => customFetch(`/api/platform/clinics/${clinicId}/extend-trial`, { method: "POST", body: JSON.stringify({ days: Number(trialDays) }) }),
    onSuccess: () => {
      setTrialDays("7");
      toast({ title: t("platformClinicManagement.trialExtended") });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics", clinicId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
    },
    onError: () => toast({ title: t("platformClinicManagement.actionFailed"), variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: () => customFetch<ImpersonationResponse>(`/api/admin/clinics/${clinicId}/impersonate`, { method: "POST" }),
    onSuccess: (result) => {
      if (!user || !token) return;
      localStorage.setItem("clinicsquad_impersonator_return", JSON.stringify({ user, clinic: currentClinic, token }));
      login(result.user, result.clinic, result.token);
      window.location.assign("/dashboard");
    },
    onError: () => toast({ title: t("platformClinicManagement.impersonationFailed"), variant: "destructive" }),
  });

  const parsedTrialDays = Number(trialDays);
  const trialDaysValid = Number.isInteger(parsedTrialDays) && parsedTrialDays >= 1 && parsedTrialDays <= 3650;
  const extendTrial = () => {
    if (!trialDaysValid) {
      toast({ title: t("platformClinicManagement.invalidTrialDays"), variant: "destructive" });
      return;
    }
    trialMutation.mutate();
  };

  const detail = detailQ.data;
  if (detailQ.isLoading) {
    return <ProtectedRoute requireRole="superadmin"><DashboardLayout><div className="mx-auto max-w-7xl space-y-5 p-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-40 w-full" /><Skeleton className="h-72 w-full" /></div></DashboardLayout></ProtectedRoute>;
  }
  if (!detail) {
    return <ProtectedRoute requireRole="superadmin"><DashboardLayout><div className="mx-auto max-w-7xl p-6"><p className="text-muted-foreground">{t("platformClinicManagement.notFound")}</p><Link href="/platform-clinics"><Button variant="outline" className="mt-4"><ArrowLeft className="me-2 h-4 w-4" />{t("platformClinicManagement.backToClinics")}</Button></Link></div></DashboardLayout></ProtectedRoute>;
  }

  const statusIsSuspended = detail.clinic.status === "blocked" || detail.clinic.status === "deactivated";
  const statusIsExpired = detail.clinic.subscriptionStatus === "expired";
  const statusKind = statusIsSuspended || statusIsExpired ? "inactive" : detail.clinic.subscriptionStatus === "trial" ? "trial" : "active";
  const statusLabel = statusKind === "trial" ? t("platformClinicManagement.trial") : statusKind === "inactive" ? (statusIsExpired ? t("platformClinicManagement.expired") : t("platformClinicManagement.deactivated")) : t("platformClinicManagement.active");
  const statusClassName = statusKind === "trial"
    ? "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/20 dark:text-blue-300"
    : statusKind === "inactive"
      ? "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300"
      : "bg-green-500/10 text-green-700 ring-1 ring-inset ring-green-500/20 dark:text-green-300";
  const runStatusAction = (action: "activate" | "deactivate") => {
    if (action === "deactivate" && !window.confirm(t("platformClinicManagement.deactivateConfirm"))) return;
    actionMutation.mutate({ action }, { onSuccess: () => toast({ title: action === "activate" ? t("platformClinicManagement.activated") : t("platformClinicManagement.deactivatedSuccess") }) });
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/platform-clinics" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="me-2 h-4 w-4" />{t("platformClinicManagement.backToClinics")}</Link>
              <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Building2 className="h-6 w-6" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{detail.clinic.name}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>{statusLabel}</span></div><p className="text-sm text-muted-foreground">{t("platformClinicManagement.subtitle")}</p></div></div>
            </div>
            <Button onClick={() => impersonateMutation.mutate()} disabled={impersonateMutation.isPending || !detail.owner || statusIsSuspended || statusIsExpired}><LogIn className="me-2 h-4 w-4" />{impersonateMutation.isPending ? t("platformClinicManagement.startingSession") : t("platformClinicManagement.loginAsAdmin")}</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5"><Users className="h-4 w-4 text-primary" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinicManagement.staff")}</p><p className="mt-1 text-2xl font-bold">{detail.counts.members}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><Users className="h-4 w-4 text-blue-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinicManagement.patients")}</p><p className="mt-1 text-2xl font-bold">{detail.counts.patients}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><Clock className="h-4 w-4 text-yellow-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinicManagement.appointments")}</p><p className="mt-1 text-2xl font-bold">{detail.counts.appointments}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><Shield className="h-4 w-4 text-green-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinicManagement.confirmedRevenue")}</p><p className="mt-1 text-2xl font-bold">EGP {detail.revenue.totalConfirmed.toLocaleString()}</p></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t("platformClinicManagement.controlTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("platformClinicManagement.controlSubtitle")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>{statusLabel}</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{t("platformClinicManagement.subscription")}</p><p className="mt-1 font-semibold capitalize">{detail.clinic.subscriptionStatus}{detail.clinic.subscriptionPlan ? ` · ${detail.clinic.subscriptionPlan}` : ""}</p></div><div className="rounded-lg bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{t("platformClinicManagement.trialEnds")}</p><p className="mt-1 font-semibold">{formatDate(detail.clinic.trialEndDate)}</p></div></div>
              <div className="mt-5 flex flex-wrap items-end gap-2">{statusIsSuspended ? <Button onClick={() => runStatusAction("activate")} disabled={actionMutation.isPending}><CheckCircle className="me-2 h-4 w-4" />{t("platformClinicManagement.activate")}</Button> : !statusIsExpired ? <Button variant="outline" className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300" onClick={() => runStatusAction("deactivate")} disabled={actionMutation.isPending}><Power className="me-2 h-4 w-4" />{t("platformClinicManagement.deactivate")}</Button> : null}<div className="flex flex-col gap-1"><label htmlFor="clinic-trial-days" className="text-xs font-medium text-muted-foreground">{t("platformClinicManagement.trialDays")}</label><div className="flex items-center gap-2"><Input id="clinic-trial-days" className="w-28" type="number" min="1" max="3650" step="1" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} aria-describedby="clinic-trial-days-hint" /><Button variant="outline" onClick={extendTrial} disabled={trialMutation.isPending || !trialDaysValid}><RefreshCw className="me-2 h-4 w-4" />{t("platformClinicManagement.extendTrial")}</Button></div><p id="clinic-trial-days-hint" className="text-[11px] text-muted-foreground">{t("platformClinicManagement.trialDaysHint")}</p></div></div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">{t("platformClinicManagement.ownerTitle")}</h2>{detail.owner ? <div className="mt-4 space-y-3"><div><p className="text-xs text-muted-foreground">{t("platformClinicManagement.owner")}</p><p className="font-semibold">{detail.owner.name}</p></div><div><p className="text-xs text-muted-foreground">{t("platformClinicManagement.email")}</p><p className="break-all text-sm">{detail.owner.email}</p></div><div><p className="text-xs text-muted-foreground">{t("platformClinicManagement.role")}</p><p className="capitalize">{detail.owner.role}</p></div><div><p className="text-xs text-muted-foreground">{t("platformClinicManagement.joined")}</p><p className="text-sm">{formatDate(detail.owner.createdAt)}</p></div></div> : <p className="mt-4 text-sm text-muted-foreground">{t("platformClinicManagement.noOwner")}</p>}</section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="text-lg font-semibold">{t("platformClinicManagement.staffTitle")}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 text-start">{t("platformClinicManagement.name")}</th><th className="px-5 py-3 text-start">{t("platformClinicManagement.email")}</th><th className="px-5 py-3 text-start">{t("platformClinicManagement.role")}</th><th className="px-5 py-3 text-end">{t("platformClinicManagement.status")}</th></tr></thead><tbody>{detail.members.map((member) => <tr key={member.id} className="border-t border-border"><td className="px-5 py-3 font-medium">{member.name}</td><td className="px-5 py-3 text-muted-foreground">{member.email}</td><td className="px-5 py-3 capitalize">{member.role}</td><td className="px-5 py-3 text-end"><span className={member.isBlocked ? "text-destructive" : "text-green-600"}>{member.isBlocked ? t("platformClinicManagement.deactivated") : t("platformClinicManagement.active")}</span></td></tr>)}</tbody></table></div></section>
            <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="text-lg font-semibold">{t("platformClinicManagement.subscriptionHistory")}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 text-start">{t("platformClinicManagement.plan")}</th><th className="px-5 py-3 text-start">{t("platformClinicManagement.status")}</th><th className="px-5 py-3 text-start">{t("platformClinicManagement.amount")}</th><th className="px-5 py-3 text-end">{t("platformClinicManagement.date")}</th></tr></thead><tbody>{detail.subscriptions.map((subscription) => <tr key={subscription.id} className="border-t border-border"><td className="px-5 py-3 capitalize">{subscription.planType}</td><td className="px-5 py-3 capitalize">{subscription.paymentStatus}</td><td className="px-5 py-3">EGP {subscription.amount.toLocaleString()}</td><td className="px-5 py-3 text-end text-muted-foreground">{formatDate(subscription.createdAt)}</td></tr>)}</tbody></table></div></section>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
