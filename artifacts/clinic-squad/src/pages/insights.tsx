import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import {
  useGetDashboardSummary, useGetFinanceSummary, useListAppointments,
  getGetDashboardSummaryQueryKey, getGetFinanceSummaryQueryKey, getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, Calendar, TrendingUp, TrendingDown, CheckCircle,
  Flame, Star, Activity, DollarSign, BarChart2, Lock, Crown
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// ─── Metric Card ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
  trend?: "up" | "down" | "neutral";
}

function MetricCard({ label, value, sub, icon: Icon, color, loading, trend }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex gap-4 items-start">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
        )}
        {sub && !loading && (
          <p className={cn(
            "text-xs mt-1 flex items-center gap-1",
            trend === "up" ? "text-green-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"
          )}>
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Section Shell ─────────────────────────────────────────────────────────

function Section({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { t, lang } = useLang();
  const { symbol: currencySymbol } = useCurrency();
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const hasInsightsAccess = clinic?.subscriptionStatus === "premium" || clinic?.subscriptionStatus === "trial";
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const MONTH_NAMES = useMemo(() => {
    return lang === "ar" 
      ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }, [lang]);

  const DAY_NAMES = useMemo(() => {
    return lang === "ar"
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }, [lang]);

  const STATUS_COLORS: Record<string, string> = {
    scheduled: "#6366f1",
    completed:  "#22c55e",
    cancelled:  "#ef4444",
    no_show:    "#f97316",
  };

  function fmt(n: number) {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  // ── Data fetching (premium-gated) ──
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary(clinicId, {
    query: { enabled: !!clinicId && hasInsightsAccess, queryKey: getGetDashboardSummaryQueryKey(clinicId) },
  });

  const { data: financeSummary, isLoading: financeLoading } = useGetFinanceSummary(
    clinicId,
    { year: selectedYear },
    { query: { enabled: !!clinicId && hasInsightsAccess, queryKey: getGetFinanceSummaryQueryKey(clinicId, { year: selectedYear }) } }
  );

  const { data: allAppts, isLoading: apptsLoading } = useListAppointments(
    clinicId,
    { limit: 1000 } as Parameters<typeof useListAppointments>[1],
    { query: { enabled: !!clinicId && hasInsightsAccess, queryKey: getListAppointmentsQueryKey(clinicId, { limit: 1000 } as Parameters<typeof useListAppointments>[1]) } }
  );

  // ── Derived: busiest days of the current month ──
  const busyDayData = useMemo(() => {
    if (!allAppts?.data) return [];
    const monthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const counts: Record<string, number> = {};
    for (const a of allAppts.data) {
      if (a.date?.startsWith(monthStr)) {
        counts[a.date] = (counts[a.date] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([date, count]) => {
        const d = new Date(date + "T00:00:00");
        return { date, day: d.getDate(), dayName: DAY_NAMES[d.getDay()], count };
      })
      .sort((a, b) => a.day - b.day);
  }, [allAppts, currentYear, now, DAY_NAMES]);

  const busiestDay = useMemo(() => {
    if (!busyDayData.length) return null;
    return busyDayData.reduce((max, d) => d.count > max.count ? d : max, busyDayData[0]);
  }, [busyDayData]);

  // ── Derived: appointment status breakdown ──
  const statusData = useMemo(() => {
    if (!allAppts?.data) return [];
    const counts: Record<string, number> = {};
    for (const a of allAppts.data) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      name: t(`status.${status.replace("_", "")}`) || status.replace("_", " "),
      value: count,
      color: STATUS_COLORS[status] ?? "#94a3b8",
    }));
  }, [allAppts, t]);

  // ── Derived: weekday distribution (Sun–Sat) ──
  const weekdayData = useMemo(() => {
    if (!allAppts?.data) return DAY_NAMES.map(d => ({ day: d, count: 0 }));
    const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const a of allAppts.data) {
      if (a.date) {
        const dow = new Date(a.date + "T00:00:00").getDay();
        counts[dow]++;
      }
    }
    return DAY_NAMES.map((d, i) => ({ day: d, count: counts[i] }));
  }, [allAppts, DAY_NAMES]);

  const busiestWeekday = useMemo(() => {
    if (!weekdayData.length) return null;
    return weekdayData.reduce((max, d) => d.count > max.count ? d : max, weekdayData[0]);
  }, [weekdayData]);

  // ── Derived: monthly finance chart ──
  const monthlyData = useMemo(() => {
    if (!financeSummary?.monthlyBreakdown) return [];
    return financeSummary.monthlyBreakdown.map(m => ({
      month: MONTH_NAMES[m.month - 1] ?? `M${m.month}`,
      income: m.income,
      expense: m.expense,
      profit: m.income - m.expense,
    }));
  }, [financeSummary, MONTH_NAMES]);

  // ── Derived: completion rate ──
  const completionRate = useMemo(() => {
    const total = allAppts?.data.length ?? 0;
    if (!total) return 0;
    const done = allAppts!.data.filter(a => a.status === "completed").length;
    return Math.round((done / total) * 100);
  }, [allAppts]);

  const totalAppts = allAppts?.data.length ?? 0;

  // Basic clinics see the upgrade lock; trials temporarily receive full Premium access.
  if (!hasInsightsAccess) {
    return (
      <ProtectedRoute requireRole={["admin", "doctor", "superadmin"]}>
        <DashboardLayout>
          <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              {t("insights.title")}
            </h1>
            <div className="mt-8 rounded-2xl border border-border bg-card p-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t("insights.premium.title")}</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                {t("insights.premium.desc")}
              </p>
              <Link href="/subscription">
                <Button>
                  <Crown className="w-4 h-4 mr-2" />
                  {t("insights.premium.upgrade")}
                </Button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireRole={["admin", "doctor", "superadmin"]}>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-primary" />
                {t("insights.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("insights.subtitle")}
              </p>
            </div>
          </div>

          {/* ── Metric Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t("insights.metric.patients")}
              value={fmt(summary?.totalPatients ?? 0)}
              sub={`+${summary?.newPatientsThisMonth ?? 0} ${t("insights.metric.newPatients")}`}
              icon={Users}
              color="bg-blue-500"
              loading={summaryLoading}
              trend="up"
            />
            <MetricCard
              label={t("insights.metric.completion")}
              value={`${completionRate}%`}
              sub={`${allAppts?.data.filter(a => a.status === "completed").length ?? 0} ${t("insights.metric.completedOf")} ${totalAppts}`}
              icon={CheckCircle}
              color="bg-green-500"
              loading={apptsLoading}
              trend={completionRate >= 70 ? "up" : "down"}
            />
            <MetricCard
              label={t("insights.metric.revenue")}
              value={`${fmt(summary?.monthlyRevenue ?? 0)} ${currencySymbol}`}
              sub={`${fmt(summary?.monthlyExpenses ?? 0)} ${currencySymbol} ${t("insights.metric.expenses")}`}
              icon={DollarSign}
              color="bg-primary"
              loading={summaryLoading}
            />
            <MetricCard
              label={t("insights.metric.upcoming")}
              value={summary?.upcomingAppointments ?? 0}
              sub={`${summary?.todayAppointments ?? 0} ${t("insights.metric.today")}`}
              icon={Calendar}
              color="bg-orange-500"
              loading={summaryLoading}
            />
          </div>

          {/* ── Busiest Day Highlights ── */}
          {!apptsLoading && (busiestDay || busiestWeekday) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {busiestDay && (
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex flex-col items-center justify-center shrink-0 border border-orange-500/20">
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("insights.busiest.dayTitle")}</p>
                    <p className="text-lg font-bold mt-0.5">
                      {busiestDay.dayName} {MONTH_NAMES[now.getMonth()]} {busiestDay.day}
                    </p>
                    <p className="text-xs text-muted-foreground">{busiestDay.count} {t("sidebar.appointments")} — {t("insights.busiest.dayPeak")}</p>
                  </div>
                </div>
              )}
              {busiestWeekday && busiestWeekday.count > 0 && (
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("insights.busiest.weekdayTitle")}</p>
                    <p className="text-lg font-bold mt-0.5">{busiestWeekday.day}s</p>
                    <p className="text-xs text-muted-foreground">{busiestWeekday.count} {t("sidebar.appointments")} — {t("insights.busiest.weekdayHist")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Charts ── */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Section
                title={`${t("insights.chart.appointmentsTitle")} — ${MONTH_NAMES[now.getMonth()]} ${currentYear}`}
                sub={t("insights.chart.appointmentsSub")}
              >
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={busyDayData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            <Section
              title={t("insights.chart.statusTitle")}
              sub={t("insights.chart.statusSub")}
            >
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <Section
            title={t("insights.chart.revenueTitle")}
            sub={t("insights.chart.revenueSub")}
          >
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="income" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
