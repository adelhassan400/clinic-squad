import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PrescriptionsContent } from "@/pages/prescriptions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useGetPatient, useListAppointments, useListPrescriptions,
  getGetPatientQueryKey, getListAppointmentsQueryKey, getListPrescriptionsQueryKey,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, User, Phone, Calendar, Droplets, MessageCircle,
  Pill, Stethoscope, History,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { openWhatsApp, whatsappPatientGreeting } from "@/lib/whatsapp";

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
  const { currency: { code: currencyCode } } = useCurrency();
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

  const { data: rxResp } = useListPrescriptions(clinicId, { patientId }, {
    query: {
      enabled: !!clinicId && !!patientId,
      queryKey: getListPrescriptionsQueryKey(clinicId, { patientId }),
    },
  });
  const patientRx = rxResp?.data ?? [];

  // Combined chronological timeline: visits + prescriptions, newest first
  type TimelineEntry =
    | { kind: "visit"; id: string; date: string; time?: string; type: string; status: string; fee?: number | null }
    | { kind: "rx"; id: string; date: string; diagnosis: string | null; doctorName: string; drugs: string[] };

  const timeline: TimelineEntry[] = [
    ...patientAppts.map(a => ({
      kind: "visit" as const,
      id: a.id, date: a.date, time: a.time, type: a.type, status: a.status, fee: a.fee,
    })),
    ...patientRx.map(p => ({
      kind: "rx" as const,
      id: p.id, date: p.date, diagnosis: p.diagnosis, doctorName: p.doctorName,
      drugs: p.items.map(i => i.drug),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const totalSpent = patientAppts
    .filter(a => a.status === "completed" && a.fee)
    .reduce((s, a) => s + (a.fee ?? 0), 0);

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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h1 className="text-xl font-bold">{patient.name}</h1>
                      {patient.code && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {patient.code}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground items-center">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />{patient.phone}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-green-600 border-green-600/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() =>
                          openWhatsApp(
                            patient.phone,
                            whatsappPatientGreeting({
                              patientName: patient.name,
                              clinicName: clinic?.name ?? "the clinic",
                            })
                          )
                        }
                        data-testid="button-whatsapp-patient"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        WhatsApp
                      </Button>
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

              {/* Prescriptions */}
              <div className="rounded-xl border border-border bg-card p-6">
                <PrescriptionsContent initialPatientId={patient.id} embedded />
              </div>

              {/* Medical history timeline */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-semibold flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" />
                      Medical History
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeline.length} event{timeline.length !== 1 ? "s" : ""} ·
                      {" "}{patientAppts.length} visit{patientAppts.length !== 1 ? "s" : ""} ·
                      {" "}{patientRx.length} prescription{patientRx.length !== 1 ? "s" : ""}
                      {totalSpent > 0 && (
                        <> · Total paid: <span className="font-mono">{totalSpent} {currencyCode}</span></>
                      )}
                    </p>
                  </div>
                </div>

                {!timeline.length ? (
                  <div className="text-center py-10">
                    <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No history yet for this patient.</p>
                  </div>
                ) : (
                  <ol className="relative border-l-2 border-border ml-3 space-y-5">
                    {timeline.map((entry) => (
                      <li key={`${entry.kind}-${entry.id}`} className="ml-6">
                        <span
                          className={cn(
                            "absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-card",
                            entry.kind === "visit"
                              ? "bg-primary/15 text-primary"
                              : "bg-green-500/15 text-green-600 dark:text-green-400"
                          )}
                        >
                          {entry.kind === "visit"
                            ? <Stethoscope className="w-3 h-3" />
                            : <Pill className="w-3 h-3" />}
                        </span>

                        <div className="rounded-lg border border-border bg-background/40 p-3 hover:border-primary/40 transition-colors">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {entry.kind === "visit"
                                  ? <>Visit — <span className="text-muted-foreground font-normal">{entry.type}</span></>
                                  : <>Prescription — <span className="text-muted-foreground font-normal">{entry.diagnosis ?? "No diagnosis"}</span></>}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(entry.date)}
                                {entry.kind === "visit" && entry.time && <> · <span className="font-mono">{entry.time}</span></>}
                                {entry.kind === "rx" && <> · by Dr. {entry.doctorName}</>}
                              </p>
                              {entry.kind === "rx" && entry.drugs.length > 0 && (
                                <p className="text-xs text-muted-foreground/80 mt-1.5 truncate">
                                  {entry.drugs.join(" · ")}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {entry.kind === "visit" && <StatusBadge status={entry.status} />}
                              {entry.kind === "visit" && entry.fee != null && (
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                  {entry.fee} {currencyCode}
                                </span>
                              )}
                              {entry.kind === "rx" && (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                                  {entry.drugs.length} med{entry.drugs.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
