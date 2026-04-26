import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  customFetch,
  useAdminListClinics, useAdminActivateClinic, useAdminBlockClinic,
  useAdminConfirmSubscription, getAdminListClinicsQueryKey,
  useAdminGetClinicDetail,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
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

const PLAN_META: Record<PlanKey, { label: string; Icon: typeof Crown; tone: string; sub: string }> = {
  trial: { label: "Free Trial", Icon: Hourglass, tone: "from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-400 ring-blue-500/20", sub: "15-day evaluation" },
  basic: { label: "Basic Plan", Icon: Sparkle, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20", sub: "200 EGP / month" },
  premium: { label: "Premium Plan", Icon: Crown, tone: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400 ring-amber-500/20", sub: "400 EGP / month" },
};

// ---------- Page ----------
type FilterTab = "all" | "pending" | "trial" | "active" | "blocked";

export default function AdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currency: { code: currencyCode } } = useCurrency();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [planView, setPlanView] = useState<PlanKey | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // Existing data + new endpoints (raw fetch)
  const { data: clinics, isLoading: clinicsLoading } = useAdminListClinics({
    query: { queryKey: getAdminListClinicsQueryKey() },
  });
  const statsQ = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => customFetch<AdminStats>("/api/admin/stats"),
  });
  const subsQ = useQuery<AdminSubscription[]>({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: () => customFetch<AdminSubscription[]>("/api/admin/subscriptions"),
  });

  const activateMutation = useAdminActivateClinic();
  const blockMutation = useAdminBlockClinic();
  const confirmMutation = useAdminConfirmSubscription();

  function refetchAll() {
    qc.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
    qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
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

  const pendingClinics = (clinics ?? []).filter(c => c.status === "pending");
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
    { key: "all", label: "All", count: clinics?.length ?? 0 },
    { key: "pending", label: "Pending", count: stats?.byStatus.pending ?? 0 },
    { key: "trial", label: "Trial", count: stats?.bySub.trial ?? 0 },
    { key: "active", label: "Active", count: stats?.byStatus.active ?? 0 },
    { key: "blocked", label: "Blocked", count: stats?.byStatus.blocked ?? 0 },
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
              <h1 className="text-2xl font-bold">Platform Admin</h1>
              <p className="text-sm text-muted-foreground">Overview of all clinics, subscriptions, and platform activity</p>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Building2} label="Clinics" value={stats?.totalClinics ?? "—"}
              sub={stats ? `${stats.byStatus.active} active` : undefined} />
            <StatCard icon={Users} label="Users" value={stats?.totalUsers ?? "—"}
              sub={stats ? `${stats.totalPatients} patients` : undefined} />
            <StatCard icon={Sparkles} label="New (7d)" value={stats?.newSignupsWeek ?? "—"}
              tone="success" />
            <StatCard icon={Clock} label="Trial ending ≤3d" value={stats?.trialEndingSoon ?? "—"}
              tone={stats && stats.trialEndingSoon > 0 ? "warn" : "default"} />
            <StatCard icon={CreditCard} label="Pending payments" value={stats?.pendingPayments ?? "—"}
              tone={stats && stats.pendingPayments > 0 ? "warn" : "default"} />
            <StatCard icon={TrendingUp} label="Revenue (confirmed)"
              value={stats ? `${Math.round(stats.confirmedRevenue).toLocaleString()}` : "—"}
              sub={currencyCode} tone="success" />
          </div>

          {/* Monthly revenue */}
          <MonthlyRevenuePanel
            data={stats?.revenueByMonth ?? []}
            currentMonthRevenue={stats?.currentMonthRevenue ?? 0}
            currencyCode={currencyCode}
            isLoading={statsQ.isLoading}
          />

          {/* Subscribers by Plan */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Subscribers by Plan
              </h2>
              <p className="text-xs text-muted-foreground">Click a plan to see its subscribers</p>
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
                    data-testid={`plan-card-${key}`}
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

          {/* Action lanes: Pending activations + Pending payments */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Pending activations */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <h2 className="text-sm font-semibold">Pending Activations</h2>
                <span className="text-xs text-muted-foreground ms-auto">{pendingClinics.length}</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {clinicsLoading ? (
                  <div className="p-4"><Skeleton className="h-12 w-full" /></div>
                ) : pendingClinics.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">All caught up — no pending activations.</div>
                ) : pendingClinics.map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">Registered {formatDate(c.createdAt)}</p>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleActivate(c.id)}
                      disabled={activateMutation.isPending}
                      className="text-green-700 border-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                      data-testid={`pending-activate-${c.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Activate
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending payments */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-yellow-600" />
                <h2 className="text-sm font-semibold">Pending Payments</h2>
                <span className="text-xs text-muted-foreground ms-auto">{pendingSubs.length}</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {subsQ.isLoading ? (
                  <div className="p-4"><Skeleton className="h-12 w-full" /></div>
                ) : pendingSubs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No payments awaiting confirmation.</div>
                ) : pendingSubs.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{s.clinicName}</p>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {s.planType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.amount} {currencyCode} · submitted {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleConfirmPayment(s.clinicId)}
                      disabled={confirmMutation.isPending}
                      data-testid={`pay-confirm-${s.clinicId}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Confirm
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Clinics table with filters */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold mr-1">All Clinics</h2>
              <div className="flex flex-wrap gap-1">
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      tab === t.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                    data-testid={`tab-${t.key}`}
                  >
                    {t.label} <span className="opacity-70">· {t.count}</span>
                  </button>
                ))}
              </div>
              <div className="ms-auto relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search clinic name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-xs h-8 ps-8 pe-3 rounded-md border border-border bg-background w-48 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  data-testid="input-clinic-search"
                />
              </div>
            </div>

            {clinicsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 border-b border-border last:border-0"><Skeleton className="h-12 w-full" /></div>
              ))
            ) : filteredClinics.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No clinics match this filter.</div>
            ) : (
              filteredClinics.map(clinic => {
                const subForClinic = subs.find(s => s.clinicId === clinic.id && s.paymentStatus === "pending");
                return (
                  <div key={clinic.id} data-testid={`clinic-row-${clinic.id}`} className="px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20">
                    <div className="flex flex-wrap items-start gap-4 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-sm">{clinic.name}</p>
                          <StatusBadge status={clinic.status} />
                          <SubBadge status={clinic.subscriptionStatus} />
                          {subForClinic && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              ⏳ Payment pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Registered: {formatDate(clinic.createdAt)}
                          {clinic.subscriptionStatus === "trial" && ` · Trial ends: ${formatDate(clinic.trialEndDate)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {clinic.status !== "active" && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleActivate(clinic.id)}
                            disabled={activateMutation.isPending}
                            className="text-green-700 border-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                            data-testid={`activate-clinic-${clinic.id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Activate
                          </Button>
                        )}
                        {clinic.status === "active" && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleBlock(clinic.id)}
                            disabled={blockMutation.isPending}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            data-testid={`block-clinic-${clinic.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />Block
                          </Button>
                        )}
                        {subForClinic && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleConfirmPayment(clinic.id)}
                            disabled={confirmMutation.isPending}
                            data-testid={`confirm-payment-${clinic.id}`}
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1.5" />Confirm Payment
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Recent subscription history */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Subscription History</h2>
              <span className="text-xs text-muted-foreground ms-auto">{subs.length} total</span>
            </div>
            {subsQ.isLoading ? (
              <div className="p-4"><Skeleton className="h-20 w-full" /></div>
            ) : subs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No subscription records yet.</div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {subs.slice(0, 20).map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{s.clinicName}</p>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {s.planType}
                        </span>
                        <span className={cn(
                          "text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
                          s.paymentStatus === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          s.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {s.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)} · created {formatDate(s.createdAt)}
                      </p>
                    </div>
                    <div className="text-sm font-mono text-foreground/80 shrink-0">
                      {s.amount} {currencyCode}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan subscribers list dialog */}
        <Dialog open={planView !== null} onOpenChange={(open) => !open && setPlanView(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {planView && (() => {
              const meta = PLAN_META[planView];
              const list = (clinicsByPlan[planView] ?? []).slice().sort(
                (a, b) => b.createdAt.localeCompare(a.createdAt)
              );
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <meta.Icon className="w-5 h-5" />
                      {meta.label} Subscribers
                      <span className="text-xs font-normal text-muted-foreground ms-1">
                        · {list.length} clinic{list.length === 1 ? "" : "s"}
                      </span>
                    </DialogTitle>
                    <DialogDescription>
                      Click any clinic to see its full data, owner, and subscription history.
                    </DialogDescription>
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
                          data-testid={`plan-subscriber-${c.id}`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">{c.name}</p>
                              <StatusBadge status={c.status} />
                              <SubBadge status={c.subscriptionStatus} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Joined {formatDate(c.createdAt)}
                              {c.subscriptionStatus === "trial" &&
                                ` · Trial ends ${formatDate(c.trialEndDate)}`}
                            </p>
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
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ClinicDetailDialog({
  clinicId,
  onClose,
  currencyCode,
}: {
  clinicId: string | null;
  onClose: () => void;
  currencyCode: string;
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
            {data?.clinic.name ?? "Clinic Details"}
          </DialogTitle>
          <DialogDescription>
            Full subscriber profile, including owner, team, usage, and payments.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6 space-y-5 pb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading clinic details…
            </div>
          ) : isError || !data ? (
            <p className="py-8 text-center text-sm text-destructive">Couldn't load clinic details.</p>
          ) : (
            <>
              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={data.clinic.status} />
                <SubBadge status={data.clinic.subscriptionStatus} />
                {data.clinic.subscriptionStatus === "trial" && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Trial ends {formatDate(data.clinic.trialEndDate)}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  Joined {formatDate(data.clinic.createdAt)}
                </span>
              </div>

              {/* Owner */}
              <section>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Owner
                </h3>
                {data.owner ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
                      {data.owner.name}
                      {data.owner.isBlocked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                          blocked
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3 h-3" /> {data.owner.email}
                    </p>
                    {data.owner.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3 h-3" /> {data.owner.phone}
                      </p>
                    )}
                    {data.owner.specialty && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Stethoscope className="w-3 h-3" /> {data.owner.specialty}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Owner record missing.</p>
                )}
              </section>

              {/* Counts */}
              <section>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Usage
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <CountTile icon={Users} label="Team members" value={data.counts.members} />
                  <CountTile icon={Users} label="Patients" value={data.counts.patients} />
                  <CountTile icon={CalendarDays} label="Appointments" value={data.counts.appointments} />
                </div>
                {Object.keys(data.counts.membersByRole).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(data.counts.membersByRole).map(([role, n]) => (
                      <span key={role} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                        {n} {role}{n === 1 ? "" : "s"}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Team members */}
              {data.members.length > 0 && (
                <section>
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                    Team Members ({data.members.length})
                  </h3>
                  <div className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto">
                    {data.members.map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Revenue & subscriptions */}
              <section>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Subscriptions
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <CountTile
                    icon={TrendingUp}
                    label="Confirmed revenue"
                    value={`${Math.round(data.revenue.totalConfirmed).toLocaleString()} ${currencyCode}`}
                  />
                  <CountTile
                    icon={Clock}
                    label="Last payment"
                    value={data.revenue.lastConfirmedPayment ? formatDate(data.revenue.lastConfirmedPayment) : "—"}
                  />
                </div>
                {data.subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subscription history yet.</p>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border max-h-60 overflow-y-auto">
                    {data.subscriptions.map((s) => (
                      <div key={s.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {s.planType}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] uppercase font-medium px-1.5 py-0.5 rounded",
                                s.paymentStatus === "confirmed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : s.paymentStatus === "pending"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : "bg-muted text-muted-foreground"
                              )}
                            >
                              {s.paymentStatus}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(s.startDate)} → {formatDate(s.endDate)}
                          </p>
                        </div>
                        <div className="text-sm font-mono shrink-0">
                          {s.amount} {currencyCode}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMonthLabel(month: string, opts: { short?: boolean } = {}): string {
  const [yearStr, monthStr] = month.split("-");
  const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1));
  return d.toLocaleString(undefined, {
    month: opts.short ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MonthlyRevenuePanel({
  data,
  currentMonthRevenue,
  currencyCode,
  isLoading,
}: {
  data: MonthlyRevenue[];
  currentMonthRevenue: number;
  currencyCode: string;
  isLoading: boolean;
}) {
  const chartData = useMemo(
    () => data.map((d, idx) => ({
      ...d,
      label: formatMonthLabel(d.month, { short: true }),
      isCurrent: idx === data.length - 1,
    })),
    [data],
  );
  const last3 = data.slice(-3).reduce((sum, d) => sum + d.amount, 0);
  const last12 = data.reduce((sum, d) => sum + d.amount, 0);
  const bestMonth = data.reduce<MonthlyRevenue | null>(
    (best, d) => (best === null || d.amount > best.amount ? d : best),
    null,
  );
  const fmt = (n: number) =>
    `${Math.round(n).toLocaleString()} ${currencyCode}`;

  const currentMonthLabel = data.length
    ? formatMonthLabel(data[data.length - 1]!.month)
    : "This month";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Monthly Revenue</h2>
        <span className="text-xs text-muted-foreground ms-auto">
          Confirmed payments · last 12 months
        </span>
      </div>

      {isLoading ? (
        <div className="p-5"><Skeleton className="h-48 w-full" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">
            <div className="p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {currentMonthLabel}
              </p>
              <p className="text-2xl font-bold mt-1 text-primary">
                {fmt(currentMonthRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data[data.length - 1]?.count ?? 0} payment(s) this month
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Last 3 months
              </p>
              <p className="text-2xl font-bold mt-1">{fmt(last3)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avg {fmt(last3 / 3)} / month
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Best month
              </p>
              <p className="text-2xl font-bold mt-1">
                {bestMonth && bestMonth.amount > 0 ? fmt(bestMonth.amount) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bestMonth && bestMonth.amount > 0
                  ? formatMonthLabel(bestMonth.month)
                  : "No revenue yet"}
              </p>
            </div>
          </div>

          <div className="p-5">
            {last12 === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No confirmed payments yet — charts will populate once subscriptions are confirmed.
              </div>
            ) : (
              <>
                <div className="h-56 -ms-2" data-testid="chart-monthly-revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                        width={48}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number, _name, ctx) => [
                          `${fmt(value)} (${ctx.payload.count} payment${ctx.payload.count === 1 ? "" : "s"})`,
                          "Revenue",
                        ]}
                        labelFormatter={(_l, items) =>
                          items?.[0]?.payload ? formatMonthLabel(items[0].payload.month) : ""
                        }
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.month}
                            fill={entry.isCurrent ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-start font-medium py-2">Month</th>
                        <th className="text-end font-medium py-2">Payments</th>
                        <th className="text-end font-medium py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...data].reverse().map((row, idx) => (
                        <tr
                          key={row.month}
                          className={cn(idx === 0 && "bg-primary/5")}
                          data-testid={`revenue-row-${row.month}`}
                        >
                          <td className="py-2 font-medium">
                            {formatMonthLabel(row.month)}
                            {idx === 0 && (
                              <span className="ms-2 text-[10px] uppercase font-semibold text-primary">
                                current
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-end text-muted-foreground">{row.count}</td>
                          <td className="py-2 text-end font-mono">{fmt(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td className="py-2 font-semibold text-sm">12-month total</td>
                        <td className="py-2 text-end text-muted-foreground">
                          {data.reduce((sum, d) => sum + d.count, 0)}
                        </td>
                        <td className="py-2 text-end font-mono font-semibold">{fmt(last12)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CountTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-lg font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}
