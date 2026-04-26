import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Loader2, MailWarning } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLoginUser();

  const onSubmit = (data: FormData) => {
    setUnverifiedEmail(null);
    loginMutation.mutate({ data }, {
      onSuccess: (response) => {
        login(response.user as Parameters<typeof login>[0], response.clinic as Parameters<typeof login>[1], response.token);
        if (response.user.role === "superadmin") {
          setLocation("/admin");
          return;
        }
        const clinicActive =
          response.clinic.status === "active" &&
          response.clinic.subscriptionStatus !== "expired";
        setLocation(clinicActive ? "/dashboard" : "/pending-activation");
      },
      onError: (err: Error) => {
        const msg = err?.message ?? "";
        if (msg.includes("403") && msg.toLowerCase().includes("email_not_verified")) {
          setUnverifiedEmail(data.email);
          toast({
            title: "Email not verified",
            description: "Please verify your email before signing in.",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold text-xl text-sidebar-foreground">ClinicSquad</span>
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-sidebar-foreground leading-snug mb-4">
            The command center for your clinic
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
            Manage patients, appointments, and finances — all in one place, built for Egyptian clinics.
          </p>
        </div>
        <div className="space-y-3">
          {["Patient management", "Appointment scheduling", "Financial tracking"].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
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
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your clinic account</p>
          </div>

          {unverifiedEmail && (
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-sm">
              <MailWarning className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Email not verified</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please verify <span className="font-medium text-foreground">{unverifiedEmail}</span> before signing in.{" "}
                  <Link
                    href={`/resend-verification?email=${encodeURIComponent(unverifiedEmail)}`}
                    className="text-primary hover:underline font-medium"
                    data-testid="link-resend-verification"
                  >
                    Resend verification link
                  </Link>
                </p>
              </div>
            </div>
          )}

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
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
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

            <div className="flex justify-end -mt-2">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-submit">
              {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Demo Accounts:</p>
            <p>Admin: admin@demo.com / demo1234</p>
            <p>SuperAdmin: super@clinicsquad.com / super1234</p>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Register your clinic
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
