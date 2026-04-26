import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPatients, usePatchPatient,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { useVisitTypePrices } from "@/lib/visit-prices";
import { VisitTypeBadge } from "@/lib/visit-types";
import type { VisitType } from "@/lib/visit-types";

export default function CheckoutPage() {
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { format: formatCurrency } = useCurrency();
  const { prices } = useVisitTypePrices(clinicId);

  const { data, isLoading } = useListPatients(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId) },
  });

  const patchPatient = usePatchPatient();

  const completed = (data?.data ?? [])
    .filter((p) => p.status === "completed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalDue = completed.reduce((sum, p) => {
    const price = prices[p.visitType as VisitType];
    return sum + (typeof price === "number" ? price : 0);
  }, 0);

  const handleMarkPaid = (patientId: string, name: string) => {
    // After payment, the visit cycle ends — reset patient to "waiting" off the active queue.
    // We model "paid & checked out" by keeping status=completed but the receptionist removes
    // them from the queue by re-registering them on the next visit. For now we offer a
    // simple acknowledgement that doesn't change status, so the bill can be looked up later.
    toast({ title: `${name} marked as paid` });
  };

  const handleReopenAsWaiting = (patientId: string, name: string) => {
    if (!confirm(`Send "${name}" back to the waiting list?`)) return;
    patchPatient.mutate(
      { clinicId, patientId, data: { status: "waiting", diagnosis: null, clinicalNotes: null } },
      {
        onSuccess: () => {
          toast({ title: `${name} sent back to waiting list` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
        },
        onError: () => toast({ title: "Failed to update patient", variant: "destructive" }),
      },
    );
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Receipt className="w-6 h-6 text-primary" />
                Reception · Checkout
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {completed.length} patient{completed.length !== 1 ? "s" : ""} ready for billing.
                Amounts come from your Visit Type pricing in Settings.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total due now</p>
                <p className="text-lg font-bold font-mono" data-testid="checkout-total">
                  {formatCurrency(totalDue)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>ID</span>
              <span>Patient</span>
              <span>Phone</span>
              <span>Visit Type</span>
              <span>Amount Due</span>
              <span>Action</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : !completed.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">Nothing to bill yet</p>
                <p className="text-xs mt-1">
                  Patients show up here once the doctor finishes their session.
                </p>
              </div>
            ) : (
              completed.map((p) => {
                const price = prices[p.visitType as VisitType];
                const due = typeof price === "number" ? price : null;
                return (
                  <div
                    key={p.id}
                    data-testid={`checkout-row-${p.id}`}
                    className="grid grid-cols-[110px_1fr_1fr_auto_auto_auto] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm font-mono font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-center">
                      {p.code ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{p.name.charAt(0)}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">{p.phone}</span>
                    <VisitTypeBadge type={p.visitType} />
                    <span
                      className="text-sm font-bold font-mono"
                      data-testid={`amount-due-${p.id}`}
                    >
                      {due !== null ? formatCurrency(due) : (
                        <span className="text-muted-foreground text-xs">Set in Settings</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(p.id, p.name)}
                        data-testid={`mark-paid-${p.id}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Mark Paid
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReopenAsWaiting(p.id, p.name)}
                        disabled={patchPatient.isPending}
                        data-testid={`reopen-${p.id}`}
                      >
                        {patchPatient.isPending && patchPatient.variables?.patientId === p.id && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        Re-queue
                      </Button>
                    </div>
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
