import { useState, type ChangeEvent } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateSubscription, getGetSubscriptionQueryKey, getGetClinicQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Crown, Shield, PhoneCall, Loader2, Upload, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "basic" as const,
    name: "Basic Plan",
    monthlyPrice: 200,
    annualPrice: 2000,
    desc: "For small clinics getting started",
    features: ["Up to 500 patients", "Appointment scheduling", "Patient records", "Staff accounts (2)", "Email support", "Basic reporting"],
  },
  {
    id: "premium" as const,
    name: "Premium Plan",
    monthlyPrice: 400,
    annualPrice: 4000,
    desc: "Full-featured for growing clinics",
    features: ["Unlimited patients", "Advanced scheduling", "Financial dashboard", "Analytics & reports", "Unlimited staff", "Priority support", "AI-ready modules (soon)"],
    highlighted: true,
  },
];

export default function SubscriptionPage() {
  const { clinic, updateClinic } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<"basic" | "premium" | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [receiptFileName, setReceiptFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const clinicId = clinic?.id ?? "";
  const createMutation = useCreateSubscription();

  const currentPlanObj = plans.find(p => p.id === selected);
  const calculatedAmount = currentPlanObj
    ? billingPeriod === "annual"
      ? currentPlanObj.annualPrice * (durationMonths / 12)
      : currentPlanObj.monthlyPrice * durationMonths
    : 0;

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Unsupported receipt format", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (file.size > maxBytes) {
      toast({ title: "Receipt image is too large", description: "Please choose an image smaller than 5 MB.", variant: "destructive" });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        toast({ title: "Could not read receipt", variant: "destructive" });
        return;
      }
      setPaymentProof(result);
      setReceiptFileName(file.name);
    };
    reader.onerror = () => toast({ title: "Could not read receipt", variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setPaymentProof("");
    setReceiptFileName("");
  };

  const handleChoose = (plan: "basic" | "premium") => {
    if (!paymentProof) {
      toast({ title: "Receipt screenshot required", description: "Please upload your payment receipt before submitting.", variant: "destructive" });
      return;
    }
    setSelected(plan);
    createMutation.mutate({
      clinicId,
      data: {
        planType: plan,
        billingPeriod,
        durationMonths: durationMonths.toString(),
        amount: calculatedAmount.toString(),
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
        toast({ title: "Subscription request submitted!", description: "Our team will verify your payment shortly." });
      },
      onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
    });
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-xl mx-auto text-center mt-16">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Request Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Your <strong>{selected === "premium" ? "Premium" : "Basic"} Plan</strong> subscription request has been received.
            Our team will review your receipt and activate your account within 24 hours after verification.
          </p>
          <a
            href={`https://wa.me/201000000000?text=${encodeURIComponent(`Hi! I submitted a payment receipt for the ${selected === "premium" ? "Premium" : "Basic"} Plan (${durationMonths} months) for clinic: ${clinic?.name ?? ""}. Transaction reference: ${transactionRef || "N/A"}. I will attach the receipt screenshot here.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="bg-green-600 hover:bg-green-700">
              <PhoneCall className="w-4 h-4 mr-2" />
              Send Payment via WhatsApp
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
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Choose Your Plan</Badge>
          <h1 className="text-3xl font-bold mb-3">Upgrade Your Clinic</h1>
          <p className="text-muted-foreground">Select a plan to continue using ClinicSquad. Payment is confirmed manually via WhatsApp.</p>
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
              {plan.highlighted && <Badge className="self-start mb-4 bg-primary text-primary-foreground">Most Popular</Badge>}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.desc}</p>
                </div>
                {selected === plan.id && <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-1" />}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.monthlyPrice}</span>
                <span className="text-sm text-muted-foreground">EGP / month</span>
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
              <h3 className="font-semibold mb-4">Billing Period & Duration</h3>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Billing Frequency</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={billingPeriod === "monthly" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => { setBillingPeriod("monthly"); setDurationMonths(1); }}
                    >
                      Monthly
                    </Button>
                    <Button
                      type="button"
                      variant={billingPeriod === "annual" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => { setBillingPeriod("annual"); setDurationMonths(12); }}
                    >
                      Annual (Save 15%)
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duration (Months)</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>1 Year (12 Months)</option>
                    <option value={24}>2 Years (24 Months)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg">
                <span className="text-sm font-medium">Total Amount Due:</span>
                <span className="text-2xl font-bold text-primary">{calculatedAmount} EGP</span>
              </div>
            </div>

            {/* Payment & Receipt upload */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-2">Payment Instructions & Proof</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transfer the exact amount to Vodafone Cash: <strong>01000000000</strong> or InstaPay handle: <strong>clinicsquad@instapay</strong>. Then enter your transaction reference and attach your payment receipt screenshot below.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Transaction Reference / Receipt Notes</label>
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="e.g. Transfer ID #987654321"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="receipt-upload" className="text-xs font-medium mb-1.5 block">Payment Receipt Screenshot</label>
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
                        <span className="text-sm font-medium">Choose receipt screenshot</span>
                        <span className="text-xs text-muted-foreground">JPG, PNG, or WebP · maximum 5 MB</span>
                      </label>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <a href={paymentProof} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Open receipt preview">
                          <img src={paymentProof} alt="Uploaded payment receipt preview" className="h-24 w-24 rounded-md border border-border object-cover" />
                        </a>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <ImageIcon className="h-4 w-4 text-primary" />
                            <span className="truncate">{receiptFileName || "Receipt screenshot selected"}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Your receipt image will be securely attached to this payment request.</p>
                        </div>
                        <div className="flex gap-2">
                          <label htmlFor="receipt-upload" className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">Replace</label>
                          <Button type="button" size="icon" variant="ghost" onClick={clearReceipt} aria-label="Remove receipt">
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
                Submit Payment for {selected === "premium" ? "Premium" : "Basic"}
              </Button>
              <a
                href={`https://wa.me/201000000000?text=Hi!%20I%20have%20paid%20${calculatedAmount}%20EGP%20for%20the%20${selected === "premium" ? "Premium" : "Basic"}%20Plan%20(${durationMonths}%20months)%20for%20clinic:%20${encodeURIComponent(clinic?.name ?? "")}.%20Ref:%20${encodeURIComponent(transactionRef || "N/A")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="px-10 w-full sm:w-auto bg-green-600 text-white hover:bg-green-700">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Send Proof via WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
