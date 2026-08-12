import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import {
  customFetch,
  useAdminListClinics, useAdminActivateClinic, useAdminBlockClinic,
  useAdminConfirmSubscription, getAdminListClinicsQueryKey,
  useAdminGetClinicDetail,
  useAdminListPendingClinics, getAdminListPendingClinicsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Shield, CheckCircle, XCircle, CreditCard, Users, Building2,
  AlertTriangle, TrendingUp, Clock, Sparkles, Search, ChevronRight,
  Crown, Sparkle, Hourglass, Mail, Phone, Stethoscope, Loader2,
  CalendarDays, UserCog, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ---------- Types ----------
interface MonthlyRevenue {
  month: string; // "YYYY-MM"
  amount: number;
  count: number;
}
interface AdminStats {
  totalClinics: number;
  totalUsers: number;
  totalPatients: number;
  byStatus: Record<string, number>;
  bySub: Record<string, number>;
  trialEndingSoon: number;
  newSignupsWeek: number;
  pendingPayments: number;
  confirmedRevenue: number;
  currentMonthRevenue: number;
  revenueByMonth: MonthlyRevenue[];
  revenueRange: { mode: "rolling12" } | { mode: "year"; year: number };
  availableYears: number[];
}
interface AdminSubscription {
  id: string; clinicId: string; clinicName: string; planType: string;
  startDate: string; endDate: string; paymentStatus: string;
  amount: number; createdAt: string;
}

// ---------- Tiny UI helpers ----------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    deleted: "bg-muted text-muted-foreground",
  };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", map[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}
function SubBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    basic: "bg-secondary text-secondary-foreground",
    premium: "bg-accent/20 text-accent-foreground",
    expired: "bg-destructive/20 text-destructive",
  };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", map[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}

function StatCard({
  icon: Icon, label, value, sub, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warn" | "success" | "danger";
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    warn: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    success: "bg-green-500/15 text-green-700 dark:text-green-400",
    danger: "bg-red-500/15 text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", toneCls)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

type PlanKey = "trial" | "basic" | "premium";

// ---------- Page ----------
type FilterTab = "all" | "pending" | "trial" | "active" | "blocked";

export default function AdminPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currency: { code: currencyCode } } = useCurrency();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [planView, setPlanView] = useState<PlanKey | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [revenueYear, setRevenueYear] = useState<number | "rolling12">("rolling12");

  const PLAN_META: Record<PlanKey, { label: string; Icon: typeof Crown; tone: string; sub: string }> = {
    trial: { label: t("plan.trial"), Icon: Hourglass, tone: "from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-400 ring-blue-500/20", sub: "15-day evaluation" },
    basic: { label: t("plan.basic"), Icon: Sparkle, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20", sub: "200 EGP / month" },
    premium: { label: t("plan.premium"), Icon: Crown, tone: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400 ring-amber-500/20", sub: "400 EGP / month" },
  };

  // Existing data + new endpoints (raw fetch)
  const { data: clinics, isLoading: clinicsLoading } = useAdminListClinics({
    query: { queryKey: getAdminListClinicsQueryKey() },
  });
  const statsQ = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats", revenueYear],
    queryFn: () =>
      customFetch<AdminStats>(
        revenueYear === "rolling12"
          ? "/api/admin/stats"
          : `/api/admin/stats?year=${revenueYear}`,
      ),
  });
  const subsQ = useQuery<AdminSubscription[]>({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: () => customFetch<AdminSubscription[]>("/api/admin/subscriptions"),
  });
  const pendingApprovalsQ = useAdminListPendingClinics({
    query: { queryKey: getAdminListPendingClinicsQueryKey() },
  });
  const pendingApprovals = pendingApprovalsQ.data ?? [];

  const activateMutation = useAdminActivateClinic();
  const blockMutation = useAdminBlockClinic();
  const confirmMutation = useAdminConfirmSubscription();

  function refetchAll() {
    qc.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
    qc.invalidateQueries({ queryKey: getAdminListPendingClinicsQueryKey() });
    qc.invalidateQueries({ queryKey: ["/api/admin/stats"], exact: false });
    qc.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
  }

  const handleActivate = (clinicId: string) =>
    activateMutation.mutate({ clinicId }, {
      onSuccess: () => { toast({ title: "Clinic activated" }); refetchAll(); },
      onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
    });
  const handleBlock = (clinicId: string) => {
    if (!confirm("Block this clinic?")) return;
    blockMutation.mutate({ clinicId }, {
      onSuccess: () => { toast({ title: "Clinic blocked" }); refetchAll(); },
      onError: () => toast({ title: "Failed to block", variant: "destructive" }),
    });
  };
  const handleConfirmPayment = (clinicId: string) =>
    confirmMutation.mutate({ clinicId }, {
      onSuccess: () => { toast({ title: "Payment confirmed & subscription activated" }); refetchAll(); },
      onError: () => toast({ title: "Failed to confirm payment", variant: "destructive" }),
    });

  const stats = statsQ.data;
  const subs = subsQ.data ?? [];
  const pendingSubs = subs.filter(s => s.paymentStatus === "pending");

  const clinicsByPlan = useMemo(() => {
    const groups: Record<PlanKey, typeof clinics> = { trial: [], basic: [], premium: [] };
    for (const c of clinics ?? []) {
      const key = c.subscriptionStatus as PlanKey;
      if (key === "trial" || key === "basic" || key === "premium") {
        groups[key]!.push(c);
      }
    }
    return groups;
  }, [clinics]);

  const filteredClinics = useMemo(() => {
    let list = clinics ?? [];
    if (tab !== "all") {
      if (tab === "pending") list = list.filter(c => c.status === "pending");
      else if (tab === "blocked") list = list.filter(c => c.status === "blocked");
      else if (tab === "active") list = list.filter(c => c.status === "active");
      else if (tab === "trial") list = list.filter(c => c.subscriptionStatus === "trial");
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [clinics, tab, search]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: t("common.all"), count: clinics?.length ?? 0 },
    { key: "pending", label: t("status.pending"), count: stats?.byStatus.pending ?? 0 },
    { key: "trial", label: t("plan.trial"), count: stats?.bySub.trial ?? 0 },
    { key: "active", label: t("status.active"), count: stats?.byStatus.active ?? 0 },
    { key: "blocked", label: t("status.blocked"), count: stats?.byStatus.blocked ?? 0 },
  ];

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Building2} label={t("insights.metric.clinics")} value={stats?.totalClinics ?? "—"}
              sub={stats ? `${stats.byStatus.active} active` : undefined} />
            <StatCard icon={Users} label={t("insights.metric.users")} value={stats?.totalUsers ?? "—"}
              sub={stats ? `${stats.totalPatients} patients` : undefined} />
            <StatCard icon={Sparkles} label={t("admin.metric.newSignups")} value={stats?.newSignupsWeek ?? "—"}
              tone="success" />
            <StatCard icon={Clock} label={t("admin.metric.trialEnding")} value={stats?.trialEndingSoon ?? "—"}
              tone={stats && stats.trialEndingSoon > 0 ? "warn" : "default"} />
            <StatCard icon={CreditCard} label={t("admin.metric.pendingPayments")} value={stats?.pendingPayments ?? "—"}
              tone={stats && stats.pendingPayments > 0 ? "warn" : "default"} />
            <StatCard icon={TrendingUp} label={t("admin.metric.confirmedRevenue")}
              value={stats ? `${Math.round(stats.confirmedRevenue).toLocaleString()}` : "—"}
              sub={currencyCode} tone="success" />
          </div>

          {/* Pending Approvals */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">{t("admin.pending.title")}</h2>
              <span className="text-xs text-muted-foreground ms-auto">{pendingApprovals.length} {t("admin.pending.waiting")}</span>
            </div>
            {pendingApprovalsQ.isLoading ? (
              <div className="p-4"><Skeleton className="h-20 w-full" /></div>
            ) : pendingApprovals.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("admin.pending.empty")}</div>
            ) : (
              <div className="divide-y divide-border">
                {pendingApprovals.map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{t("admin.pending.joined")} {formatDate(c.createdAt)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleActivate(c.id)}
                      disabled={activateMutation.isPending}
                    >
                      {activateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                      {t("admin.pending.activate")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subscribers by Plan */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t("admin.plans.title")}
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {(["trial", "basic", "premium"] as PlanKey[]).map((key) => {
                const meta = PLAN_META[key];
                const count = clinicsByPlan[key]?.length ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlanView(key)}
                    disabled={clinicsLoading}
                    className={cn(
                      "group text-start rounded-xl border border-border bg-gradient-to-br p-5 ring-1 ring-inset transition hover:shadow-md hover:-translate-y-0.5",
                      meta.tone,
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-card/80 flex items-center justify-center">
                        <meta.Icon className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </div>
                    <p className="mt-4 text-3xl font-bold text-foreground">
                      {clinicsLoading ? "—" : count}
                    </p>
                    <p className="text-sm font-semibold mt-0.5 text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action lanes */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Pending payments */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("admin.payments.title")}</h2>
                <span className="text-xs text-muted-foreground ms-auto">{pendingSubs.length} {t("admin.payments.pending")}</span>
              </div>
              {subsQ.isLoading ? (
                <div className="p-4"><Skeleton className="h-20 w-full" /></div>
              ) : pendingSubs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">{t("admin.payments.empty")}</div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingSubs.map(s => (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.clinicName}</p>
                        <p className="text-xs text-muted-foreground">{s.planType} · {s.amount} {currencyCode}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirmPayment(s.clinicId)}
                        disabled={confirmMutation.isPending}
                      >
                        {t("admin.payments.confirm")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent subscription history */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">{t("admin.history.title")}</h2>
              </div>
              <div className="divide-y divide-border max-h-60 overflow-y-auto">
                {subs.slice(0, 10).map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.clinicName}</p>
                      <p className="text-xs text-muted-foreground">{s.planType} · {s.paymentStatus}</p>
                    </div>
                    <span className="text-xs font-mono">{s.amount} {currencyCode}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Plan subscribers list dialog */}
        <Dialog open={planView !== null} onOpenChange={(open) => !open && setPlanView(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {planView && (() => {
              const meta = PLAN_META[planView];
              const list = clinicsByPlan[planView] ?? [];
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <meta.Icon className="w-5 h-5" />
                      {meta.label} {t("insights.metric.clinics")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="overflow-y-auto -mx-6 px-6 divide-y divide-border">
                    {list.length === 0 ? (
                      <div className="py-12 text-center text-sm text-muted-foreground">
                        No clinics on this plan yet.
                      </div>
                    ) : (
                      list.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClinicId(c.id);
                            setPlanView(null);
                          }}
                          className="w-full text-start py-3 flex items-center gap-3 hover:bg-muted/30 -mx-2 px-2 rounded-md transition"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{t("admin.pending.joined")} {formatDate(c.createdAt)}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Single clinic detail dialog */}
        <ClinicDetailDialog
          clinicId={selectedClinicId}
          onClose={() => setSelectedClinicId(null)}
          currencyCode={currencyCode}
          t={t}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ClinicDetailDialog({
  clinicId,
  onClose,
  currencyCode,
  t,
}: {
  clinicId: string | null;
  onClose: () => void;
  currencyCode: string;
  t: any;
}) {
  const { data, isLoading, isError } = useAdminGetClinicDetail(clinicId ?? "", {
    query: { enabled: !!clinicId },
  });

  return (
    <Dialog open={clinicId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {data?.clinic.name ?? t("admin.clinic.details")}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6 space-y-5 pb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("presc.saving")}
            </div>
          ) : isError || !data ? (
            <p className="py-8 text-center text-sm text-destructive">Couldn't load clinic details.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={data.clinic.status} />
                <SubBadge status={data.clinic.subscriptionStatus} />
              </div>

              <section>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  {t("admin.clinic.owner")}
                </h3>
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5 text-sm">
                  <p className="font-semibold">{data.owner?.name}</p>
                  <p className="text-muted-foreground">{data.owner?.email}</p>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  {t("admin.clinic.usage")}
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg border border-border bg-muted/10">
                    <p className="text-lg font-bold">{data.counts.members}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("sidebar.team")}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/10">
                    <p className="text-lg font-bold">{data.counts.patients}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("sidebar.patients")}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/10">
                    <p className="text-lg font-bold">{data.counts.appointments}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("sidebar.appointments")}</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
