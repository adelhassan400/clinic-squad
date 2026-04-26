import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, MailCheck, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type Status = "loading" | "missing" | "success" | "error";

export default function VerifyEmailPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const verifyMutation = useVerifyEmail();
  const ranRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("missing");
      return;
    }

    verifyMutation.mutate(
      { data: { token } },
      {
        onSuccess: (response) => {
          login(
            response.user as Parameters<typeof login>[0],
            response.clinic as Parameters<typeof login>[1],
            response.token,
          );
          setStatus("success");
          toast({
            title: "Email verified",
            description: "Welcome to ClinicSquad — your trial has started.",
          });
          setTimeout(() => {
            setLocation(
              response.user.role === "superadmin" ? "/admin" : "/dashboard",
            );
          }, 1200);
        },
        onError: (err: Error) => {
          setStatus("error");
          const msg = err?.message?.includes("400")
            ? "This verification link is invalid or has expired."
            : "Could not verify email. Please try again.";
          setErrorMsg(msg);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-lg">ClinicSquad</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <h1 className="text-xl font-bold">Verifying your email…</h1>
              <p className="text-sm text-muted-foreground">
                Hang tight, this only takes a moment.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <MailCheck className="w-10 h-10 text-primary mx-auto" />
              <h1 className="text-xl font-bold">Email verified!</h1>
              <p className="text-sm text-muted-foreground">
                Your 15-day free trial has started. Redirecting you to your dashboard…
              </p>
            </>
          )}

          {status === "missing" && (
            <>
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Missing verification token</h1>
              <p className="text-sm text-muted-foreground">
                The link you followed didn't include a verification token. Try clicking the link from your registration page again, or request a new one.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">Back to sign in</Button>
                </Link>
                <Link href="/resend-verification">
                  <Button size="sm">Resend link</Button>
                </Link>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Verification failed</h1>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <div className="flex gap-2 justify-center pt-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">Back to sign in</Button>
                </Link>
                <Link href="/resend-verification">
                  <Button size="sm">Resend link</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
