import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetInvitation, useAcceptInvitation } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Shield, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Min 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const [, params] = useRoute<{ token: string }>("/invite/:token");
  const token = params?.token ?? "";
  const { t } = useLang();
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPw, setShowPw] = useState(false);

  const inviteQ = useGetInvitation(token, { query: { enabled: !!token, retry: false } });
  const acceptMut = useAcceptInvitation();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "" },
  });

  const onSubmit = (data: FormData) => {
    acceptMut.mutate(
      { token, data },
      {
        onSuccess: (response: any) => {
          login(response.user, response.clinic, response.token);
          toast({ title: t("invite.toast.welcome") });
          setLocation("/dashboard");
        },
        onError: () => {
          toast({
            title: t("invite.toast.failed"),
            description: t("invite.toast.failedDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-serif font-bold">ClinicSquad</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {inviteQ.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : inviteQ.isError || !inviteQ.data ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h1 className="text-xl font-bold mb-2">{t("invite.invalid.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("invite.invalid.body")}</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold mb-2">{t("invite.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("invite.subtitle.prefix")}{" "}
                  <span className="font-semibold text-foreground">
                    {inviteQ.data.clinicName}
                  </span>{" "}
                  {t("invite.subtitle.as")}{" "}
                  <span className="font-semibold text-foreground">
                    {t(`team.role.${inviteQ.data.role}`)}
                  </span>
                  .
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("invite.email")}:{" "}
                  <span className="font-mono">{inviteQ.data.email}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("invite.fullName")}</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    defaultValue={inviteQ.data.name}
                    className="mt-1.5"
                    data-testid="input-accept-name"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">{t("invite.password")}</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password")}
                      className="pr-10"
                      data-testid="input-accept-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={acceptMut.isPending}
                  data-testid="button-accept-invite"
                >
                  {acceptMut.isPending && (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  )}
                  {t("invite.accept")}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
