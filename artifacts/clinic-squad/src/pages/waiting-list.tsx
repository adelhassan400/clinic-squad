import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPatients, usePatchPatient,
  getListPatientsQueryKey, getGetPatientQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, Clock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { VisitTypeBadge } from "@/lib/visit-types";
import { useToast } from "@/hooks/use-toast";

function displayAge(age: number | null | undefined): string {
  if (age === null || age === undefined) return "—";
  return `${age}`;
}

function PaymentPill({ paymentStatus, paymentMethod, paymentAmount }: { paymentStatus?: string | null; paymentMethod?: string | null; paymentAmount?: string | number | null }) {
  const { t } = useLang();
  const status = paymentStatus || (paymentMethod ? "paid" : "unpaid");
  const methodKey = paymentMethod && ["cash", "vodafone_cash", "instapay", "card", "other"].includes(paymentMethod)
    ? `checkout.method.${paymentMethod}`
    : null;
  if (status === "free") {
    return <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300"><span className="truncate">{t("waiting.free")}</span></span>;
  }
  if (status === "unpaid") {
    return <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"><Clock className="w-3 h-3 shrink-0" /><span className="truncate">{t("waiting.unpaid")}</span></span>;
  }
  const amount = Number(paymentAmount ?? 0);
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span className="truncate">{t("waiting.paid")} · EGP {Number.isFinite(amount) ? amount.toLocaleString() : "0"}{methodKey ? ` · ${t(methodKey)}` : ""}</span>
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

  const { data, isLoading } = useListPatients(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId) },
  });

  const patchPatient = usePatchPatient();

  const all = data?.data ?? [];
  const active = all
    .filter((p) => p.status === "waiting" || p.status === "in-progress")
    .sort((a, b) => {
      // in-progress first, then waiting; within each, oldest first.
      if (a.status !== b.status) return a.status === "in-progress" ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

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
            qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
            qc.invalidateQueries({ queryKey: getGetPatientQueryKey(clinicId, patientId) });
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
                {active.length} {active.length === 1 ? t("waiting.count") : t("waiting.countPlural")}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <div className="grid min-w-[1140px] grid-cols-[60px_110px_minmax(220px,1.2fr)_70px_minmax(160px,1fr)_140px_180px_140px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                <div key={i} className="px-6 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : !active.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{t("waiting.empty")}</p>
                <p className="text-xs mt-1">
                  {t("waiting.emptyDesc")}
                </p>
              </div>
            ) : (
              active.map((p) => {
                const queuePos = positionByPatientId.get(p.id);
                return (
                <div
                  key={p.id}
                  data-testid={`waiting-row-${p.id}`}
                  className={cn(
                    "grid min-w-[1140px] grid-cols-[60px_110px_minmax(220px,1.2fr)_70px_minmax(160px,1fr)_140px_180px_140px] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{p.name.charAt(0)}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{p.name}</p>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">
                    {displayAge(p.age)}
                  </span>
                  <span className="min-w-0 truncate text-sm text-muted-foreground font-mono">{p.phone}</span>
                  <span data-testid={`waiting-visit-type-${p.id}`}>
                    <VisitTypeBadge type={p.visitType} />
                  </span>
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <PaymentPill paymentStatus={p.paymentStatus} paymentMethod={p.paymentMethod} paymentAmount={p.paymentAmount} />
                    <StatusPill status={p.status} />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpen(p.id, p.status)}
                    disabled={patchPatient.isPending || !isDoctor}
                    data-testid={`open-patient-${p.id}`}
                  >
                    {patchPatient.isPending && patchPatient.variables?.patientId === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                    )}
                    {isDoctor ? t("waiting.open") : t("waiting.doctorOnly")}
                  </Button>
                </div>
                );
              })
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
