import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateSubscription, getGetSubscriptionQueryKey, getGetClinicQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Crown, Shield, PhoneCall, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "basic" as const,
    name: "Basic Plan",
    price: 200,
    period: "EGP / month",
    desc: "For small clinics getting started",
    features: ["Up to 500 patients", "Appointment scheduling", "Patient records", "Staff accounts (2)", "Email support", "Basic reporting"],
  },
  {
    id: "premium" as const,
    name: "Premium Plan",
    price: 400,
    period: "EGP / month",
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
  const [submitted, setSubmitted] = useState(false);

  const clinicId = clinic?.id ?? "";
  const createMutation = useCreateSubscription();

  const handleChoose = (plan: "basic" | "premium") => {
    setSelected(plan);
    createMutation.mutate({ clinicId, data: { planType: plan } }, {
      onSuccess: () => {
        setSubmitted(true);
        qc.invalidateQueries({ queryKey: getGetSubscriptionQueryKey(clinicId) });
        qc.invalidateQueries({ queryKey: getGetClinicQueryKey(clinicId) });
        if (clinic) {
          updateClinic({ ...clinic, subscriptionPlan: plan });
        }
        toast({ title: "Subscription request submitted!", description: "Our team will confirm your payment within 24 hours." });
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
            Please send payment via WhatsApp and our team will activate your account within 24 hours.
          </p>
          <a
            href={`https://wa.me/201000000000?text=Hi!%20I%20just%20subscribed%20to%20the%20${selected === "premium" ? "Premium" : "Basic"}%20Plan%20for%20clinic:%20${encodeURIComponent(clinic?.name ?? "")}%20-%20Amount:%20${selected === "premium" ? "400" : "200"}%20EGP`}
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
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
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
          <div className="max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h3 className="font-semibold mb-2">Payment Instructions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Payment is confirmed manually. After clicking "Subscribe", you'll be directed to WhatsApp to send payment proof to our team.
              </p>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm">
                <Shield className="w-5 h-5 text-primary shrink-0" />
                <span>Vodafone Cash: <strong>01000000000</strong> — Amount: <strong>{selected === "premium" ? "400" : "200"} EGP</strong></span>
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
                Subscribe to {selected === "premium" ? "Premium" : "Basic"}
              </Button>
              <a
                href={`https://wa.me/201000000000?text=I%20want%20to%20subscribe%20to%20the%20${selected === "premium" ? "Premium" : "Basic"}%20Plan%20for%20${encodeURIComponent(clinic?.name ?? "my clinic")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="px-10 w-full sm:w-auto">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Contact via WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
