import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z
  .object({
    password: z.string().min(6, "At least 6 characters"),
    confirm: z.string().min(6, "At least 6 characters"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? "";
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const resetMutation = useResetPassword();

  useEffect(() => {
    if (!token) {
      toast({
        title: "Missing reset token",
        description: "Use the link from the password reset request page.",
        variant: "destructive",
      });
    }
  }, [token, toast]);

  const onSubmit = (data: FormData) => {
    resetMutation.mutate(
      { data: { token, password: data.password } },
      {
        onSuccess: () => {
          setDone(true);
          toast({
            title: "Password updated",
            description: "Sign in with your new password.",
          });
          setTimeout(() => setLocation("/login"), 1500);
        },
        onError: () => {
          toast({
            title: "Reset failed",
            description:
              "The reset link is invalid or has expired. Request a new one.",
            variant: "destructive",
          });
        },
      },
    );
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
            Choose a new password
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
            Pick something strong that you don't reuse elsewhere. The reset link can only be used once.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">
          Stuck? Request a fresh reset link from the sign-in page.
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
            <h1 className="text-2xl font-bold mb-1">Set a new password</h1>
            <p className="text-sm text-muted-foreground">
              Enter and confirm your new password below.
            </p>
          </div>

          {!token ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">No reset token in URL</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Open the link from your reset email or request a new one from the
                  sign-in page.
                </p>
              </div>
            </div>
          ) : done ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Password updated</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Redirecting you to the sign-in page…
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="password">New password</Label>
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
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("confirm")}
                  data-testid="input-confirm"
                  className="mt-1.5"
                />
                {errors.confirm && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.confirm.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resetMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Update Password
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need a new link?{" "}
            <Link
              href="/forgot-password"
              className="text-primary hover:underline font-medium"
            >
              Request another reset
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
