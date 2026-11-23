import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRequestPasswordReset } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, CheckCircle2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const requestMutation = useRequestPasswordReset();

  const onSubmit = (data: FormData) => {
    requestMutation.mutate(
      { data },
      {
        onSuccess: () => {
          setSubmittedEmail(data.email);
        },
        onError: () => {
          toast({
            title: "Could not submit the request",
            description: "Please try again in a moment.",
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
            <Shield className="w-5 h-5 text-sidebar-foreground" />
          </div>
          <span className="font-serif font-bold text-xl text-sidebar-foreground">
            ClinicSquad
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-sidebar-foreground leading-snug mb-4">
            Forgot your password?
          </h2>
          <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
            Enter your email and our support team will share a single-use reset link through your clinic's registered WhatsApp contact. Links expire after one hour.
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
            <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
            <p className="text-sm text-muted-foreground">
              Enter the email you use to sign in.
            </p>
          </div>

          {!submittedEmail ? (
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
                disabled={requestMutation.isPending}
                data-testid="button-request-reset"
              >
                {requestMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Request Reset Link
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      Request received
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      If an account exists for {submittedEmail}, our support team will share a one-time reset link through the registered WhatsApp contact. The link is valid for one hour.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Nothing arrived? Contact ClinicSquad support on WhatsApp and we'll verify your account and send the link.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
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
