import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListFinances, useCreateFinanceRecord, useGetFinanceSummary,
  getListFinancesQueryKey, getGetFinanceSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, TrendingUp, TrendingDown, Crown, Lock, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const financeSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description required"),
  date: z.string().min(1, "Date required"),
});
type FinanceForm = z.infer<typeof financeSchema>;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function FinancesPage() {
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const isPremium = clinic?.subscriptionStatus === "premium";
  const isExpired = clinic?.subscriptionStatus === "expired";

  const { data: finances, isLoading } = useListFinances(clinicId, {}, {
    query: { enabled: !!clinicId && isPremium, queryKey: getListFinancesQueryKey(clinicId, {}) }
  });

  const { data: summary } = useGetFinanceSummary(clinicId, { year: currentYear }, {
    query: {
      enabled: !!clinicId && isPremium,
      queryKey: getGetFinanceSummaryQueryKey(clinicId, { year: currentYear })
    }
  });

  const createMutation = useCreateFinanceRecord();

  const form = useForm<FinanceForm>({
    resolver: zodResolver(financeSchema),
    defaultValues: { type: "income", category: "", amount: 0, description: "", date: new Date().toISOString().split("T")[0] },
  });

  const onSubmit = (values: FinanceForm) => {
    createMutation.mutate({ clinicId, data: values }, {
      onSuccess: () => {
        toast({ title: "Record added" });
        qc.invalidateQueries({ queryKey: getListFinancesQueryKey(clinicId) });
        qc.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey(clinicId) });
        setAddOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to add record", variant: "destructive" }),
    });
  };

  // Locked for non-premium users
  if (!isPremium && !isExpired) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">Finances</h1>
            <div className="mt-8 rounded-2xl border border-border bg-card p-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-2">Premium Feature</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
                The financial dashboard is available on the Premium plan. Upgrade to track income, expenses, and generate reports.
              </p>
              <Link href="/subscription">
                <Button>
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const chartData = summary?.monthlyBreakdown.map(m => ({
    month: MONTH_NAMES[m.month - 1],
    Income: m.income,
    Expense: m.expense,
  })) ?? [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Finances</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Financial overview for {currentYear}</p>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-finance">
              <Plus className="w-4 h-4 mr-2" />Add Record
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Total Income</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.totalIncome ?? 0)}</p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(summary?.totalExpense ?? 0)}</p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${(summary?.netProfit ?? 0) >= 0 ? "text-primary" : "text-red-500"}`}>
                {formatCurrency(summary?.netProfit ?? 0)}
              </p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <h2 className="font-semibold mb-4">Monthly Overview</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Bar dataKey="Income" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
                  <Bar dataKey="Expense" fill="hsl(var(--destructive))" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Records list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Type</span>
              <span>Description</span>
              <span>Category</span>
              <span>Date</span>
              <span>Amount</span>
            </div>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-border"><Skeleton className="h-5 w-full" /></div>
              ))
            ) : !finances?.data.length ? (
              <div className="text-center py-14 text-muted-foreground">
                <p className="font-medium text-sm">No financial records yet</p>
                <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" />Add Record
                </Button>
              </div>
            ) : (
              finances.data.map(record => (
                <div
                  key={record.id}
                  data-testid={`finance-row-${record.id}`}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                    record.type === "income" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}>{record.type}</span>
                  <span className="text-sm truncate">{record.description}</span>
                  <span className="text-xs text-muted-foreground">{record.category}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(record.date)}</span>
                  <span className={`text-sm font-mono font-semibold ${record.type === "income" ? "text-green-600" : "text-red-500"}`}>
                    {record.type === "income" ? "+" : "-"}{formatCurrency(record.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Record Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Financial Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Type *</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Input {...form.register("category")} placeholder="Consultation, Supplies, Rent..." className="mt-1" />
                {form.formState.errors.category && <p className="text-xs text-destructive mt-1">{form.formState.errors.category.message}</p>}
              </div>
              <div>
                <Label>Amount (EGP) *</Label>
                <Input {...form.register("amount")} type="number" step="0.01" placeholder="1500" className="mt-1" />
                {form.formState.errors.amount && <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>}
              </div>
              <div>
                <Label>Description *</Label>
                <Input {...form.register("description")} placeholder="Brief description..." className="mt-1" />
                {form.formState.errors.description && <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>}
              </div>
              <div>
                <Label>Date *</Label>
                <Input {...form.register("date")} type="date" className="mt-1" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-finance">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Record
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
