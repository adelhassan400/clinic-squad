import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPatients, usePatchPatient,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Wallet, CheckCircle2, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { useVisitTypePrices } from "@/lib/visit-prices";
import { VisitTypeBadge } from "@/lib/visit-types";
import type { VisitType } from "@/lib/visit-types";
import { cn } from "@/lib/utils";

type PaymentMethod = "cash" | "vodafone_cash" | "instapay" | "card" | "other";

type PaymentPatient = {
  id: string;
  code?: string | null;
  name: string;
  phone: string;
  visitType?: string | null;
  status: string;
};

export default function CheckoutPage() {
  const { clinic } = useAuth();
  const { t } = useLang();
  const clinicId = clinic?.id ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { format: formatCurrency } = useCurrency();
  const { prices } = useVisitTypePrices(clinicId);

  const { data, isLoading } = useListPatients(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId) },
  });

  const patchPatient = usePatchPatient();
  const [paymentPatient, setPaymentPatient] = useState<PaymentPatient | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [receipt, setReceipt] = useState<{ patient: PaymentPatient; amount: number | null; method: PaymentMethod; reference: string; receivedAt: string } | null>(null);

  const readyForPayment = (data?.data ?? [])
    .filter((p) => p.status === "registered" || p.status === "paid")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalDue = readyForPayment
    .filter((p) => p.status === "registered")
    .reduce((sum, p) => {
    const price = prices[p.visitType as VisitType];
    return sum + (typeof price === "number" ? price : 0);
  }, 0);

  const openPaymentDialog = (patient: PaymentPatient) => {
    setPaymentPatient(patient);
    setPaymentMethod("cash");
    setPaymentReference("");
  };

  const handleMarkPaid = () => {
    if (!paymentPatient) return;
    const patient = paymentPatient;
    const reference = paymentReference.trim();
    const price = prices[patient.visitType as VisitType];
    const amount = typeof price === "number" ? price : null;
    const receivedAt = new Date().toISOString();

    patchPatient.mutate(
      {
        clinicId,
        patientId: patient.id,
        data: {
          status: "paid",
          paymentMethod,
          paymentReference: reference || null,
        },
      },
      {
        onSuccess: () => {
          setReceipt({ patient, amount, method: paymentMethod, reference, receivedAt });
          setPaymentPatient(null);
          toast({ title: `${patient.name} ${t("checkout.toast.paid")}` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
        },
        onError: () => toast({ title: t("finances.toast.failed"), variant: "destructive" }),
      },
    );
  };

  const printReceipt = () => {
    if (!receipt) return;
    const escapeText = (value: string) => value.replace(/[&<>\\"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\\"': "&quot;",
      "'": "&#039;",
    }[character] ?? character));
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast({ title: t("checkout.toast.printBlocked"), variant: "destructive" });
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>${escapeText(t("checkout.receiptTitle"))}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:420px;margin:auto}h1{font-size:22px;margin-bottom:4px}p{margin:8px 0}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}.total{font-weight:700;font-size:18px}</style></head><body dir="${document.documentElement.dir || "ltr"}"><h1>${escapeText(clinic?.name || "ClinicSquad")}</h1><p>${escapeText(t("checkout.receiptTitle"))}</p><div class="row"><span>${escapeText(t("checkout.patient"))}</span><strong>${escapeText(receipt.patient.name)}</strong></div><div class="row"><span>${escapeText(t("patients.id"))}</span><strong>${escapeText(receipt.patient.code || "—")}</strong></div><div class="row"><span>${escapeText(t("checkout.paymentMethod"))}</span><strong>${escapeText(t(`checkout.method.${receipt.method}`))}</strong></div><div class="row"><span>${escapeText(t("checkout.receivedAt"))}</span><strong>${escapeText(new Date(receipt.receivedAt).toLocaleString())}</strong></div>${receipt.reference ? `<div class="row"><span>${escapeText(t("checkout.reference"))}</span><strong>${escapeText(receipt.reference)}</strong></div>` : ""}<div class="row total"><span>${escapeText(t("checkout.amount"))}</span><strong>${escapeText(receipt.amount === null ? t("checkout.setInSettings") : formatCurrency(receipt.amount))}</strong></div><p>${escapeText(t("checkout.receiptFooter"))}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleSendToQueue = (patientId: string, name: string) => {
    if (!confirm(t("checkout.confirmQueue"))) return;
    patchPatient.mutate(
      { clinicId, patientId, data: { status: "waiting" } },
      {
        onSuccess: () => {
          toast({ title: `${name} ${t("checkout.toast.queued")}` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
        },
        onError: () => toast({ title: t("finances.toast.failed"), variant: "destructive" }),
      },
    );
  };

  return (
    <ProtectedRoute requireRole={["admin", "doctor", "assistant", "secretary", "nurse"]}>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Receipt className="w-6 h-6 text-primary" />
                {t("checkout.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {readyForPayment.length} {readyForPayment.length === 1 ? t("checkout.patientReady") : t("checkout.patientsReady")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("checkout.processSummary")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/30 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("checkout.totalDue")}</p>
                <p className="text-lg font-bold font-mono" data-testid="checkout-total">
                  {formatCurrency(totalDue)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[110px_minmax(180px,1fr)_minmax(150px,1fr)_140px_130px_210px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("patients.id")}</span>
              <span>{t("presc.patient")}</span>
              <span>{t("patients.phone")}</span>
              <span>{t("patients.visitType")}</span>
              <span>{t("checkout.amountDue")}</span>
              <span>{t("waiting.action")}</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : !readyForPayment.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{t("checkout.empty")}</p>
                <p className="text-xs mt-1">
                  {t("checkout.emptyDesc")}
                </p>
              </div>
            ) : (
              readyForPayment.map((p) => {
                const price = prices[p.visitType as VisitType];
                const due = typeof price === "number" ? price : null;
                return (
                  <div
                    key={p.id}
                    data-testid={`checkout-row-${p.id}`}
                    className="grid grid-cols-[110px_minmax(180px,1fr)_minmax(150px,1fr)_140px_130px_210px] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
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
                        <span className="text-muted-foreground text-xs">{t("checkout.setInSettings")}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => openPaymentDialog(p)}
                        disabled={patchPatient.isPending || p.status === "paid"}
                        data-testid={`mark-paid-${p.id}`}
                      >
                        {patchPatient.isPending && patchPatient.variables?.patientId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        {p.status === "paid" ? t("checkout.paid") : t("checkout.markPaid")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendToQueue(p.id, p.name)}
                        disabled={patchPatient.isPending || p.status !== "paid"}
                        data-testid={`send-to-queue-${p.id}`}
                      >
                        {patchPatient.isPending && patchPatient.variables?.patientId === p.id && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        {t("checkout.sendToQueue")}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={!!paymentPatient} onOpenChange={(open) => { if (!open && !patchPatient.isPending) setPaymentPatient(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("checkout.paymentDialog.title")}</DialogTitle>
              <DialogDescription>{paymentPatient ? `${paymentPatient.name} · ${paymentPatient.code ?? "—"}` : ""}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium">{t("checkout.paymentDialog.desc")}</p>
                <p className="mt-1 text-muted-foreground">{paymentPatient && typeof prices[paymentPatient.visitType as VisitType] === "number" ? formatCurrency(prices[paymentPatient.visitType as VisitType] as number) : t("checkout.setInSettings")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("checkout.paymentMethod")}</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("checkout.method.cash")}</SelectItem>
                    <SelectItem value="vodafone_cash">{t("checkout.method.vodafone_cash")}</SelectItem>
                    <SelectItem value="instapay">{t("checkout.method.instapay")}</SelectItem>
                    <SelectItem value="card">{t("checkout.method.card")}</SelectItem>
                    <SelectItem value="other">{t("checkout.method.other")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("checkout.cashHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-reference">{t("checkout.reference")}</Label>
                <Input id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder={t("checkout.referencePlaceholder")} maxLength={120} />
                <p className="text-xs text-muted-foreground">{t("checkout.referenceHint")}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentPatient(null)} disabled={patchPatient.isPending}>{t("common.cancel")}</Button>
              <Button type="button" onClick={handleMarkPaid} disabled={patchPatient.isPending}>
                {patchPatient.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {t("checkout.confirmPayment")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("checkout.receiptTitle")}</DialogTitle>
              <DialogDescription>{t("checkout.receiptSaved")}</DialogDescription>
            </DialogHeader>
            {receipt && (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">{receipt.patient.name}</p>
                  <p className="text-xs text-muted-foreground">{receipt.patient.code ?? "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <span>{t("checkout.paymentMethod")}</span><span className="text-right font-medium text-foreground">{t(`checkout.method.${receipt.method}`)}</span>
                  <span>{t("checkout.amount")}</span><span className="text-right font-medium text-foreground">{receipt.amount === null ? t("checkout.setInSettings") : formatCurrency(receipt.amount)}</span>
                  {receipt.reference && <><span>{t("checkout.reference")}</span><span className="text-right font-medium text-foreground break-all">{receipt.reference}</span></>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceipt(null)}>{t("common.close")}</Button>
              <Button type="button" onClick={printReceipt}><Printer className="w-4 h-4 mr-2" />{t("checkout.printReceipt")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
