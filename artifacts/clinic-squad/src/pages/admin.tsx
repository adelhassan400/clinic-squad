import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  customFetch,
  useAdminListClinics, useAdminActivateClinic, useAdminBlockClinic,
  useAdminConfirmSubscription, getAdminListClinicsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, CheckCircle, XCircle, CreditCard, Users, Building2,
  AlertTriangle, TrendingUp, Clock, Sparkles, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Types ----------
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

// ---------- Page ----------
type FilterTab = "all" | "pending" | "trial" | "active" | "blocked";

export default function AdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currency: { code: currencyCode } } = useCurrency();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

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
      </DashboardLayout>
    </ProtectedRoute>
  );
}
