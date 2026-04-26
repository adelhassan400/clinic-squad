import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResendVerification } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, MailCheck, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type FormData = z.infer<typeof schema>;

export default function ResendVerificationPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  const presetEmail = (() => {
    const idx = location.indexOf("?");
    const search = idx >= 0 ? location.slice(idx) : window.location.search;
    return new URLSearchParams(search).get("email") ?? "";
  })();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: presetEmail },
  });

  useEffect(() => {
    if (presetEmail) setValue("email", presetEmail);
  }, [presetEmail, setValue]);

  const resendMutation = useResendVerification();

  const onSubmit = (data: FormData) => {
    resendMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          setVerifyUrl(response.verifyUrl ?? null);
          setVerifyToken(response.verifyToken ?? null);
          setExpiresAt(response.expiresAt ?? null);
          setSubmittedMsg(response.message);
          if (!response.verifyUrl) {
            toast({
              title: "Request received",
              description: response.message,
            });
          }
        },
        onError: () => {
          toast({
            title: "Could not generate verification link",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const copyLink = async () => {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold text-xl text-sidebar-foreground">
            ClinicSquad
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-sidebar-foreground leading-snug mb-4">
            Resend verification email
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
            Enter the email you registered with and we'll generate a fresh, single-use verification link valid for 24 hours.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">
          Need help? Contact your clinic administrator.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6 lg:mb-8">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-serif font-bold text-lg">ClinicSquad</span>
              </div>
              <div className="hidden lg:block" />
              <LanguageSwitcher />
            </div>
            <h1 className="text-2xl font-bold mb-1">Resend verification link</h1>
            <p className="text-sm text-muted-foreground">
              We'll generate a fresh one-time link for the email you enter below.
            </p>
          </div>

          {!verifyUrl && !verifyToken ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  {...register("email")}
                  data-testid="input-email"
                  className="mt-1.5"
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resendMutation.isPending}
                data-testid="button-resend"
              >
                {resendMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Generate verification link
              </Button>

              {submittedMsg && (
                <p className="text-xs text-muted-foreground text-center">
                  {submittedMsg}
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MailCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      Verification link generated
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {expiresAt
                        ? `Valid for 24 hours (until ${new Date(expiresAt).toLocaleString()}).`
                        : "Valid for 24 hours."}
                    </p>
                  </div>
                </div>

                {verifyUrl && (
                  <div className="space-y-2">
                    <Label className="text-xs">Verification link</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={verifyUrl}
                        data-testid="input-verify-url"
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyLink}
                        data-testid="button-copy-verify-link"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {verifyToken && (
                  <p className="text-xs text-muted-foreground">
                    Or verify directly:{" "}
                    <Link
                      href={`/verify-email?token=${encodeURIComponent(verifyToken)}`}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      data-testid="link-open-verify"
                    >
                      Verify now <ArrowRight className="w-3 h-3" />
                    </Link>
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                If the email isn't registered or is already verified, no link will appear here.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
