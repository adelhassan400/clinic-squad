import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useGetPatient, useListAppointments, getGetPatientQueryKey, getListAppointmentsQueryKey } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Phone, Calendar, Droplets } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Props { params: { id: string } }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    no_show: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function PatientDetailPage({ params }: Props) {
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const patientId = params.id;

  const { data: patient, isLoading } = useGetPatient(clinicId, patientId, {
    query: { enabled: !!clinicId && !!patientId, queryKey: getGetPatientQueryKey(clinicId, patientId) }
  });

  const { data: appts } = useListAppointments(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, {}) }
  });
  const patientAppts = appts?.data.filter(a => a.patientId === patientId) ?? [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Link href="/patients">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1.5" />Back to Patients
            </Button>
          </Link>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : !patient ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Patient not found</p>
              <Link href="/patients"><Button className="mt-4" size="sm">Back to Patients</Button></Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-bold text-primary">{patient.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold mb-1">{patient.name}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />{patient.phone}
                      </span>
                      <span className="flex items-center gap-1.5 capitalize">
                        <User className="w-3.5 h-3.5" />{patient.gender}
                      </span>
                      {patient.dateOfBirth && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />{formatDate(patient.dateOfBirth)}
                        </span>
                      )}
                      {patient.bloodType && (
                        <span className="flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-red-500" />{patient.bloodType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(patient.allergies || patient.notes) && (
                  <div className="mt-5 pt-5 border-t border-border grid sm:grid-cols-2 gap-4">
                    {patient.allergies && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Allergies</p>
                        <p className="text-sm text-destructive">{patient.allergies}</p>
                      </div>
                    )}
                    {patient.notes && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Medical Notes</p>
                        <p className="text-sm">{patient.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Appointment history */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold mb-4">Appointment History ({patientAppts.length})</h2>
                {!patientAppts.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No appointments recorded</p>
                ) : (
                  <div className="space-y-2">
                    {patientAppts.sort((a, b) => b.date.localeCompare(a.date)).map(appt => (
                      <div key={appt.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{appt.type}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(appt.date)} at {appt.time}</p>
                        </div>
                        <StatusBadge status={appt.status} />
                        {appt.fee && <span className="text-sm font-mono text-muted-foreground">{appt.fee} EGP</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
