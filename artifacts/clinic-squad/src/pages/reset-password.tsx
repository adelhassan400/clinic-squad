import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { lzResolver } from "@/lib/error-i18n";
import { z } from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLang } from "@/lib/lang";

type FormData = { password: string; confirm: string };

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLang();
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      password: z.string().min(6, t("validation.min6")),
      confirm: z.string().min(6, t("validation.min6")),
    })
    .refine((d) => d.password === d.confirm, {
      path: ["confirm"],
      message: t("validation.passwordsMismatch"),
    });

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
    resolver: lzResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const resetMutation = useResetPassword();

  useEffect(() => {
    if (!token) {
      toast({
        title: t("auth.reset.missingTitle"),
        description: t("auth.reset.missingDesc"),
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
            title: t("auth.reset.updatedTitle"),
            description: t("auth.reset.updatedDesc"),
          });
          setTimeout(() => setLocation("/login"), 1500);
        },
        onError: () => {
          toast({
            title: t("auth.reset.failTitle"),
            description: t("auth.reset.failDesc"),
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
            {t("auth.reset.heroTitle")}
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
            {t("auth.reset.heroDesc")}
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">
          {t("auth.reset.heroHelp")}
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
            <h1 className="text-2xl font-bold mb-1">{t("auth.reset.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.reset.subtitle")}
            </p>
          </div>

          {!token ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t("auth.reset.noTokenTitle")}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {t("auth.reset.noTokenDesc")}
                </p>
              </div>
            </div>
          ) : done ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t("auth.reset.updatedTitle")}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {t("auth.reset.redirecting")}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
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
                <Label htmlFor="confirm">{t("auth.reset.confirm")}</Label>
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
                {t("auth.reset.submit")}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.reset.needNew")}{" "}
            <Link
              href="/forgot-password"
              className="text-primary hover:underline font-medium"
            >
              {t("auth.reset.requestAnother")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
