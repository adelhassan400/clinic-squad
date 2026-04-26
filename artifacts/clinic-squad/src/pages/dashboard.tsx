import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useGetDashboardSummary, useGetTodayAppointments, useUpdateAppointment, getGetDashboardSummaryQueryKey, getGetTodayAppointmentsQueryKey, getListAppointmentsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate, getTrialDaysLeft, getTrialUrgency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { openWhatsApp, whatsappAppointmentReminder } from "@/lib/whatsapp";
import { Users, Calendar, TrendingUp, Clock, CheckCircle, AlertTriangle, Crown, ArrowRight, MessageCircle, PhoneOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { VisitTypeBadge } from "@/lib/visit-types";

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
  const { format: formatCurrency } = useCurrency();
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardSummaryQueryKey(clinicId) }
  });

  const { data: todayAppts, isLoading: apptLoading } = useGetTodayAppointments(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetTodayAppointmentsQueryKey(clinicId) }
  });

  // Tomorrow's reminders — uses raw fetch (endpoint isn't in the generated client yet).
  type TomorrowAppt = {
    id: string; patientId: string; patientName: string;
    patientPhone: string | null; date: string; time: string;
    type: string | null; status: string;
  };
  const { data: tomorrowAppts, isLoading: tomorrowLoading } = useQuery<TomorrowAppt[]>({
    queryKey: ["tomorrow-appts", clinicId],
    queryFn: () => customFetch<TomorrowAppt[]>(`/api/clinics/${clinicId}/appointments/tomorrow`),
    enabled: !!clinicId,
  });

  const handleSendReminder = (a: TomorrowAppt) => {
    if (!a.patientPhone) {
      toast({ title: "No phone number on file", variant: "destructive" });
      return;
    }
    const message = whatsappAppointmentReminder({
      patientName: a.patientName,
      clinicName: clinic?.name ?? "the clinic",
      date: formatDate(a.date),
      time: a.time,
      type: a.type,
    });
    openWhatsApp(a.patientPhone, message);
  };

  const updateAppointment = useUpdateAppointment();

  const handleCheckIn = (appointmentId: string, patientName: string) => {
    updateAppointment.mutate(
      { clinicId, appointmentId, data: { status: "completed" } },
      {
        onSuccess: () => {
          toast({ title: `${patientName} checked in` });
          qc.invalidateQueries({ queryKey: getGetTodayAppointmentsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
        },
        onError: () => toast({ title: "Check-in failed", variant: "destructive" }),
      }
    );
  };

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
                      <div className="mt-1">
                        <VisitTypeBadge type={appt.type} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">{appt.time}</span>
                      <AppointmentStatusBadge status={appt.status} />
                      {appt.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-green-600 border-green-600/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => handleCheckIn(appt.id, appt.patientName)}
                          disabled={updateAppointment.isPending}
                          data-testid={`checkin-${appt.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Check-in
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tomorrow's WhatsApp reminders */}
          <div className="rounded-xl border border-border bg-card p-6 mt-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  Tomorrow's Reminders
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  One-click WhatsApp reminders to reduce no-shows
                </p>
              </div>
              {!!tomorrowAppts?.length && (
                <Badge variant="secondary" className="text-xs">
                  {tomorrowAppts.length} scheduled
                </Badge>
              )}
            </div>

            {tomorrowLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !tomorrowAppts?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No appointments tomorrow</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tomorrowAppts.map(a => (
                  <div
                    key={a.id}
                    data-testid={`tomorrow-row-${a.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-green-700 dark:text-green-400">
                        {a.patientName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.type ?? "Appointment"} · {a.time}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-7 px-2 text-xs",
                        a.patientPhone
                          ? "text-green-700 border-green-600/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                          : "text-muted-foreground"
                      )}
                      onClick={() => handleSendReminder(a)}
                      disabled={!a.patientPhone}
                      data-testid={`reminder-${a.id}`}
                    >
                      {a.patientPhone ? (
                        <>
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />
                          Send reminder
                        </>
                      ) : (
                        <>
                          <PhoneOff className="w-3.5 h-3.5 mr-1" />
                          No phone
                        </>
                      )}
                    </Button>
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
