import { Building2, CheckCircle, Clock, CreditCard, ExternalLink, FileText, History, Hourglass, Shield, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch, getAdminListClinicsQueryKey, getAdminListPendingClinicsQueryKey, useAdminActivateClinic, useAdminListClinics, useAdminListPendingClinics } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import { useCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MonthlyRevenue { month: string; amount: number; count: number; }
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
  availableYears: number[];
}
interface AdminSubscription { id: string; clinicId: string; clinicName: string; planType: string; paymentStatus: string; amount: number; createdAt: string; }

function StatCard({ icon: Icon, label, value, sub, tone = "default" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; tone?: "default" | "warn" | "success" }) {
  return <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className={cn("h-4 w-4", tone === "success" ? "text-green-600" : tone === "warn" ? "text-yellow-600" : "text-primary")} /><span>{label}</span></div><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</div>;
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></Link>;
}

export default function AdminPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { currency: { code: currencyCode } } = useCurrency();
  const { data: clinics, isLoading: clinicsLoading } = useAdminListClinics({ query: { queryKey: getAdminListClinicsQueryKey() } });
  const statsQ = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"], queryFn: () => customFetch<AdminStats>("/api/admin/stats") });
  const subsQ = useQuery<AdminSubscription[]>({ queryKey: ["/api/admin/subscriptions"], queryFn: () => customFetch<AdminSubscription[]>("/api/admin/subscriptions") });
  const pendingApprovalsQ = useAdminListPendingClinics({ query: { queryKey: getAdminListPendingClinicsQueryKey() } });
  const activateMutation = useAdminActivateClinic();
  const stats = statsQ.data;
  const subscriptions = subsQ.data ?? [];
  const pendingPayments = subscriptions.filter((item) => item.paymentStatus === "pending");
  const pendingClinics = pendingApprovalsQ.data ?? [];
  const overviewClinics = stats?.totalClinics ?? clinics?.length ?? 0;
  const overviewUsers = stats?.totalUsers ?? 0;
  const overviewSignups = stats?.newSignupsWeek ?? 0;
  const overviewRevenue = stats?.confirmedRevenue ?? 0;

  const handleActivate = (clinicId: string) => activateMutation.mutate({ clinicId }, { onSuccess: () => { toast({ title: t("admin.home.activated") }); statsQ.refetch(); pendingApprovalsQ.refetch(); }, onError: () => toast({ title: t("admin.home.activateFailed"), variant: "destructive" }) });

  const planCards = [
    { key: "trial", label: t("plan.trial"), count: stats?.bySub?.trial ?? clinics?.filter((clinic) => clinic.subscriptionStatus === "trial").length ?? 0, tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { key: "basic", label: t("plan.basic"), count: stats?.bySub?.basic ?? clinics?.filter((clinic) => clinic.subscriptionStatus === "basic").length ?? 0, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    { key: "premium", label: t("plan.premium"), count: stats?.bySub?.premium ?? clinics?.filter((clinic) => clinic.subscriptionStatus === "premium").length ?? 0, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  ];

  return <ProtectedRoute requireRole="superadmin"><DashboardLayout><div className="mx-auto max-w-7xl space-y-6 p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Shield className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold">{t("admin.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("admin.home.subtitle")}</p></div></div><div className="text-xs text-muted-foreground">{t("admin.home.lastUpdated")}: {new Date().toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</div></div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard icon={Building2} label={t("insights.metric.clinics")} value={overviewClinics} sub={`${stats?.byStatus?.active ?? 0} ${t("status.active")}`} /><StatCard icon={Users} label={t("insights.metric.users")} value={overviewUsers} sub={`${stats?.totalPatients ?? 0} ${t("status.patients")}`} /><StatCard icon={Sparkles} label={t("admin.metric.newSignups")} value={overviewSignups} sub={t("admin.home.last7Days")} tone="success" /><StatCard icon={TrendingUp} label={t("admin.metric.confirmedRevenue")} value={`${Math.round(Number(overviewRevenue) || 0).toLocaleString()} ${currencyCode}`} sub={t("admin.home.allConfirmed") } tone="success" /></div>

    <div className="grid gap-4 md:grid-cols-3">{planCards.map((plan) => <div key={plan.key} className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{plan.label}</p><span className={cn("rounded-full px-2 py-1 text-xs font-semibold", plan.tone)}>{plan.count}</span></div><p className="mt-3 text-xs text-muted-foreground">{t("admin.home.clinicsOnPlan")}</p></div>)}</div>

    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-4"><Hourglass className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("admin.pending.title")}</h2><p className="mt-1 text-xs text-muted-foreground">{pendingClinics.length} {t("admin.pending.waiting")}</p></div><Link href="/platform-clinics" className="ms-auto text-xs font-medium text-primary hover:underline">{t("admin.home.viewAll")}</Link></div>{pendingApprovalsQ.isLoading ? <div className="p-5"><Skeleton className="h-20 w-full" /></div> : pendingClinics.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{t("admin.pending.empty")}</div> : <div className="divide-y divide-border">{pendingClinics.slice(0, 5).map((clinic) => <div key={clinic.clinicId} className="flex items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{clinic.clinicName}</p><p className="mt-1 text-xs text-muted-foreground">{t("admin.pending.joined")} {formatDate(clinic.createdAt)}</p></div><Button size="sm" onClick={() => handleActivate(clinic.clinicId)} disabled={activateMutation.isPending}>{activateMutation.isPending ? <span className="animate-pulse">...</span> : <CheckCircle className="me-1 h-3 w-3" />}{t("admin.pending.activate")}</Button></div>)}</div>}</section>
      <section className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /><h2 className="font-semibold">{t("admin.home.attention")}</h2></div><div className="space-y-3"><Link href="/platform-payments" className="flex items-center justify-between rounded-lg bg-yellow-500/10 p-3 text-sm hover:bg-yellow-500/15"><span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-yellow-600" />{t("admin.metric.pendingPayments")}</span><span className="font-bold text-yellow-700 dark:text-yellow-400">{stats?.pendingPayments ?? pendingPayments.length}</span></Link><Link href="/platform-clinics" className="flex items-center justify-between rounded-lg bg-blue-500/10 p-3 text-sm hover:bg-blue-500/15"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" />{t("admin.metric.trialEnding")}</span><span className="font-bold text-blue-700 dark:text-blue-400">{stats?.trialEndingSoon ?? 0}</span></Link><Link href="/platform-finances" className="flex items-center justify-between rounded-lg bg-green-500/10 p-3 text-sm hover:bg-green-500/15"><span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" />{t("admin.home.viewRevenue")}</span><span className="font-semibold text-green-700 dark:text-green-400"><ExternalLink className="h-4 w-4" /></span></Link></div></section>
    </div>

    <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">{t("admin.home.quickActions")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("admin.home.quickActionsSubtitle")}</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><QuickLink href="/platform-clinics" icon={Building2} title={t("sidebar.platformClinics")} description={t("admin.home.clinicsShortcut")} /><QuickLink href="/platform-payments" icon={CreditCard} title={t("sidebar.platformPayments")} description={t("admin.home.paymentsShortcut")} /><QuickLink href="/platform-growth" icon={Sparkles} title={t("sidebar.platformGrowth")} description={t("admin.home.growthShortcut")} /><QuickLink href="/platform-logs" icon={History} title={t("sidebar.platformLogs")} description={t("admin.home.logsShortcut")} /></div></section>

    <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-4"><FileText className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("admin.history.title")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("admin.home.recentSubscriptions")}</p></div><Link href="/platform-payments" className="ms-auto text-xs font-medium text-primary hover:underline">{t("admin.home.viewAll")}</Link></div>{subsQ.isLoading ? <div className="p-5"><Skeleton className="h-20 w-full" /></div> : subscriptions.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{t("admin.history.empty")}</div> : <div className="divide-y divide-border">{subscriptions.slice(0, 6).map((item) => <div key={item.id} className="flex items-center gap-4 px-5 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.clinicName}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{item.planType} · {item.paymentStatus} · {formatDate(item.createdAt)}</p></div><span className={cn("text-sm font-semibold", item.paymentStatus === "confirmed" ? "text-green-600" : "text-yellow-600")}>{item.amount} {currencyCode}</span></div>)}</div>}</section>
  </div></DashboardLayout></ProtectedRoute>;
}
