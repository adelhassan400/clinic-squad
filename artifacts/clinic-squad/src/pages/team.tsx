import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import {
  useListTeamMembers,
  useListInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useRemoveTeamMember,
  getListTeamMembersQueryKey,
  getListInvitationsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Mail,
  Trash2,
  Copy,
  Check,
  UserPlus,
  Crown,
  Loader2,
  AlertTriangle,
  Stethoscope,
  ClipboardList,
} from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["secretary", "nurse"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

function buildInviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export default function TeamPage() {
  const { user, clinic } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (!user || !clinic) return <Redirect to="/login" />;
  if (user.role !== "admin" && user.role !== "superadmin") {
    return <Redirect to="/dashboard" />;
  }

  const clinicId = clinic.id;
  const overviewQ = useListTeamMembers(clinicId);
  const invitesQ = useListInvitations(clinicId);

  const createMut = useCreateInvitation();
  const revokeMut = useRevokeInvitation();
  const removeMut = useRemoveTeamMember();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<InviteForm>({
      resolver: zodResolver(inviteSchema),
      defaultValues: { email: "", name: "", role: "secretary" },
    });

  const overview = overviewQ.data;
  const invites = invitesQ.data ?? [];
  const limitReached = overview ? overview.usedSlots >= overview.memberLimit : false;
  const planLabel =
    overview?.plan === "premium"
      ? t("team.plan.premium")
      : overview?.plan === "trial"
      ? t("team.plan.trial")
      : overview?.plan === "basic"
      ? t("team.plan.basic")
      : t("team.plan.expired");

  const onInvite = (data: InviteForm) => {
    createMut.mutate(
      { clinicId, data },
      {
        onSuccess: () => {
          toast({ title: t("team.toast.inviteCreated") });
          reset({ email: "", name: "", role: "secretary" });
          qc.invalidateQueries({ queryKey: getListInvitationsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(clinicId) });
        },
        onError: (err: any) => {
          const status = err?.response?.status ?? err?.status;
          const description =
            status === 402
              ? t("team.toast.limitReached")
              : status === 409
              ? t("team.toast.duplicate")
              : t("team.toast.failed");
          toast({ title: t("team.toast.failedTitle"), description, variant: "destructive" });
        },
      }
    );
  };

  const onRevoke = (invitationId: string) => {
    revokeMut.mutate(
      { clinicId, invitationId },
      {
        onSuccess: () => {
          toast({ title: t("team.toast.revoked") });
          qc.invalidateQueries({ queryKey: getListInvitationsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(clinicId) });
        },
      }
    );
  };

  const onRemove = (userId: string) => {
    if (!confirm(t("team.confirm.remove"))) return;
    removeMut.mutate(
      { clinicId, userId },
      {
        onSuccess: () => {
          toast({ title: t("team.toast.removed") });
          qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(clinicId) });
        },
      }
    );
  };

  const onCopy = async (token: string) => {
    const link = buildInviteLink(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast({ title: t("team.toast.copied") });
    } catch {
      toast({
        title: t("team.toast.copyFailed"),
        description: link,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {t("team.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("team.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                overview?.plan === "premium"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }
            >
              {overview?.plan === "premium" && <Crown className="w-3 h-3 me-1" />}
              {planLabel}
            </Badge>
          </div>
        </div>

        {/* Capacity meter */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">{t("team.capacity.title")}</p>
            <p className="text-sm text-muted-foreground" data-testid="text-capacity">
              {overview?.usedSlots ?? 0} / {overview?.memberLimit ?? 0}
            </p>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={
                limitReached
                  ? "h-full bg-destructive transition-all"
                  : "h-full bg-primary transition-all"
              }
              style={{
                width: overview && overview.memberLimit > 0
                  ? `${Math.min(100, (overview.usedSlots / overview.memberLimit) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("team.capacity.note.prefix")}{" "}
            <span className="font-medium text-foreground">{planLabel}</span>{" "}
            {t("team.capacity.note.suffix")}{" "}
            <span className="font-medium text-foreground">{overview?.memberLimit ?? 0}</span>{" "}
            {t("team.capacity.members")}.
            {overview?.plan !== "premium" && (
              <>
                {" "}
                <a href="/subscription" className="text-primary hover:underline">
                  {t("team.capacity.upgrade")}
                </a>
              </>
            )}
          </p>
        </div>

        {/* Invite form */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t("team.invite.title")}
          </h2>

          {limitReached && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t("team.invite.limitMsg")}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onInvite)}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="lg:col-span-1">
              <Label htmlFor="invite-name">{t("team.invite.name")}</Label>
              <Input
                id="invite-name"
                {...register("name")}
                disabled={limitReached}
                placeholder={t("team.invite.namePh")}
                className="mt-1.5"
                data-testid="input-invite-name"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="lg:col-span-1">
              <Label htmlFor="invite-email">{t("team.invite.email")}</Label>
              <Input
                id="invite-email"
                type="email"
                {...register("email")}
                disabled={limitReached}
                placeholder="user@example.com"
                className="mt-1.5"
                data-testid="input-invite-email"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="lg:col-span-1">
              <Label>{t("team.invite.role")}</Label>
              <Select
                value={watch("role")}
                onValueChange={(v) => setValue("role", v as "secretary" | "nurse")}
                disabled={limitReached}
              >
                <SelectTrigger className="mt-1.5" data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secretary">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" />
                      {t("team.role.secretary")}
                    </div>
                  </SelectItem>
                  <SelectItem value="nurse">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      {t("team.role.nurse")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-1 flex items-end">
              <Button
                type="submit"
                className="w-full"
                disabled={limitReached || createMut.isPending}
                data-testid="button-send-invite"
              >
                {createMut.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                <Mail className="w-4 h-4 me-2" />
                {t("team.invite.send")}
              </Button>
            </div>
          </form>
        </div>

        {/* Pending invitations */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("team.pending.title")}</h2>
            <span className="text-sm text-muted-foreground">{invites.length}</span>
          </div>
          {invitesQ.isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("team.pending.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((inv) => {
                const link = buildInviteLink(inv.token);
                return (
                  <li
                    key={inv.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    data-testid={`invite-${inv.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{inv.name}</span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {t(`team.role.${inv.role}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 truncate font-mono">
                        {link}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCopy(inv.token)}
                        data-testid={`button-copy-${inv.id}`}
                      >
                        {copiedToken === inv.token ? (
                          <>
                            <Check className="w-3.5 h-3.5 me-1.5" /> {t("team.copied")}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 me-1.5" /> {t("team.copyLink")}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRevoke(inv.id)}
                        disabled={revokeMut.isPending}
                        data-testid={`button-revoke-${inv.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Active members */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("team.members.title")}</h2>
            <span className="text-sm text-muted-foreground">
              {overview?.members.length ?? 0}
            </span>
          </div>
          {overviewQ.isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {overview?.members.map((m) => (
                <li
                  key={m.id}
                  className="px-5 py-4 flex items-center gap-3"
                  data-testid={`member-${m.id}`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {t(`team.role.${m.role}`)}
                      </Badge>
                      {m.isOwner && (
                        <Badge className="bg-accent/20 text-accent-foreground text-xs">
                          <Crown className="w-3 h-3 me-1" />
                          {t("team.owner")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{m.email}</p>
                  </div>
                  {!m.isOwner && m.id !== user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(m.id)}
                      disabled={removeMut.isPending}
                      data-testid={`button-remove-${m.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
