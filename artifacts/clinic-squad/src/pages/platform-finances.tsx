import { useMemo, useState } from "react";
import { Download, FileText, Loader2, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { useLang } from "@/lib/lang";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueReport {
  year: number;
  totalCollected: number;
  transactionCount: number;
  averageTransaction: number;
  pendingAmount: number;
  pendingCount: number;
  monthly: Array<{ month: string; amount: number; count: number }>;
  byPlan: Array<{ planType: string; amount: number; count: number }>;
  topClinics: Array<{ clinicId: string; clinicName: string; amount: number; count: number }>;
  transactions: Array<{
    id: string;
    clinicName: string;
    planType: string;
    billingPeriod: string;
    durationMonths: string;
    amount: number;
    transactionReference: string | null;
    createdAt: string;
  }>;
  availableYears: number[];
  month: number | null;
}

function normalizeRevenueReport(data: Partial<RevenueReport> | null | undefined, fallbackYear: number): RevenueReport {
  return {
    year: typeof data?.year === "number" ? data.year : fallbackYear,
    totalCollected: Number(data?.totalCollected) || 0,
    transactionCount: Number(data?.transactionCount) || 0,
    averageTransaction: Number(data?.averageTransaction) || 0,
    pendingAmount: Number(data?.pendingAmount) || 0,
    pendingCount: Number(data?.pendingCount) || 0,
    monthly: Array.isArray(data?.monthly) ? data.monthly.map((item) => ({
      month: String(item.month ?? ""),
      amount: Number(item.amount) || 0,
      count: Number(item.count) || 0,
    })) : [],
    byPlan: Array.isArray(data?.byPlan) ? data.byPlan.map((item) => ({
      planType: String(item.planType ?? "unknown"),
      amount: Number(item.amount) || 0,
      count: Number(item.count) || 0,
    })) : [],
    topClinics: Array.isArray(data?.topClinics) ? data.topClinics.map((item) => ({
      clinicId: String(item.clinicId ?? ""),
      clinicName: String(item.clinicName ?? "Deleted clinic"),
      amount: Number(item.amount) || 0,
      count: Number(item.count) || 0,
    })) : [],
    transactions: Array.isArray(data?.transactions) ? data.transactions : [],
    availableYears: Array.from(new Set([fallbackYear, ...(Array.isArray(data?.availableYears) ? data.availableYears : [])])).filter((item): item is number => typeof item === "number").sort((a, b) => b - a),
    month: typeof data?.month === "number" ? data.month : null,
  };
}

function StatCard({ icon: Icon, label, value, detail, tone = "default" }: {
  icon: typeof Wallet;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone === "success" ? "text-green-600" : tone === "warning" ? "text-amber-600" : "text-primary"}`} />
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default function PlatformFinancesPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { format: formatCurrency, currency } = useCurrency();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);

  const reportQ = useQuery<RevenueReport>({
    queryKey: ["/api/admin/finance-report", year, month ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year) });
      if (month !== null) params.set("month", String(month));
      const data = await customFetch<Partial<RevenueReport>>(`/api/admin/finance-report?${params.toString()}`);
      return normalizeRevenueReport(data, year);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const report = reportQ.data;
  const monthData = useMemo(() => report?.monthly.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }),
  })) ?? [], [report?.monthly, lang]);

  const planTotal = report?.byPlan.reduce((sum, plan) => sum + plan.amount, 0) ?? 0;
  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ["Clinic", "Plan", "Billing period", "Duration months", "Amount", "Transaction reference", "Date"],
      ...report.transactions.map((item) => [
        item.clinicName,
        item.planType,
        item.billingPeriod,
        item.durationMonths,
        item.amount.toFixed(2),
        item.transactionReference ?? "",
        item.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinicsquad-revenue-${report.year}${report.month ? `-${String(report.month).padStart(2, "0")}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">{t("platformFinance.title")}</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t("platformFinance.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("platformFinance.selectYear")}
              >
                {(report?.availableYears?.length ? report.availableYears : [currentYear]).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={month ?? ""}
                onChange={(event) => setMonth(event.target.value ? Number(event.target.value) : null)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("platformFinance.selectMonth")}
              >
                <option value="">{t("platformFinance.allMonths")}</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                  <option key={item} value={item}>
                    {new Date(Date.UTC(year, item - 1, 1)).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={downloadCsv} disabled={!report || reportQ.isLoading}>
                <Download className="me-2 h-4 w-4" />{t("platformFinance.export")}
              </Button>
            </div>
          </div>

          {reportQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
            </div>
          ) : reportQ.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">{t("platformFinance.loadError")}</div>
          ) : report ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={TrendingUp} label={t("platformFinance.totalCollected")} value={formatCurrency(report.totalCollected)} detail={`${month ? new Date(Date.UTC(report.year, month - 1, 1)).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }) : report.year} · ${currency.code}`} tone="success" />
                <StatCard icon={Receipt} label={t("platformFinance.transactions")} value={report.transactionCount.toLocaleString()} detail={t("platformFinance.confirmedOnly")} />
                <StatCard icon={Wallet} label={t("platformFinance.average")} value={formatCurrency(report.averageTransaction)} detail={t("platformFinance.perPayment")} />
                <StatCard icon={FileText} label={t("platformFinance.pending")} value={formatCurrency(report.pendingAmount)} detail={`${report.pendingCount} ${t("platformFinance.pendingRequests")}`} tone="warning" />
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{t("platformFinance.monthlyTitle")}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{t("platformFinance.monthlySubtitle")}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{currency.code}</span>
                </div>
                {report.transactionCount === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">{t("platformFinance.emptyChart")}</div>
                ) : <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthData} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [formatCurrency(value), t("platformFinance.collected")]}
                    />
                    <Bar dataKey="amount" name={t("platformFinance.collected")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><h2 className="font-semibold">{t("platformFinance.planTitle")}</h2></div>
                  {report.byPlan.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t("platformFinance.empty")}</p> : (
                    <div className="space-y-4">
                      {report.byPlan.map((plan) => {
                        const share = planTotal ? Math.round((plan.amount / planTotal) * 100) : 0;
                        return (
                          <div key={plan.planType}>
                            <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium capitalize">{plan.planType}</span><span className="font-semibold">{formatCurrency(plan.amount)}</span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} /></div>
                            <p className="mt-1 text-xs text-muted-foreground">{plan.count} {t("platformFinance.payments")} · {share}%</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-semibold">{t("platformFinance.clinicsTitle")}</h2></div>
                  {report.topClinics.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t("platformFinance.empty")}</p> : (
                    <div className="space-y-3">
                      {report.topClinics.map((clinic, index) => (
                        <div key={clinic.clinicId} className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-3"><span className="text-xs font-semibold text-muted-foreground">{index + 1}</span><span className="truncate text-sm font-medium">{clinic.clinicName}</span></div>
                          <div className="shrink-0 text-end"><p className="text-sm font-semibold">{formatCurrency(clinic.amount)}</p><p className="text-xs text-muted-foreground">{clinic.count} {t("platformFinance.payments")}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-6 py-4"><div><h2 className="font-semibold">{t("platformFinance.transactionsTitle")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformFinance.transactionsSubtitle")}</p></div><FileText className="h-4 w-4 text-muted-foreground" /></div>
                {report.transactions.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{t("platformFinance.empty")}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3 text-start">{t("platformFinance.clinic")}</th><th className="px-6 py-3 text-start">{t("platformFinance.plan")}</th><th className="px-6 py-3 text-start">{t("platformFinance.period")}</th><th className="px-6 py-3 text-start">{t("platformFinance.reference")}</th><th className="px-6 py-3 text-end">{t("platformFinance.amount")}</th><th className="px-6 py-3 text-end">{t("platformFinance.date")}</th></tr></thead>
                      <tbody>{report.transactions.map((item) => <tr key={item.id} className="border-t border-border"><td className="px-6 py-3 font-medium">{item.clinicName}</td><td className="px-6 py-3 capitalize">{item.planType}</td><td className="px-6 py-3 capitalize text-muted-foreground">{item.billingPeriod} · {item.durationMonths}m</td><td className="max-w-40 truncate px-6 py-3 text-muted-foreground">{item.transactionReference || "—"}</td><td className="px-6 py-3 text-end font-semibold text-green-600">{formatCurrency(item.amount)}</td><td className="whitespace-nowrap px-6 py-3 text-end text-xs text-muted-foreground">{formatDate(item.createdAt)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="me-2 h-4 w-4 animate-spin" />{t("platformFinance.loading")}</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
