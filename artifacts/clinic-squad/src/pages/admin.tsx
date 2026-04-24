import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useAdminListClinics, useAdminActivateClinic, useAdminBlockClinic,
  useAdminConfirmSubscription, getAdminListClinicsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    deleted: "bg-muted text-muted-foreground",
  };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", map[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}

function SubBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    basic: "bg-secondary text-secondary-foreground",
    premium: "bg-accent/20 text-accent-foreground",
    expired: "bg-destructive/20 text-destructive",
  };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", map[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clinics, isLoading } = useAdminListClinics({ query: { enabled: user?.role === "superadmin", queryKey: getAdminListClinicsQueryKey() } });

  const activateMutation = useAdminActivateClinic();
  const blockMutation = useAdminBlockClinic();
  const confirmMutation = useAdminConfirmSubscription();

  const handleActivate = (clinicId: string) => {
    activateMutation.mutate({ clinicId }, {
      onSuccess: () => {
        toast({ title: "Clinic activated" });
        qc.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
      },
      onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
    });
  };

  const handleBlock = (clinicId: string) => {
    if (!confirm("Block this clinic?")) return;
    blockMutation.mutate({ clinicId }, {
      onSuccess: () => {
        toast({ title: "Clinic blocked" });
        qc.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
      },
      onError: () => toast({ title: "Failed to block", variant: "destructive" }),
    });
  };

  const handleConfirmPayment = (clinicId: string) => {
    confirmMutation.mutate({ clinicId }, {
      onSuccess: () => {
        toast({ title: "Payment confirmed & subscription activated" });
        qc.invalidateQueries({ queryKey: getAdminListClinicsQueryKey() });
      },
      onError: () => toast({ title: "Failed to confirm payment", variant: "destructive" }),
    });
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage all clinics and subscriptions</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              All Clinics ({clinics?.length ?? 0})
            </div>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-border"><Skeleton className="h-12 w-full" /></div>
              ))
            ) : !clinics?.length ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No clinics registered</div>
            ) : (
              clinics.map(clinic => (
                <div key={clinic.id} data-testid={`clinic-row-${clinic.id}`} className="px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30">
                  <div className="flex flex-wrap items-start gap-4 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-sm">{clinic.name}</p>
                        <StatusBadge status={clinic.status} />
                        <SubBadge status={clinic.subscriptionStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Registered: {formatDate(clinic.createdAt)}
                        {clinic.subscriptionStatus === "trial" && ` · Trial ends: ${formatDate(clinic.trialEndDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {clinic.status !== "active" && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleActivate(clinic.id)}
                          disabled={activateMutation.isPending}
                          className="text-green-700 border-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                          data-testid={`activate-clinic-${clinic.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Activate
                        </Button>
                      )}
                      {clinic.status === "active" && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleBlock(clinic.id)}
                          disabled={blockMutation.isPending}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          data-testid={`block-clinic-${clinic.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />Block
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleConfirmPayment(clinic.id)}
                        disabled={confirmMutation.isPending}
                        data-testid={`confirm-payment-${clinic.id}`}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />Confirm Payment
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
