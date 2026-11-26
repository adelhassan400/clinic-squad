import { useState } from "react";
import {
  useListTeamMembers,
  getListTeamMembersQueryKey,
} from "@workspace/api-client-react";
import { useQueue, queueKey } from "@/lib/queue";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPatients,
  usePatchPatient,
  getListPatientsQueryKey,
  getGetPatientQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Stethoscope,
  Clock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  HeartPulse,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { VisitTypeBadge } from "@/lib/visit-types";
import { useToast } from "@/hooks/use-toast";
import { VitalsDialog } from "@/components/VitalsDialog";
import { useTodayVisits, formatVitals } from "@/lib/visit-records";

function displayAge(age: number | null | undefined): string {
  if (age === null || age === undefined) return "—";
  return `${age}`;
}

function PaymentPill({
  paymentStatus,
  paymentMethod,
  paymentAmount,
}: {
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentAmount?: string | number | null;
}) {
  const { t } = useLang();
  const status = paymentStatus || (paymentMethod ? "paid" : "unpaid");
  const methodKey =
    paymentMethod &&
    ["cash", "vodafone_cash", "instapay", "card", "other"].includes(
      paymentMethod,
    )
      ? `checkout.method.${paymentMethod}`
      : null;
  if (status === "free") {
    return (
      <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300">
        <span className="truncate">{t("waiting.free")}</span>
      </span>
    );
  }
  if (status === "unpaid") {
    return (
      <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <Clock className="w-3 h-3 shrink-0" />
        <span className="truncate">{t("waiting.unpaid")}</span>
      </span>
    );
  }
  const amount = Number(paymentAmount ?? 0);
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span className="truncate">
        {t("waiting.paid")} · EGP{" "}
        {Number.isFinite(amount) ? amount.toLocaleString() : "0"}
        {methodKey ? ` · ${t(methodKey)}` : ""}
      </span>
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useLang();
  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        {t("status.inProgress")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
      <Clock className="w-3 h-3" /> {t("status.waiting")}
    </span>
  );
}

export default function WaitingListPage() {
  const { clinic, user } = useAuth();
  const isDoctor = user?.role === "admin" || user?.role === "doctor";
  const { t } = useLang();
  const clinicId = clinic?.id ?? "";
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [doctorId, setDoctorId] = useState("");
  const { data: team } = useListTeamMembers(clinicId, {
    query: {
      enabled: !!clinicId && user?.role !== "doctor",
      queryKey: getListTeamMembersQueryKey(clinicId),
    },
  });
  const { data, isLoading, isError, refetch } = useQueue(
    clinicId,
    doctorId || undefined,
  );

  const patchPatient = usePatchPatient();

  const { data: visitsToday } = useTodayVisits(clinicId);
  const visitByPatient = new Map((visitsToday?.data ?? []).map((v) => [v.patientId, v]));
  const [vitalsFor, setVitalsFor] = useState<{ id: string; name: string } | null>(null);

  const active = data?.data ?? [];

  // Queue position is computed only across "waiting" patients (in-progress = 0).
  const waitingOnly = active.filter((p) => p.status === "waiting");
  const positionByPatientId = new Map<string, number>(
    waitingOnly.map((p, i) => [p.id, i + 1]),
  );

  const handleOpen = (patientId: string, currentStatus: string) => {
    if (!isDoctor) return;
    if (currentStatus === "waiting") {
      patchPatient.mutate(
        { clinicId, patientId, data: { status: "in-progress" } },
        {
          onSuccess: () => {
            qc.invalidateQueries({
              queryKey: getListPatientsQueryKey(clinicId),
            });
            qc.invalidateQueries({ queryKey: queueKey(clinicId) });
            qc.invalidateQueries({
              queryKey: getGetPatientQueryKey(clinicId, patientId),
            });
            navigate(`/patients/${patientId}`);
          },
          onError: () => {
            toast({ title: t("waiting.failedOpen"), variant: "destructive" });
          },
        },
      );
    } else {
      navigate(`/patients/${patientId}`);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-primary" />
                {t("waiting.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {active.length}{" "}
                {active.length === 1
                  ? t("waiting.count")
                  : t("waiting.countPlural")}
              </p>
            </div>
          </div>

          {user?.role !== "doctor" && (
            <label className="flex items-center gap-2 mb-4 text-sm">
              {t("x.doctor")}
              <select
                aria-label={t("x.queueDoctor")}
                className="border rounded p-2 bg-background"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">{t("waiting.allDoctors")}</option>
                {(team?.members ?? [])
                  .filter((m) => ["admin", "doctor"].includes(m.role))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {isError && (
            <p role="alert">
              {t("x.queueRefreshFailed")}{" "}
              <Button variant="outline" onClick={() => refetch()}>
                {t("x.retry")}
              </Button>
            </p>
          )}
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <div className="hidden md:grid md:min-w-[990px] md:grid-cols-[40px_90px_minmax(150px,1.2fr)_45px_minmax(100px,1fr)_125px_150px_150px] gap-2 px-3 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="text-center">#</span>
              <span>{t("patients.id")}</span>
              <span>{t("patients.name")}</span>
              <span>{t("patients.age")}</span>
              <span>{t("patients.phone")}</span>
              <span>{t("patients.visitType")}</span>
              <span>{t("patients.status")}</span>
              <span>{t("waiting.action")}</span>
            </div>

            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="px-6 py-4 border-b border-border last:border-0"
                >
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : !active.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{t("waiting.empty")}</p>
                <p className="text-xs mt-1">{t("waiting.emptyDesc")}</p>
              </div>
            ) : (
              active.map((p) => {
                const queuePos = positionByPatientId.get(p.id);
                return (
                  <div
                    key={p.id}
                    data-testid={`waiting-row-${p.id}`}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 md:grid md:min-w-[990px] md:grid-cols-[40px_90px_minmax(150px,1.2fr)_45px_minmax(100px,1fr)_125px_150px_150px] md:gap-4 md:px-6 border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                      p.status === "in-progress" && "bg-primary/[0.04]",
                    )}
                  >
                    <span
                      data-testid={`queue-position-${p.id}`}
                      className={cn(
                        "inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold mx-auto",
                        p.status === "in-progress"
                          ? "bg-primary text-primary-foreground"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
                      )}
                    >
                      {p.status === "in-progress" ? "•" : queuePos}
                    </span>
                    <span className="text-sm font-mono font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-center">
                      {p.code ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 min-w-0 max-md:flex-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {p.name.charAt(0)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">
                      {displayAge(p.age)}
                    </span>
                    <span className="min-w-0 truncate text-sm text-muted-foreground font-mono">
                      {p.phone}
                    </span>
                    <span data-testid={`waiting-visit-type-${p.id}`}>
                      <VisitTypeBadge type={p.visitType} />
                    </span>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <PaymentPill
                        paymentStatus={p.paymentStatus}
                        paymentMethod={p.paymentMethod}
                        paymentAmount={p.paymentAmount}
                      />
                      <StatusPill status={p.status} />
                      {(() => {
                        const v = visitByPatient.get(p.id);
                        const chips = formatVitals(v?.vitals);
                        return (
                          <>
                            {v?.ready && (
                              <span
                                data-testid={`ready-${p.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              >
                                <CheckCircle2 className="w-3 h-3" /> {t("vitals.ready")}
                              </span>
                            )}
                            {chips.length > 0 && (
                              <span className="text-[10px] text-muted-foreground leading-tight">{chips.slice(0, 3).join(" · ")}</span>
                            )}
                            {p.status !== "completed" && (
                              <button
                                type="button"
                                onClick={() => setVitalsFor({ id: p.id, name: p.name })}
                                data-testid={`vitals-btn-${p.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                              >
                                <HeartPulse className="w-3 h-3" />
                                {v?.vitals ? t("vitals.edit") : t("vitals.add")}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <Button
                      size="sm"
                      className="max-md:w-full"
                      onClick={() => handleOpen(p.id, p.status)}
                      disabled={patchPatient.isPending || !isDoctor}
                      data-testid={`open-patient-${p.id}`}
                    >
                      {patchPatient.isPending &&
                      patchPatient.variables?.patientId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 me-1" />
                      )}
                      {isDoctor ? t("waiting.open") : t("waiting.doctorOnly")}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <VitalsDialog
          open={!!vitalsFor}
          onOpenChange={(o) => !o && setVitalsFor(null)}
          clinicId={clinicId}
          patientId={vitalsFor?.id ?? ""}
          patientName={vitalsFor?.name ?? ""}
          initial={vitalsFor ? visitByPatient.get(vitalsFor.id)?.vitals : null}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
