import { useState, useMemo, useEffect } from "react";
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
  CalendarDays, UserCog, BarChart3, History, Settings, Megaphone, Tag, Activity, Save, Plus, Power, Download,
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
  billingPeriod?: string; durationMonths?: string;
  startDate: string; endDate: string; paymentStatus: string;
  amount: number; paymentProof?: string | null; transactionReference?: string | null;
  createdAt: string;
}
interface PlatformSettings { basicMonthlyPrice: string; premiumMonthlyPrice: string; vodafoneCashNumber: string; instapayHandle: string; whatsappNumber: string; updatedAt?: string; }
interface BroadcastMessage { id: string; title: string; message: string; active: boolean; createdAt: string; }
interface PromoCode { id: string; code: string; discountPercent: number; active: boolean; expiresAt: string | null; createdAt: string; }
interface EngagementRow { clinicId: string; clinicName: string; subscriptionStatus: string; patientCount: number; recentAppointments: number; engagementScore: number; }
interface AuditLog { id: string; adminEmail: string; action: string; details: string; createdAt: string; }

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
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>({ basicMonthlyPrice: "200", premiumMonthlyPrice: "400", vodafoneCashNumber: "01000000000", instapayHandle: "clinicsquad@instapay", whatsappNumber: "201000000000" });
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "" });
  const [promoForm, setPromoForm] = useState({ code: "", discountPercent: "10", expiresAt: "" });

  const PLAN_META: Record<PlanKey, { label: string; Icon: typeof Crown; tone: string; sub: string }> = {
    trial: { label: t("plan.trial"), Icon: Hourglass, tone: "from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-400 ring-blue-500/20", sub: t("plan.trial.desc") },
    basic: { label: t("plan.basic"), Icon: Sparkle, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20", sub: t("plan.basic.desc") },
    premium: { label: t("plan.premium"), Icon: Crown, tone: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-400 ring-amber-500/20", sub: t("plan.premium.desc") },
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
  const settingsQ = useQuery<PlatformSettings>({ queryKey: ["/api/platform/settings"], queryFn: () => customFetch<PlatformSettings>("/api/platform/settings") });
  const messagesQ = useQuery<BroadcastMessage[]>({ queryKey: ["/api/platform/messages"], queryFn: () => customFetch<BroadcastMessage[]>("/api/platform/messages") });
  const promoQ = useQuery<PromoCode[]>({ queryKey: ["/api/platform/promo-codes"], queryFn: () => customFetch<PromoCode[]>("/api/platform/promo-codes") });
  const engagementQ = useQuery<EngagementRow[]>({ queryKey: ["/api/platform/engagement"], queryFn: () => customFetch<EngagementRow[]>("/api/platform/engagement") });
  const auditQ = useQuery<AuditLog[]>({ queryKey: ["/api/platform/audit-logs"], queryFn: () => customFetch<AuditLog[]>("/api/platform/audit-logs") });
  useEffect(() => { if (settingsQ.data) setSettingsForm({ basicMonthlyPrice: settingsQ.data.basicMonthlyPrice, premiumMonthlyPrice: settingsQ.data.premiumMonthlyPrice, vodafoneCashNumber: settingsQ.data.vodafoneCashNumber, instapayHandle: settingsQ.data.instapayHandle, whatsappNumber: settingsQ.data.whatsappNumber }); }, [settingsQ.data]);

  const activateMutation = useAdminActivateClinic();
  const blockMutation = useAdminBlockClinic();
  const confirmMutation = useAdminConfirmSubscription();
  const [savingTools, setSavingTools] = useState(false);
  const savePlatformSettings = async () => {
    setSavingTools(true);
    try { await customFetch("/api/platform/settings", { method: "PUT", body: JSON.stringify(settingsForm) }); toast({ title: "Global settings saved" }); qc.invalidateQueries({ queryKey: ["/api/platform/settings"] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: "Could not save settings", variant: "destructive" }); } finally { setSavingTools(false); }
  };
  const createBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    try { await customFetch("/api/platform/messages", { method: "POST", body: JSON.stringify(broadcastForm) }); setBroadcastForm({ title: "", message: "" }); toast({ title: "Broadcast published" }); qc.invalidateQueries({ queryKey: ["/api/platform/messages"] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: "Could not publish broadcast", variant: "destructive" }); }
  };
  const createPromo = async () => {
    if (!promoForm.code.trim()) return;
    try { await customFetch("/api/platform/promo-codes", { method: "POST", body: JSON.stringify({ ...promoForm, discountPercent: Number(promoForm.discountPercent), expiresAt: promoForm.expiresAt || undefined }) }); setPromoForm({ code: "", discountPercent: "10", expiresAt: "" }); toast({ title: "Promo code created" }); qc.invalidateQueries({ queryKey: ["/api/platform/promo-codes"] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: "Could not create promo code", variant: "destructive" }); }
  };
  const togglePlatformItem = async (kind: "messages" | "promo-codes", id: string, active: boolean) => {
    try { await customFetch(`/api/platform/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ active: !active }) }); qc.invalidateQueries({ queryKey: [`/api/platform/${kind}`] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: "Could not update item", variant: "destructive" }); }
  };

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
  const [approvalDurations, setApprovalDurations] = useState<Record<string, number>>({});
  const handleConfirmPayment = (clinicId: string, subscriptionId: string) => {
    const months = approvalDurations[subscriptionId] || 1;
    confirmMutation.mutate({
      clinicId,
      data: { subscriptionId, durationMonths: months } as any
    }, {
      onSuccess: () => { toast({ title: "Payment confirmed & subscription activated" }); refetchAll(); },
      onError: () => toast({ title: "Failed to confirm payment", variant: "destructive" }),
    });
  };

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

  const exportClinics = () => {
    const header = ["Clinic", "Status", "Subscription", "Created"];
    const rows = filteredClinics.map((clinic) => [clinic.name, clinic.status, clinic.subscriptionStatus, clinic.createdAt]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "clinics.csv"; link.click(); URL.revokeObjectURL(url);
  };

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
              sub={stats ? `${stats.byStatus.active} ${t("status.active")}` : undefined} />
            <StatCard icon={Users} label={t("insights.metric.users")} value={stats?.totalUsers ?? "—"}
              sub={stats ? `${stats.totalPatients} ${t("status.patients")}` : undefined} />
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
                    <div key={s.id} className="px-5 py-4 space-y-3 hover:bg-muted/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">{s.clinicName}</p>
                          <p className="text-xs text-muted-foreground capitalize">Plan: {s.planType} ({s.billingPeriod || "monthly"}) · Amount: <strong>{s.amount} {currencyCode}</strong></p>
                          {s.transactionReference && (
                            <p className="text-xs text-primary mt-1 font-mono">Ref: {s.transactionReference}</p>
                          )}
                          {s.paymentProof && (
                            s.paymentProof.startsWith("data:image/") ? (
                              <a href={s.paymentProof} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-muted/20 p-1.5 hover:bg-muted/40" aria-label="Open payment receipt screenshot">
                                <img src={s.paymentProof} alt="Payment receipt screenshot" className="h-20 w-20 rounded object-cover" />
                                <span className="text-xs text-primary">View receipt</span>
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">Proof: {s.paymentProof}</p>
                            )
                          )}
                        </div>
                        <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded font-medium">Pending Verification</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <div className="flex-1 flex items-center gap-2">
                          <label className="text-xs text-muted-foreground shrink-0">Grant Duration:</label>
                          <select
                            className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={approvalDurations[s.id] || parseInt(s.durationMonths || "1")}
                            onChange={(e) => setApprovalDurations({ ...approvalDurations, [s.id]: Number(e.target.value) })}
                          >
                            <option value={1}>1 Month</option>
                            <option value={3}>3 Months</option>
                            <option value={6}>6 Months</option>
                            <option value={12}>1 Year (12M)</option>
                            <option value={24}>2 Years (24M)</option>
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmPayment(s.clinicId, s.id)}
                          disabled={confirmMutation.isPending}
                        >
                          {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          Approve & Activate
                        </Button>
                      </div>
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

          {/* Clinic directory */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold">{t("admin.clinics.title")}</h2></div>
              <div className="flex items-center gap-2 ms-auto"><div className="relative"><Search className="absolute start-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" /><Input className="h-8 w-48 ps-7 text-xs" placeholder={t("admin.clinics.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button size="sm" variant="outline" onClick={exportClinics}><Download className="w-3 h-3 me-1" />CSV</Button></div>
            </div>
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-border/70">{tabs.map((item) => <Button key={item.key} size="sm" variant={tab === item.key ? "default" : "outline"} onClick={() => setTab(item.key)}>{item.label} <span className="ms-1 text-xs opacity-70">{item.count}</span></Button>)}</div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {filteredClinics.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{t("admin.pending.empty")}</p> : filteredClinics.map((clinic) => <div key={clinic.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20"><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{clinic.name}</p><p className="text-xs text-muted-foreground">{clinic.subscriptionStatus} · {formatDate(clinic.createdAt)}</p></div><StatusBadge status={clinic.status} /><Button size="sm" variant="outline" onClick={() => setSelectedClinicId(clinic.id)}>{t("admin.clinic.details")}</Button>{clinic.status === "active" && <Button size="sm" variant="ghost" onClick={() => handleBlock(clinic.id)}><XCircle className="w-3 h-3 me-1" />{t("admin.clinics.block")}</Button>}</div>)}
            </div>
          </section>

          {/* Simple platform controls */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.tools.title")}</h2>
            </div>
            <div className="grid xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.settings")}</h3></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-xs text-muted-foreground">{t("admin.tools.basicPrice")}<Input className="mt-1" value={settingsForm.basicMonthlyPrice} onChange={(e) => setSettingsForm({ ...settingsForm, basicMonthlyPrice: e.target.value })} /></label>
                  <label className="text-xs text-muted-foreground">{t("admin.tools.premiumPrice")}<Input className="mt-1" value={settingsForm.premiumMonthlyPrice} onChange={(e) => setSettingsForm({ ...settingsForm, premiumMonthlyPrice: e.target.value })} /></label>
                  <label className="text-xs text-muted-foreground">{t("admin.tools.vodafone")}<Input className="mt-1" value={settingsForm.vodafoneCashNumber} onChange={(e) => setSettingsForm({ ...settingsForm, vodafoneCashNumber: e.target.value })} /></label>
                  <label className="text-xs text-muted-foreground">{t("admin.tools.instapay")}<Input className="mt-1" value={settingsForm.instapayHandle} onChange={(e) => setSettingsForm({ ...settingsForm, instapayHandle: e.target.value })} /></label>
                  <label className="text-xs text-muted-foreground sm:col-span-2">{t("admin.tools.whatsapp")}<Input className="mt-1" value={settingsForm.whatsappNumber} onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })} /></label>
                </div>
                <Button size="sm" onClick={savePlatformSettings} disabled={savingTools}><Save className="w-3 h-3 me-1" />{t("admin.tools.save")}</Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.engagement")}</h3></div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(engagementQ.data ?? []).slice(0, 8).map((row) => (
                    <div key={row.clinicId} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{row.clinicName}</p><p className="text-xs text-muted-foreground">{row.patientCount} {t("admin.tools.patients")} · {row.recentAppointments} {t("admin.tools.weekAppointments")}</p></div>
                      <span className={cn("text-xs font-semibold rounded-full px-2 py-1", row.engagementScore >= 50 ? "bg-green-500/10 text-green-600" : row.engagementScore > 0 ? "bg-yellow-500/10 text-yellow-600" : "bg-muted text-muted-foreground")}>{row.engagementScore}/100</span>
                    </div>
                  ))}
                  {(engagementQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("admin.tools.noEngagement")}</p>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.broadcasts")}</h3></div>
                <div className="grid gap-2"><Input placeholder={t("admin.tools.broadcastTitle")} value={broadcastForm.title} onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })} /><textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={t("admin.tools.broadcastMessage")} value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} /></div>
                <Button size="sm" onClick={createBroadcast}><Plus className="w-3 h-3 me-1" />{t("admin.tools.publish")}</Button>
                <div className="space-y-2 max-h-36 overflow-y-auto">{(messagesQ.data ?? []).slice(0, 5).map((item) => <div key={item.id} className="flex items-center gap-2 text-sm"><div className="flex-1 min-w-0"><p className="font-medium truncate">{item.title}</p><p className="text-xs text-muted-foreground truncate">{item.message}</p></div><Button size="sm" variant="outline" onClick={() => togglePlatformItem("messages", item.id, item.active)}><Power className="w-3 h-3 me-1" />{item.active ? t("admin.tools.archive") : t("admin.tools.activate")}</Button></div>)}</div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.promos")}</h3></div>
                <div className="grid sm:grid-cols-3 gap-2"><Input className="sm:col-span-1" placeholder={t("admin.tools.code")} value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} /><Input type="number" min="1" max="100" placeholder="%" value={promoForm.discountPercent} onChange={(e) => setPromoForm({ ...promoForm, discountPercent: e.target.value })} /><Input type="date" value={promoForm.expiresAt} onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })} /></div>
                <Button size="sm" onClick={createPromo}><Plus className="w-3 h-3 me-1" />{t("admin.tools.createPromo")}</Button>
                <div className="space-y-2 max-h-36 overflow-y-auto">{(promoQ.data ?? []).slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-2 text-sm"><div className="flex-1"><span className="font-mono font-semibold">{item.code}</span><span className="text-xs text-muted-foreground ms-2">{item.discountPercent}%</span></div><Button size="sm" variant="outline" onClick={() => togglePlatformItem("promo-codes", item.id, item.active)}><Power className="w-3 h-3 me-1" />{item.active ? t("admin.tools.disable") : t("admin.tools.activate")}</Button></div>)}</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card overflow-hidden"><div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2"><History className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.audit")}</h3></div><div className="divide-y divide-border max-h-56 overflow-y-auto">{(auditQ.data ?? []).slice(0, 12).map((log) => <div key={log.id} className="px-5 py-3"><p className="text-xs font-semibold">{log.action}</p><p className="text-xs text-muted-foreground">{log.details}</p><p className="text-[10px] text-muted-foreground mt-1">{log.adminEmail} · {formatDate(log.createdAt)}</p></div>)}{(auditQ.data ?? []).length === 0 && <p className="p-5 text-sm text-muted-foreground">{t("admin.tools.noAudit")}</p>}</div></div>
              <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-primary" /><h3 className="font-semibold">{t("admin.tools.recommendations")}</h3></div><p className="text-sm text-muted-foreground">{t("admin.tools.recommendationsText")}</p></div>
            </div>
          </section>
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
  const [trialDays, setTrialDays] = useState("7");
  const [extendingTrial, setExtendingTrial] = useState(false);
  const extendTrial = async () => {
    if (!clinicId) return;
    setExtendingTrial(true);
    try {
      await customFetch(`/api/platform/clinics/${clinicId}/extend-trial`, { method: "POST", body: JSON.stringify({ days: Number(trialDays) }) });
      window.alert(t("admin.tools.trialExtended"));
      onClose();
    } catch {
      window.alert(t("admin.tools.trialFailed"));
    } finally { setExtendingTrial(false); }
  };

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

              <section className="rounded-lg border border-border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold mb-2">{t("admin.tools.trialExtension")}</h3>
                <div className="flex items-center gap-2"><Input type="number" min="1" max="90" className="w-28" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} /><span className="text-sm text-muted-foreground">{t("admin.tools.days")}</span><Button size="sm" className="ms-auto" onClick={extendTrial} disabled={extendingTrial}>{extendingTrial ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 me-1" />}{t("admin.tools.extend")}</Button></div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
