import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Shield, Clock, MessageCircle, CheckCircle, LogOut, Loader2 } from "lucide-react";

const SUPPORT_WHATSAPP = "201009360198";

function buildWhatsappUrl(name: string | undefined): string {
  const safeName = (name ?? "").trim() || "there";
  const text =
    `Hello, I want to activate my 15-day free trial for ClinicSquad. My Name: ${safeName}`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export default function PendingActivationPage() {
  const { user, clinic, isAuthenticated, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (clinic && clinic.status !== "pending_approval") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, clinic, setLocation]);

  if (isLoading || !user || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const whatsappUrl = buildWhatsappUrl(user.name);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold text-lg">ClinicSquad</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { logout(); setLocation("/login"); }}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <div
              className="absolute inset-x-0 top-0 h-32 opacity-90"
              style={{
                background:
                  "linear-gradient(135deg, hsl(175 84% 32%) 0%, hsl(265 60% 65%) 100%)",
              }}
            />
            <div className="relative p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-card border border-border shadow-md flex items-center justify-center">
                  <Clock className="w-7 h-7 text-primary" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent-foreground border border-accent/20">
                  Pending Activation
                </span>
              </div>

              <h1
                className="text-2xl sm:text-3xl font-serif font-bold text-foreground leading-tight"
                data-testid="text-pending-headline"
              >
                Your request has been received!
              </h1>
              <p
                className="mt-3 text-muted-foreground leading-relaxed"
                data-testid="text-pending-body"
              >
                To activate your <span className="font-semibold text-foreground">15-day free trial</span>, please contact our technical support. We&apos;ll verify your details and unlock your dashboard within minutes.
              </p>

              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Clinic</p>
                  <p className="font-semibold text-foreground mt-1" data-testid="text-clinic-name">
                    {clinic.name}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Account</p>
                  <p className="font-semibold text-foreground mt-1" data-testid="text-user-name">
                    {user.name}
                  </p>
                </div>
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-whatsapp-activate"
                className="group mt-8 flex items-center justify-center gap-3 w-full rounded-2xl px-6 py-5 text-base sm:text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background:
                    "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                }}
              >
                <MessageCircle className="w-6 h-6" />
                Activate via WhatsApp
                <span className="hidden sm:inline text-sm font-normal opacity-90">
                  (+20 100 936 0198)
                </span>
              </a>

              <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  Tap the button above to message our support team on WhatsApp.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  Once approved, refresh this page to enter your dashboard.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  No credit card required during your 15-day trial.
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Activation is usually completed within a few minutes during business hours.
          </p>
        </div>
      </main>
    </div>
  );
}
