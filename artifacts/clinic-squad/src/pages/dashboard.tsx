import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useGetDashboardSummary, useGetTodayAppointments, getGetDashboardSummaryQueryKey, getGetTodayAppointmentsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate, getTrialDaysLeft, getTrialUrgency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Users, Calendar, TrendingUp, Clock, CheckCircle, AlertTriangle, Crown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ label, value, icon: Icon, sub, color }: {
  label: string; value: string | number; icon: typeof Users; sub?: string; color?: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color ?? "bg-primary/10")}>
          <Icon className={cn("w-5 h-5", color ? "text-white" : "text-primary")} />
        </div>
      </div>
      <div className="text-2xl font-bold mb-1" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    no_show: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function DashboardPage() {
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardSummaryQueryKey(clinicId) }
  });

  const { data: todayAppts, isLoading: apptLoading } = useGetTodayAppointments(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetTodayAppointmentsQueryKey(clinicId) }
  });

  const trialDaysLeft = clinic?.subscriptionStatus === "trial"
    ? getTrialDaysLeft(clinic.trialEndDate)
    : null;
  const urgency = trialDaysLeft !== null ? getTrialUrgency(trialDaysLeft) : null;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          {/* Trial Banner */}
          {clinic?.subscriptionStatus === "trial" && trialDaysLeft !== null && (
            <div className={cn(
              "mb-6 p-4 rounded-xl border flex items-center justify-between",
              urgency === "danger" ? "bg-destructive/10 border-destructive/30" :
              urgency === "warning" ? "bg-accent/10 border-accent/30" :
              "bg-primary/10 border-primary/30"
            )}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={cn("w-5 h-5", urgency === "danger" ? "text-destructive" : urgency === "warning" ? "text-accent" : "text-primary")} />
                <div>
                  <p className="font-semibold text-sm">
                    Free trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
                  </p>
                  <p className="text-xs text-muted-foreground">Choose a plan to continue using ClinicSquad after your trial ends.</p>
                </div>
              </div>
              <Link href="/subscription">
                <Button size="sm" variant="outline" className="shrink-0">
                  <Crown className="w-3 h-3 mr-1.5" />
                  Upgrade
                </Button>
              </Link>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {summaryLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))
            ) : (
              <>
                <StatCard label="Total Patients" value={summary?.totalPatients ?? 0} icon={Users} sub={`+${summary?.newPatientsThisMonth ?? 0} this month`} />
                <StatCard label="Today's Appointments" value={summary?.todayAppointments ?? 0} icon={Calendar} sub={`${summary?.upcomingAppointments ?? 0} upcoming`} />
                <StatCard label="Monthly Revenue" value={formatCurrency(summary?.monthlyRevenue ?? 0)} icon={TrendingUp} sub={`Expenses: ${formatCurrency(summary?.monthlyExpenses ?? 0)}`} />
                <StatCard label="Completed" value={summary?.completedAppointments ?? 0} icon={CheckCircle} sub="appointments total" />
              </>
            )}
          </div>

          {/* Today's Appointments */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold">Today's Appointments</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(new Date().toISOString())}</p>
              </div>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" className="text-primary text-xs">
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {apptLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !todayAppts?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No appointments today</p>
                <Link href="/appointments">
                  <Button size="sm" className="mt-3" variant="outline">Schedule appointment</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayAppts.map(appt => (
                  <div key={appt.id} data-testid={`appt-row-${appt.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{appt.patientName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{appt.type}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">{appt.time}</span>
                      <AppointmentStatusBadge status={appt.status} />
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
