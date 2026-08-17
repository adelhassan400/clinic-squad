import { useState } from "react";
import { CheckCircle, CreditCard, FileText, Loader2, MessageCircle, Receipt, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrency } from "@/lib/currency";
import { useLang } from "@/lib/lang";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { whatsappUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminSubscription {
  id: string;
  clinicId: string;
  clinicName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerWhatsappNumber?: string | null;
  planType: string;
  billingPeriod?: string;
  durationMonths?: string;
  startDate: string;
  endDate: string;
  paymentStatus: string;
  amount: number;
  paymentProof?: string | null;
  transactionReference?: string | null;
  createdAt: string;
}
export default function PlatformPaymentsPage() {
  const { t, lang } = useLang();
  const { currency: { code: currencyCode } } = useCurrency();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approvalDurations, setApprovalDurations] = useState<Record<string, number>>({});
  const subsQ = useQuery<AdminSubscription[]>({ queryKey: ["/api/admin/subscriptions"], queryFn: () => customFetch<AdminSubscription[]>("/api/admin/subscriptions") });
  const confirmMutation = useMutation({ mutationFn: ({ clinicId, durationMonths }: { clinicId: string; durationMonths: number }) => customFetch(`/api/admin/subscriptions/${clinicId}/confirm`, { method: "POST", body: JSON.stringify({ durationMonths }) }) });
  const subscriptions = subsQ.data ?? [];
  const pending = subscriptions.filter((item) => item.paymentStatus === "pending");
  const confirmed = subscriptions.filter((item) => item.paymentStatus === "confirmed");

  const confirmPayment = (item: AdminSubscription) => {
    const months = approvalDurations[item.id] || Number(item.durationMonths) || 1;
    confirmMutation.mutate({ clinicId: item.clinicId, durationMonths: months }, {
      onSuccess: () => { toast({ title: t("platformPayments.confirmedToast") }); qc.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"], exact: false }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); },
      onError: () => toast({ title: t("platformPayments.confirmFailed"), variant: "destructive" }),
    });
  };

  const openPaymentWhatsApp = (item: AdminSubscription) => {
    if (!item.ownerWhatsappNumber) return;
    const doctorName = item.ownerName || item.ownerEmail || "Doctor";
    const message = t("platformPayments.whatsappMessage")
      .replace("{name}", doctorName)
      .replace("{clinic}", item.clinicName);
    window.open(whatsappUrl(item.ownerWhatsappNumber, message), "_blank", "noopener,noreferrer");
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div><div className="flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{t("platformPayments.title")}</h1></div><p className="mt-1 text-sm text-muted-foreground">{t("platformPayments.subtitle")}</p></div>

          <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><Receipt className="h-4 w-4 text-yellow-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformPayments.pending")}</p><p className="mt-1 text-2xl font-bold text-yellow-600">{pending.length}</p></div><div className="rounded-xl border border-border bg-card p-5"><CheckCircle className="h-4 w-4 text-green-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformPayments.confirmed")}</p><p className="mt-1 text-2xl font-bold text-green-600">{confirmed.length}</p></div><div className="rounded-xl border border-border bg-card p-5"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformPayments.workflow")}</p><p className="mt-1 text-sm font-semibold">{t("platformPayments.manualVerification")}</p></div></div>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-4"><Receipt className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("platformPayments.pendingTitle")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformPayments.pendingSubtitle")}</p></div></div>
            {subsQ.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div> : pending.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">{t("platformPayments.emptyPending")}</div> : <div className="divide-y divide-border">{pending.map((item) => <div key={item.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.clinicName}</h3><span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">{t("platformPayments.pendingBadge")}</span></div><p className="mt-1 text-sm text-muted-foreground capitalize">{item.planType} · {item.billingPeriod ?? "monthly"} · {item.durationMonths ?? "1"} {t("platformPayments.months")}</p><div className="mt-3">{item.ownerWhatsappNumber ? <Button type="button" size="sm" variant="outline" onClick={() => openPaymentWhatsApp(item)}><MessageCircle className="me-2 h-4 w-4 text-green-600" />{t("platformPayments.chatWhatsApp")}</Button> : <p className="text-xs text-muted-foreground">{t("platformPayments.whatsappUnavailable")}</p>}</div><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>{t("platformPayments.amount")}: <strong className="text-foreground">{item.amount} {currencyCode}</strong></span><span>{t("platformPayments.submitted")}: {formatDate(item.createdAt)}</span><span>{t("platformPayments.reference")}: <strong className="text-foreground">{item.transactionReference || "—"}</strong></span></div>{item.paymentProof && (item.paymentProof.startsWith("data:image/") ? <a href={item.paymentProof} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-muted/20 p-1.5 hover:bg-muted/40"><img src={item.paymentProof} alt={t("platformPayments.receiptAlt")} className="h-20 w-20 rounded object-cover" /><span className="px-2 text-xs text-primary">{t("platformPayments.viewReceipt")}</span></a> : <p className="mt-2 text-xs text-muted-foreground">{t("platformPayments.proofAvailable")}</p>)}</div><div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 lg:w-64"><label className="text-xs font-medium text-muted-foreground">{t("platformPayments.grantDuration")}</label><select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={approvalDurations[item.id] || Number(item.durationMonths) || 1} onChange={(event) => setApprovalDurations({ ...approvalDurations, [item.id]: Number(event.target.value) })}><option value={1}>1 {t("platformPayments.month")}</option><option value={3}>3 {t("platformPayments.months")}</option><option value={6}>6 {t("platformPayments.months")}</option><option value={12}>1 {t("platformPayments.year")}</option><option value={24}>2 {t("platformPayments.years")}</option></select><Button onClick={() => confirmPayment(item)} disabled={confirmMutation.isPending}>{confirmMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle className="me-2 h-4 w-4" />}{t("platformPayments.approve")}</Button></div></div></div>)}</div>}
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-4"><FileText className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("platformPayments.historyTitle")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformPayments.historySubtitle")}</p></div></div>{confirmed.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{t("platformPayments.emptyHistory")}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 text-start">{t("platformPayments.clinic")}</th><th className="px-5 py-3 text-start">{t("platformPayments.plan")}</th><th className="px-5 py-3 text-start">{t("platformPayments.period")}</th><th className="px-5 py-3 text-end">{t("platformPayments.amount")}</th><th className="px-5 py-3 text-end">{t("platformPayments.confirmedDate")}</th></tr></thead><tbody>{confirmed.slice(0, 50).map((item) => <tr key={item.id} className="border-t border-border"><td className="px-5 py-3 font-medium">{item.clinicName}</td><td className="px-5 py-3 capitalize">{item.planType}</td><td className="px-5 py-3 capitalize text-muted-foreground">{item.billingPeriod ?? "monthly"} · {item.durationMonths ?? "1"}m</td><td className="px-5 py-3 text-end font-semibold text-green-600">{item.amount} {currencyCode}</td><td className="px-5 py-3 text-end text-xs text-muted-foreground">{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div>}</section>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
