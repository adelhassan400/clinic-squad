import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Building2, CheckCircle, Clock, Download, RefreshCw, Search, ShieldCheck, ShieldOff, Users, X } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, getAdminListClinicsQueryKey, useAdminListClinics } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EngagementRow {
  clinicId: string;
  clinicName: string;
  subscriptionStatus: string;
  patientCount: number;
  recentPatients: number;
  recentAppointments: number;
  activityWindowDays: number;
  engagementScore: number;
  engagementLevel: "high" | "medium" | "low";
}

type DirectoryFilter = "all" | "active" | "pending" | "deactivated" | "trial";
type BulkAction = "activate" | "deactivate";

interface DirectoryClinic {
  id: string;
  requestNumber?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  ownerId: string;
  ownerEmail?: string | null;
  status: string;
  subscriptionStatus: string;
  subscriptionPlan?: string | null;
  trialEndDate?: string | null;
  accessEndDate?: string | null;
  expiryType?: "trial" | "subscription" | null;
  expiringSoon?: boolean;
  daysUntilExpiry?: number;
  createdAt: string;
}

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "green" | "yellow" | "red" | "blue" | "muted" }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", tone === "green" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", tone === "yellow" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", tone === "red" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", tone === "blue" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", tone === "muted" && "bg-muted text-muted-foreground")}>{children}</span>;
}

export default function PlatformClinicsPage() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [selectedClinicIds, setSelectedClinicIds] = useState<Set<string>>(new Set());
  const [trialClinic, setTrialClinic] = useState<DirectoryClinic | null>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: clinics, isLoading } = useAdminListClinics({ query: { queryKey: getAdminListClinicsQueryKey() } });
  const engagementQ = useQuery<EngagementRow[]>({ queryKey: ["/api/platform/engagement"], queryFn: () => customFetch<EngagementRow[]>("/api/platform/engagement"), staleTime: 60_000 });
  const engagementByClinic = useMemo(() => new Map((engagementQ.data ?? []).map((row) => [row.clinicId, row])), [engagementQ.data]);
  const isPendingStatus = (status: string) => status === "pending" || status === "pending_approval";
  const engagementLabel = (level: EngagementRow["engagementLevel"] | undefined) =>
    level === "high" ? t("platformClinics.engagementHigh") : level === "medium" ? t("platformClinics.engagementMedium") : t("platformClinics.engagementLow");
  const engagementTone = (level: EngagementRow["engagementLevel"] | undefined): "green" | "yellow" | "red" =>
    level === "high" ? "green" : level === "medium" ? "yellow" : "red";

  const filteredClinics = useMemo(() => {
    const query = search.trim().toLowerCase();
    const directoryClinics = (clinics ?? []) as DirectoryClinic[];
    return directoryClinics
      .filter((clinic) => {
        if (filter === "all") return true;
        if (filter === "trial") return clinic.subscriptionStatus === "trial";
        if (filter === "deactivated") return clinic.status === "deactivated" || clinic.status === "blocked";
        return filter === "pending" ? isPendingStatus(clinic.status) : clinic.status === filter;
      })
      .filter((clinic) => {
        if (!query) return true;
        return [clinic.name, clinic.id, clinic.requestNumber, clinic.ownerEmail, clinic.ownerId, clinic.phone, clinic.address]
          .some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [clinics, filter, search]);

  const visibleIds = filteredClinics.map((clinic) => clinic.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedClinicIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const trialMutation = useMutation({
    mutationFn: ({ clinicId, days }: { clinicId: string; days: number }) =>
      customFetch(`/api/platform/clinics/${clinicId}/extend-trial`, {
        method: "POST",
        body: JSON.stringify({ days }),
      }),
    onSuccess: () => {
      setTrialClinic(null);
      setTrialDays("7");
      toast({ title: t("platformClinics.trialExtended") });
      queryClient.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
    },
    onError: () => toast({ title: t("platformClinics.trialFailed"), variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, clinicIds }: { action: BulkAction; clinicIds: string[] }) =>
      customFetch<{ updatedCount: number }>("/api/admin/clinics/bulk-action", {
        method: "POST",
        body: JSON.stringify({ action, clinicIds }),
      }),
    onSuccess: (result, variables) => {
      setSelectedClinicIds(new Set());
      toast({
        title: variables.action === "activate" ? t("platformClinics.bulkActivated") : t("platformClinics.bulkDeactivated"),
        description: `${result.updatedCount} ${t("platformClinics.selectedClinics")}`,
      });
      queryClient.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
    },
    onError: () => toast({ title: t("platformClinics.bulkFailed"), variant: "destructive" }),
  });

  const toggleClinic = (clinicId: string, checked: boolean) => {
    setSelectedClinicIds((current) => {
      const next = new Set(current);
      if (checked) next.add(clinicId);
      else next.delete(clinicId);
      return next;
    });
  };

  const toggleVisible = (checked: boolean) => {
    setSelectedClinicIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((clinicId) => checked ? next.add(clinicId) : next.delete(clinicId));
      return next;
    });
  };

  const runBulkAction = (action: BulkAction) => {
    const clinicIds = Array.from(selectedClinicIds);
    if (!clinicIds.length || bulkMutation.isPending) return;
    const confirmationKey = action === "activate" ? "platformClinics.confirmBulkActivate" : "platformClinics.confirmBulkDeactivate";
    if (!window.confirm(t(confirmationKey))) return;
    bulkMutation.mutate({ action, clinicIds });
  };

  const submitTrialExtension = () => {
    if (!trialClinic) return;
    const days = Number(trialDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      toast({ title: t("platformClinics.trialFailed"), variant: "destructive" });
      return;
    }
    trialMutation.mutate({ clinicId: trialClinic.id, days });
  };

  const counts = {
    all: clinics?.length ?? 0,
    active: clinics?.filter((clinic) => clinic.status === "active").length ?? 0,
    pending: clinics?.filter((clinic) => isPendingStatus(clinic.status)).length ?? 0,
    deactivated: clinics?.filter((clinic) => clinic.status === "blocked" || clinic.status === "deactivated").length ?? 0,
    trial: clinics?.filter((clinic) => clinic.subscriptionStatus === "trial").length ?? 0,
  };

  const exportClinics = () => {
    const header = ["Clinic", "Status", "Subscription", "Engagement score", "Created"];
    const rows = filteredClinics.map((clinic) => [clinic.name, clinic.status, clinic.subscriptionStatus, engagementByClinic.get(clinic.id)?.engagementScore ?? 0, clinic.createdAt]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "clinics-directory.csv"; link.click(); URL.revokeObjectURL(url);
  };

  const filters: Array<{ key: DirectoryFilter; label: string; count: number }> = [
    { key: "all", label: t("common.all"), count: counts.all },
    { key: "active", label: t("status.active"), count: counts.active },
    { key: "pending", label: t("status.pending"), count: counts.pending },
    { key: "deactivated", label: t("status.deactivated"), count: counts.deactivated },
    { key: "trial", label: t("plan.trial"), count: counts.trial },
  ];

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{t("platformClinics.title")}</h1></div><p className="mt-1 text-sm text-muted-foreground">{t("platformClinics.subtitle")}</p></div>
            <Button variant="outline" onClick={exportClinics}><Download className="me-2 h-4 w-4" />{t("platformClinics.export")}</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5"><Building2 className="h-4 w-4 text-primary" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinics.total")}</p><p className="mt-1 text-2xl font-bold">{counts.all}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><CheckCircle className="h-4 w-4 text-green-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinics.active")}</p><p className="mt-1 text-2xl font-bold text-green-600">{counts.active}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><Clock className="h-4 w-4 text-yellow-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinics.pending")}</p><p className="mt-1 text-2xl font-bold text-yellow-600">{counts.pending}</p></div>
            <div className="rounded-xl border border-border bg-card p-5"><Activity className="h-4 w-4 text-blue-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformClinics.trialClinics")}</p><p className="mt-1 text-2xl font-bold text-blue-600">{counts.trial}</p></div>
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-5 lg:flex-row lg:items-center">
              <div className="relative flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 ps-9" placeholder={t("platformClinics.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <div className="flex flex-wrap gap-2">{filters.map((item) => <Button key={item.key} size="sm" variant={filter === item.key ? "default" : "outline"} onClick={() => setFilter(item.key)}>{item.label}<span className="ms-1 text-xs opacity-70">{item.count}</span></Button>)}</div>
            </div>
            {selectedClinicIds.size > 0 && <div className="flex flex-col gap-3 border-b border-border bg-primary/5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm font-medium"><span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{selectedClinicIds.size}</span>{t("platformClinics.selectedClinics")}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => runBulkAction("activate")}><ShieldCheck className="me-2 h-4 w-4 text-green-600" />{t("platformClinics.bulkActivate")}</Button><Button size="sm" variant="outline" disabled={bulkMutation.isPending} onClick={() => runBulkAction("deactivate")}><ShieldOff className="me-2 h-4 w-4 text-amber-600" />{t("platformClinics.bulkDeactivate")}</Button><Button size="sm" variant="ghost" disabled={bulkMutation.isPending} onClick={() => setSelectedClinicIds(new Set())}><X className="me-2 h-4 w-4" />{t("platformClinics.clearSelection")}</Button></div></div>}
            {isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : filteredClinics.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">{t("platformClinics.empty")}</div> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-12 px-5 py-3 text-start"><Checkbox checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false} onCheckedChange={(checked) => toggleVisible(checked === true)} aria-label={t("platformClinics.selectAll")} /></th><th className="px-5 py-3 text-start">{t("platformClinics.clinic")}</th><th className="px-5 py-3 text-start">{t("platformClinics.status")}</th><th className="px-5 py-3 text-start">{t("platformClinics.subscription")}</th><th className="px-5 py-3 text-start">{t("platformClinics.engagement")}</th><th className="px-5 py-3 text-start">{t("platformClinics.activity")}</th><th className="px-5 py-3 text-end">{t("platformClinics.created")}</th><th className="px-5 py-3 text-end">{t("platformClinics.manage")}</th></tr></thead><tbody>{filteredClinics.map((clinic) => { const activity = engagementByClinic.get(clinic.id); const statusTone = clinic.status === "active" ? "green" : isPendingStatus(clinic.status) ? "yellow" : clinic.status === "blocked" || clinic.status === "deactivated" ? "yellow" : "muted"; const statusLabel = clinic.status === "blocked" || clinic.status === "deactivated" ? t("status.deactivated") : clinic.status === "active" ? t("status.active") : isPendingStatus(clinic.status) ? t("status.pending") : clinic.status; return <tr key={clinic.id} className={cn("border-t border-border hover:bg-muted/20", selectedClinicIds.has(clinic.id) && "bg-primary/5")}><td className="px-5 py-4"><Checkbox checked={selectedClinicIds.has(clinic.id)} onCheckedChange={(checked) => toggleClinic(clinic.id, checked === true)} aria-label={`${t("platformClinics.selectClinic")} ${clinic.name}`} /></td><td className="px-5 py-4"><p className="font-medium">{clinic.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{clinic.requestNumber || clinic.id.slice(0, 8)}{clinic.ownerEmail && <span className="ms-2">{clinic.ownerEmail}</span>}</p></td><td className="px-5 py-4"><Badge tone={statusTone}>{statusLabel}</Badge></td><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={clinic.subscriptionStatus === "premium" ? "blue" : clinic.subscriptionStatus === "expired" ? "red" : "muted"}>{clinic.subscriptionStatus}</Badge>{clinic.expiringSoon && <Badge tone="yellow"><AlertTriangle className="me-1 inline h-3 w-3" />{t("platformClinics.expiringSoon")}</Badge>}</div>{clinic.accessEndDate && <p className={cn("mt-1 text-xs", clinic.expiringSoon ? "font-medium text-amber-600" : "text-muted-foreground")}>{formatDate(clinic.accessEndDate)}{typeof clinic.daysUntilExpiry === "number" && clinic.daysUntilExpiry >= 0 ? ` · ${clinic.daysUntilExpiry} ${t("platformClinics.daysRemaining")}` : ""}</p>}</td><td className="px-5 py-4"><div className="space-y-2"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", (activity?.engagementScore ?? 0) >= 75 ? "bg-green-500" : (activity?.engagementScore ?? 0) >= 45 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${activity?.engagementScore ?? 0}%` }} /></div><span className="text-xs font-semibold">{activity?.engagementScore ?? 0}/100</span></div><Badge tone={engagementTone(activity?.engagementLevel)}>{engagementLabel(activity?.engagementLevel)}</Badge></div></td><td className="px-5 py-4 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{activity?.patientCount ?? 0} {t("platformClinics.patients")}</span><span>{activity?.recentPatients ?? 0} {t("platformClinics.newPatients")}</span><span>{activity?.recentAppointments ?? 0} {t("platformClinics.appointments30d")}</span></div></td><td className="px-5 py-4 text-end text-xs text-muted-foreground">{formatDate(clinic.createdAt)}</td><td className="px-5 py-4 text-end"><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setTrialClinic(clinic); setTrialDays("7"); }}><RefreshCw className="me-2 h-3.5 w-3.5" />{t("platformClinics.extendTrial")}</Button><Button size="sm" variant="outline" onClick={() => setLocation(`/platform-clinics/${clinic.id}`)}>{t("platformClinics.manage")}<ArrowRight className="ms-2 h-3.5 w-3.5" /></Button></div></td></tr>; })}</tbody></table></div>
            )}
          </section>

          <Dialog open={Boolean(trialClinic)} onOpenChange={(open) => { if (!open && !trialMutation.isPending) setTrialClinic(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("platformClinics.extendTrialTitle")}</DialogTitle>
                <DialogDescription>{t("platformClinics.extendTrialDescription")} {trialClinic?.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor="directory-trial-days" className="text-sm font-medium">{t("platformClinics.trialDays")}</label>
                <Input id="directory-trial-days" type="number" min="1" max="90" step="1" value={trialDays} placeholder={t("platformClinics.trialDaysPlaceholder")} onChange={(event) => setTrialDays(event.target.value)} />
                <p className="text-xs text-muted-foreground">1–90 days</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTrialClinic(null)} disabled={trialMutation.isPending}>{t("common.cancel")}</Button>
                <Button type="button" onClick={submitTrialExtension} disabled={trialMutation.isPending || !Number.isInteger(Number(trialDays)) || Number(trialDays) < 1 || Number(trialDays) > 90}><RefreshCw className={cn("me-2 h-4 w-4", trialMutation.isPending && "animate-spin")} />{t("platformClinics.extend")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
