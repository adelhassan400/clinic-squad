import { useState, useMemo, type ChangeEvent } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateSubscription, getGetSubscriptionQueryKey, getGetClinicQueryKey, customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Crown, Shield, PhoneCall, Loader2, Upload, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/lang";


export default function SubscriptionPage() {
  const { clinic, updateClinic } = useAuth();
  const { toast } = useToast();
  const { t } = useLang();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<"basic" | "premium" | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [transactionRef, setTransactionRef] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [receiptFileName, setReceiptFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const clinicId = clinic?.id ?? "";
  const createMutation = useCreateSubscription();
  const settingsQ = useQuery<{ basicMonthlyPrice: string; premiumMonthlyPrice: string; vodafoneCashNumber: string; instapayHandle: string; whatsappNumber: string }>({ queryKey: ["/api/platform/settings"], queryFn: () => customFetch("/api/platform/settings") });
  const promoQ = useQuery<Array<{ code: string; discountPercent: number; active: boolean; expiresAt: string | null }>>({ queryKey: ["/api/platform/promo-codes"], queryFn: () => customFetch("/api/platform/promo-codes") });
  const plans = useMemo(() => {
    const basic = Number(settingsQ.data?.basicMonthlyPrice ?? 200);
    const premium = Number(settingsQ.data?.premiumMonthlyPrice ?? 400);
    return [
      { id: "basic" as const, name: t("pricing.basic.name"), monthlyPrice: basic, annualPrice: basic * 10, desc: t("sub.basicDesc"), features: [t("planfeat.max500"), t("planfeat.records"), t("planfeat.queue"), t("planfeat.scheduling"), t("planfeat.finances"), t("planfeat.staff2"), t("planfeat.stdSupport")] },
      { id: "premium" as const, name: t("pricing.premium.name"), monthlyPrice: premium, annualPrice: premium * 10, desc: t("sub.premiumDesc"), features: [t("planfeat.allBasic"), t("planfeat.insights"), t("planfeat.reports"), t("planfeat.staff10"), t("planfeat.prioritySupport"), t("planfeat.aiSoon")], highlighted: true },
    ];
  }, [settingsQ.data, t]);
  const currentPlanObj = plans.find(p => p.id === selected);
  // Annual billing is a fixed one-year commitment; never allow a stale or tampered
  // duration state to change its price or submitted subscription period.
  const effectiveDurationMonths = billingPeriod === "annual" ? 12 : durationMonths;
  const calculatedAmount = currentPlanObj
    ? billingPeriod === "annual"
      ? currentPlanObj.annualPrice
      : currentPlanObj.monthlyPrice * effectiveDurationMonths
    : 0;
  const selectedPromo = promoQ.data?.find((item) => item.active && item.code === promoCode.trim().toUpperCase());
  const finalAmount = selectedPromo ? Math.round(calculatedAmount * (1 - selectedPromo.discountPercent / 100)) : calculatedAmount;

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      toast({ title: t("sub.toastFormat"), description: t("sub.toastFormatDesc"), variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > maxBytes) {
      toast({ title: t("sub.toastTooLarge"), description: t("sub.toastTooLargeDesc"), variant: "destructive" });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        toast({ title: t("sub.toastReadFail"), variant: "destructive" });
        return;
      }
      setPaymentProof(result);
      setReceiptFileName(file.name);
    };
    reader.onerror = () => toast({ title: t("sub.toastReadFail"), variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setPaymentProof("");
    setReceiptFileName("");
  };

  const handleChoose = (plan: "basic" | "premium") => {
    if (!paymentProof) {
      toast({ title: t("sub.toastReceiptRequired"), description: t("sub.toastReceiptRequiredDesc"), variant: "destructive" });
      return;
    }
    setSelected(plan);
    createMutation.mutate({
      clinicId,
      data: {
        planType: plan,
        billingPeriod,
        durationMonths: effectiveDurationMonths.toString(),
        amount: finalAmount.toString(),
        transactionReference: transactionRef.trim() || undefined,
        paymentProof,
      } as any
    }, {
      onSuccess: () => {
        setSubmitted(true);
        qc.invalidateQueries({ queryKey: getGetSubscriptionQueryKey(clinicId) });
        qc.invalidateQueries({ queryKey: getGetClinicQueryKey(clinicId) });
        if (clinic) {
          updateClinic({ ...clinic, subscriptionPlan: plan });
        }
        toast({ title: t("sub.toastSubmitted"), description: t("sub.toastSubmittedDesc") });
      },
      onError: () => toast({ title: t("sub.toastFail"), variant: "destructive" }),
    });
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-xl mx-auto text-center mt-16">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">{t("sub.submittedTitle")}</h1>
          <p className="text-muted-foreground mb-6">
            {t("sub.submittedPre")} <strong>{selected === "premium" ? t("pricing.premium.name") : t("pricing.basic.name")}</strong>
            {t("sub.submittedPost")}
          </p>
          <a
            href={`https://wa.me/201000000000?text=${encodeURIComponent(`Hi! I submitted a payment receipt for the ${selected === "premium" ? "Premium" : "Basic"} Plan (${effectiveDurationMonths} months) for clinic: ${clinic?.name ?? ""}. Transaction reference: ${transactionRef || "N/A"}. I will attach the receipt screenshot here.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="bg-green-600 hover:bg-green-700">
              <PhoneCall className="w-4 h-4 mr-2" />
              {t("sub.sendPayment")}
            </Button>
          </a>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t("sub.badge")}</Badge>
          <h1 className="text-3xl font-bold mb-3">{t("sub.title")}</h1>
          <p className="text-muted-foreground">{t("sub.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "p-8 rounded-2xl border-2 flex flex-col transition-all cursor-pointer",
                selected === plan.id ? "border-primary ring-2 ring-primary/20" : plan.highlighted ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                "hover:border-primary/70"
              )}
              onClick={() => setSelected(plan.id)}
              data-testid={`plan-${plan.id}`}
            >
              {plan.highlighted && <Badge className="self-start mb-4 bg-primary text-primary-foreground">{t("pricing.popular")}</Badge>}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.desc}</p>
                </div>
                {selected === plan.id && <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-1" />}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.monthlyPrice}</span>
                <span className="text-sm text-muted-foreground">{t("sub.egpMonth")}</span>
              </div>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {selected && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Billing period & duration */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">{t("sub.billingTitle")}</h3>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("sub.billingFreq")}</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={billingPeriod === "monthly" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => { setBillingPeriod("monthly"); setDurationMonths(1); }}
                    >
                      {t("sub.monthly")}
                    </Button>
                    <Button
                      type="button"
                      variant={billingPeriod === "annual" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => { setBillingPeriod("annual"); setDurationMonths(12); }}
                    >
                      {t("sub.annual")}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("sub.duration")}</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={effectiveDurationMonths}
                    disabled={billingPeriod === "annual"}
                    aria-describedby={billingPeriod === "annual" ? "annual-duration-help" : undefined}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                  >
                    <option value={1}>{t("sub.opt1m")}</option>
                    <option value={3}>{t("sub.opt3m")}</option>
                    <option value={6}>{t("sub.opt6m")}</option>
                    <option value={12}>{t("sub.opt12m")}</option>
                    <option value={24}>{t("sub.opt24m")}</option>
                  </select>
                  {billingPeriod === "annual" && (
                    <p id="annual-duration-help" className="mt-1.5 text-xs text-muted-foreground">
                      {t("sub.annualFixed")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg">
                <span className="text-sm font-medium">{t("sub.totalDue")}</span>
                <div className="text-end"><span className="text-2xl font-bold text-primary">{finalAmount} EGP</span>{selectedPromo && <p className="text-xs text-green-600">{selectedPromo.discountPercent}% {t("sub.promoApplied")}</p>}</div>
              </div>
            </div>

            {/* Payment & Receipt upload */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">{t("sub.payTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("sub.payPre")} <strong>{settingsQ.data?.vodafoneCashNumber ?? "01000000000"}</strong> {t("sub.payMid")} <strong>{settingsQ.data?.instapayHandle ?? "clinicsquad@instapay"}</strong>. {t("sub.payPost")}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">{t("sub.promoLabel")}</label>
                  <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase" placeholder={t("x.egPromo")} value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} />
                  {promoCode && !selectedPromo && <p className="mt-1 text-xs text-muted-foreground">{t("sub.promoNotFound")}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">{t("sub.txRef")}</label>
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={t("x.egTransfer")}
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="receipt-upload" className="text-xs font-medium mb-1.5 block">{t("sub.receiptLabel")}</label>
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handleReceiptChange}
                    />
                    {!paymentProof ? (
                      <label htmlFor="receipt-upload" className="flex cursor-pointer flex-col items-center justify-center gap-2 py-5 text-center">
                        <Upload className="h-8 w-8 text-primary" />
                        <span className="text-sm font-medium">{t("sub.chooseReceipt")}</span>
                        <span className="text-xs text-muted-foreground">{t("sub.receiptTypes")}</span>
                      </label>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <a href={paymentProof} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={t("x.openReceipt")}>
                          <img src={paymentProof} alt={t("x.receiptAlt")} className="h-24 w-24 rounded-md border border-border object-cover" />
                        </a>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <ImageIcon className="h-4 w-4 text-primary" />
                            <span className="truncate">{receiptFileName || t("sub.receiptSelected")}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{t("sub.receiptAttachedNote")}</p>
                        </div>
                        <div className="flex gap-2">
                          <label htmlFor="receipt-upload" className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">{t("sub.replace")}</label>
                          <Button type="button" size="icon" variant="ghost" onClick={clearReceipt} aria-label={t("x.removeReceipt")}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => handleChoose(selected)}
                disabled={createMutation.isPending}
                className="px-10"
                data-testid="button-subscribe"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                {t("sub.submitFor")} {selected === "premium" ? t("plan.premium") : t("plan.basic")}
              </Button>
              <a
                href={`https://wa.me/${settingsQ.data?.whatsappNumber ?? "201000000000"}?text=Hi!%20I%20have%20paid%20${finalAmount}%20EGP%20for%20the%20${selected === "premium" ? "Premium" : "Basic"}%20Plan%20(${durationMonths}%20months)%20for%20clinic:%20${encodeURIComponent(clinic?.name ?? "")}.%20Ref:%20${encodeURIComponent(transactionRef || "N/A")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="px-10 w-full sm:w-auto bg-green-600 text-white hover:bg-green-700">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  {t("sub.sendProof")}
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
      }
