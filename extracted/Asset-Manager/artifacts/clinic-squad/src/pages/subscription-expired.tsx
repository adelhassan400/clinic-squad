import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Crown, PhoneCall, LogOut, Shield, Sun, Moon } from "lucide-react";
import { Link } from "wouter";

const plans = [
  {
    id: "basic",
    name: "Basic Plan",
    price: "200 EGP",
    features: ["Patient management", "Appointment scheduling", "Staff accounts (2)"],
  },
  {
    id: "premium",
    name: "Premium Plan",
    price: "400 EGP",
    features: ["All Basic features", "Financial dashboard", "Unlimited patients", "Priority support"],
    highlighted: true,
  },
];

export default function SubscriptionExpiredPage() {
  const { clinic, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold">ClinicSquad</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-3xl w-full text-center">
          {/* Alert */}
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <Badge className="mb-4 bg-destructive/10 text-destructive border-destructive/20 text-sm px-4 py-1">
            Subscription Expired
          </Badge>
          <h1 className="text-3xl font-bold mb-3">Your free trial has ended</h1>
          <p className="text-muted-foreground mb-2">
            Your 15-day free trial for <strong>{clinic?.name}</strong> has expired.
          </p>
          <p className="text-muted-foreground mb-10">
            Choose a plan to restore full access to your clinic dashboard.
          </p>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl border-2 text-left flex flex-col ${
                  plan.highlighted ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <Badge className="self-start mb-3 bg-primary text-primary-foreground text-xs">Recommended</Badge>
                )}
                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold mb-4">{plan.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/subscription">
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} data-testid={`select-plan-${plan.id}`}>
                    <Crown className="w-3.5 h-3.5 mr-2" />
                    Choose {plan.id === "premium" ? "Premium" : "Basic"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* WhatsApp */}
          <div className="p-5 rounded-xl border border-border bg-card text-center">
            <p className="text-sm text-muted-foreground mb-3">Need help choosing a plan? Contact us directly.</p>
            <a
              href="https://wa.me/201000000000?text=I%20need%20help%20with%20my%20ClinicSquad%20subscription"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20">
                <PhoneCall className="w-4 h-4 mr-2" />
                Contact Support via WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
