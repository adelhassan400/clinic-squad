import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Loader2, CheckCircle, MailCheck, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z.object({
  clinicName: z.string().min(2, "Clinic name must be at least 2 characters"),
  ownerName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { clinicName: "", ownerName: "", email: "", password: "" },
  });

  const registerMutation = useRegisterUser();

  const onSubmit = (data: FormData) => {
    registerMutation.mutate({ data }, {
      onSuccess: (response) => {
        setVerifyUrl(response.verifyUrl ?? null);
        setVerifyToken(response.verifyToken ?? null);
        setExpiresAt(response.expiresAt ?? null);
        toast({
          title: "Account created",
          description: "Verify your email to start your trial.",
        });
      },
      onError: (err: Error) => {
        const msg = err?.message?.includes("409") ? "An account with this email already exists." : "Registration failed. Please try again.";
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
      },
    });
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
          <span className="font-serif font-bold text-xl text-sidebar-foreground">ClinicSquad</span>
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-sidebar-foreground leading-snug mb-4">
            Start your free 15-day trial today
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed mb-6">
            No credit card required. Set up your clinic in under 2 minutes.
          </p>
          <div className="space-y-3">
            {["Full access during trial", "Both Basic and Premium features", "Cancel anytime"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                <CheckCircle className="w-4 h-4 text-primary" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/40">Trusted by 500+ Egyptian clinics</p>
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
            {!verifyToken && !verifyUrl ? (
              <>
                <h1 className="text-2xl font-bold mb-1">Register your clinic</h1>
                <p className="text-sm text-muted-foreground">Start your 15-day free trial — no credit card needed</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-1">Verify your email</h1>
                <p className="text-sm text-muted-foreground">One last step before your trial begins.</p>
              </>
            )}
          </div>

          {!verifyToken && !verifyUrl ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="clinicName">Clinic Name</Label>
                <Input
                  id="clinicName"
                  placeholder="Cairo Medical Center"
                  {...register("clinicName")}
                  data-testid="input-clinic-name"
                  className="mt-1.5"
                />
                {errors.clinicName && <p className="text-xs text-destructive mt-1">{errors.clinicName.message}</p>}
              </div>

              <div>
                <Label htmlFor="ownerName">Your Full Name</Label>
                <Input
                  id="ownerName"
                  placeholder="Dr. Ahmed Hassan"
                  {...register("ownerName")}
                  data-testid="input-owner-name"
                  className="mt-1.5"
                />
                {errors.ownerName && <p className="text-xs text-destructive mt-1">{errors.ownerName.message}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  {...register("email")}
                  data-testid="input-email"
                  className="mt-1.5"
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    {...register("password")}
                    data-testid="input-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending} data-testid="button-submit">
                {registerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account & Start Trial
              </Button>
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
                    Or open the link directly:{" "}
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
                In production, this link would be emailed to you. For now we display it directly so you can finish signing up. Your trial begins as soon as your email is verified.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By registering, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
