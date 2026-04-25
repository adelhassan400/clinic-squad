import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
  Flame, Star, Activity, DollarSign, BarChart2
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

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

// ─── Custom Tooltip ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, suffix = "" }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>;
  label?: string; suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value.toLocaleString()}{suffix}</span>
        </p>
      ))}
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
  const { symbol: currencySymbol } = useCurrency();
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // ── Data fetching ──
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardSummaryQueryKey(clinicId) },
  });

  const { data: financeSummary, isLoading: financeLoading } = useGetFinanceSummary(
    clinicId,
    { year: selectedYear },
    { query: { enabled: !!clinicId, queryKey: getGetFinanceSummaryQueryKey(clinicId, { year: selectedYear }) } }
  );

  // Fetch all appointments (high limit) to compute busy-day and status charts
  const { data: allAppts, isLoading: apptsLoading } = useListAppointments(
    clinicId,
    { limit: 1000 } as Parameters<typeof useListAppointments>[1],
    { query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, { limit: 1000 } as Parameters<typeof useListAppointments>[1]) } }
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
  }, [allAppts, currentYear, now]);

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
      name: status.replace("_", " "),
      value: count,
      color: STATUS_COLORS[status] ?? "#94a3b8",
    }));
  }, [allAppts]);

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
  }, [allAppts]);

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
  }, [financeSummary]);

  // ── Derived: completion rate ──
  const completionRate = useMemo(() => {
    const total = allAppts?.data.length ?? 0;
    if (!total) return 0;
    const done = allAppts!.data.filter(a => a.status === "completed").length;
    return Math.round((done / total) * 100);
  }, [allAppts]);

  const totalAppts = allAppts?.data.length ?? 0;

  return (
    <ProtectedRoute requireRole={["admin", "superadmin"]}>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-primary" />
                Insights
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Performance overview for {clinic?.name}
              </p>
            </div>
          </div>

          {/* ── Metric Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Patients"
              value={fmt(summary?.totalPatients ?? 0)}
              sub={`+${summary?.newPatientsThisMonth ?? 0} this month`}
              icon={Users}
              color="bg-blue-500"
              loading={summaryLoading}
              trend="up"
            />
            <MetricCard
              label="Completion Rate"
              value={`${completionRate}%`}
              sub={`${allAppts?.data.filter(a => a.status === "completed").length ?? 0} of ${totalAppts} completed`}
              icon={CheckCircle}
              color="bg-green-500"
              loading={apptsLoading}
              trend={completionRate >= 70 ? "up" : "down"}
            />
            <MetricCard
              label="Monthly Revenue"
              value={`${fmt(summary?.monthlyRevenue ?? 0)} ${currencySymbol}`}
              sub={`${fmt(summary?.monthlyExpenses ?? 0)} ${currencySymbol} expenses`}
              icon={DollarSign}
              color="bg-primary"
              loading={summaryLoading}
            />
            <MetricCard
              label="Upcoming"
              value={summary?.upcomingAppointments ?? 0}
              sub={`${summary?.todayAppointments ?? 0} today`}
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
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Busiest Day This Month</p>
                    <p className="text-lg font-bold mt-0.5">
                      {busiestDay.dayName} {MONTH_NAMES[now.getMonth()]} {busiestDay.day}
                    </p>
                    <p className="text-xs text-muted-foreground">{busiestDay.count} appointment{busiestDay.count !== 1 ? "s" : ""} — peak load</p>
                  </div>
                </div>
              )}
              {busiestWeekday && busiestWeekday.count > 0 && (
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Busiest Weekday (All Time)</p>
                    <p className="text-lg font-bold mt-0.5">{busiestWeekday.day}s</p>
                    <p className="text-xs text-muted-foreground">{busiestWeekday.count} appointment{busiestWeekday.count !== 1 ? "s" : ""} historically</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Top row charts ── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Busy Days Bar Chart */}
            <div className="lg:col-span-2">
              <Section
                title={`Appointments by Day — ${MONTH_NAMES[now.getMonth()]} ${currentYear}`}
                sub="Number of appointments per calendar day this month"
              >
                {apptsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : busyDayData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Activity className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No appointments this month yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={busyDayData} barCategoryGap="30%">
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={24}
                      />
                      <Tooltip content={<ChartTooltip suffix=" appts" />} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="count" name="appointments" radius={[4, 4, 0, 0]}>
                        {busyDayData.map((entry) => (
                          <Cell
                            key={entry.date}
                            fill={entry.date === busiestDay?.date ? "#f97316" : "hsl(var(--primary))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Section>
            </div>

            {/* Status Donut */}
            <Section title="Appointment Status" sub="All-time breakdown">
              {apptsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : statusData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Activity className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v} appointments`, name]}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ── Weekday Distribution ── */}
          <Section
            title="Appointments by Day of Week"
            sub="Which weekdays attract the most patients (all time)"
          >
            {apptsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekdayData} barCategoryGap="35%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<ChartTooltip suffix=" appts" />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="count" name="appointments" radius={[4, 4, 0, 0]}>
                    {weekdayData.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.day === busiestWeekday?.day ? "#6366f1" : "hsl(var(--primary) / 0.6)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* ── Monthly Revenue Chart ── */}
          <Section
            title="Monthly Revenue vs Expenses"
            sub={
              <span className="flex items-center gap-3">
                <span>Year:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="text-xs bg-transparent border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer"
                >
                  {[currentYear - 1, currentYear].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </span>
            }
          >
            {financeLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : monthlyData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="w-8 h-8 opacity-30" />
                <p className="text-sm">No financial data for {selectedYear}</p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: "Total Income", value: financeSummary?.totalIncome ?? 0, color: "text-green-500" },
                    { label: "Total Expenses", value: financeSummary?.totalExpense ?? 0, color: "text-destructive" },
                    { label: "Net Profit", value: financeSummary?.netProfit ?? 0, color: (financeSummary?.netProfit ?? 0) >= 0 ? "text-green-500" : "text-destructive" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={cn("text-lg font-bold tabular-nums mt-0.5", color)}>
                        {value.toLocaleString()} {currencySymbol}
                      </p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<ChartTooltip suffix={` ${currencySymbol}`} />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#incomeGrad)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Expense"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#expenseGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </Section>

        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
