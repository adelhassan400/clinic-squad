import { useState } from "react";
import { CalendarDays, Megaphone, Plus, Power, Tag } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BroadcastMessage { id: string; title: string; message: string; active: boolean; createdAt: string; }
interface PromoCode { id: string; code: string; discountPercent: number; active: boolean; expiresAt: string | null; createdAt: string; }

export default function PlatformGrowthPage() {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "" });
  const [promoForm, setPromoForm] = useState({ code: "", discountPercent: "10", expiresAt: "" });
  const messagesQ = useQuery<BroadcastMessage[]>({ queryKey: ["/api/platform/messages"], queryFn: () => customFetch<BroadcastMessage[]>("/api/platform/messages") });
  const promoQ = useQuery<PromoCode[]>({ queryKey: ["/api/platform/promo-codes"], queryFn: () => customFetch<PromoCode[]>("/api/platform/promo-codes") });

  const createBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;
    try { await customFetch("/api/platform/messages", { method: "POST", body: JSON.stringify(broadcastForm) }); setBroadcastForm({ title: "", message: "" }); toast({ title: t("platformGrowth.broadcastCreated") }); qc.invalidateQueries({ queryKey: ["/api/platform/messages"] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: t("platformGrowth.actionFailed"), variant: "destructive" }); }
  };
  const createPromo = async () => {
    if (!promoForm.code.trim()) return;
    try { await customFetch("/api/platform/promo-codes", { method: "POST", body: JSON.stringify({ ...promoForm, discountPercent: Number(promoForm.discountPercent), expiresAt: promoForm.expiresAt || undefined }) }); setPromoForm({ code: "", discountPercent: "10", expiresAt: "" }); toast({ title: t("platformGrowth.promoCreated") }); qc.invalidateQueries({ queryKey: ["/api/platform/promo-codes"] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: t("platformGrowth.actionFailed"), variant: "destructive" }); }
  };
  const toggleItem = async (kind: "messages" | "promo-codes", id: string, active: boolean) => {
    try { await customFetch(`/api/platform/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ active: !active }) }); qc.invalidateQueries({ queryKey: [`/api/platform/${kind}`] }); qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] }); }
    catch { toast({ title: t("platformGrowth.actionFailed"), variant: "destructive" }); }
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div><div className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{t("platformGrowth.title")}</h1></div><p className="mt-1 text-sm text-muted-foreground">{t("platformGrowth.subtitle")}</p></div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("admin.tools.broadcasts")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformGrowth.broadcastSubtitle")}</p></div></div><div className="space-y-3"><Input placeholder={t("admin.tools.broadcastTitle")} value={broadcastForm.title} onChange={(event) => setBroadcastForm({ ...broadcastForm, title: event.target.value })} /><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={t("admin.tools.broadcastMessage")} value={broadcastForm.message} onChange={(event) => setBroadcastForm({ ...broadcastForm, message: event.target.value })} /><Button onClick={createBroadcast}><Plus className="me-2 h-4 w-4" />{t("admin.tools.publish")}</Button></div><div className="mt-6 space-y-3 border-t border-border pt-4">{(messagesQ.data ?? []).slice(0, 10).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p></div><Button size="sm" variant="outline" onClick={() => toggleItem("messages", item.id, item.active)}><Power className="me-1 h-3 w-3" />{item.active ? t("admin.tools.archive") : t("admin.tools.activate")}</Button></div>)}{(messagesQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("platformGrowth.noBroadcasts")}</p>}</div></section>
            <section className="rounded-xl border border-border bg-card p-5"><div className="mb-4 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("admin.tools.promos")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformGrowth.promoSubtitle")}</p></div></div><div className="grid gap-3 sm:grid-cols-3"><Input placeholder={t("admin.tools.code")} value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} /><Input type="number" min="1" max="100" placeholder="%" value={promoForm.discountPercent} onChange={(event) => setPromoForm({ ...promoForm, discountPercent: event.target.value })} /><div className="relative"><CalendarDays className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="ps-9" type="date" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} /></div></div><Button className="mt-3" onClick={createPromo}><Plus className="me-2 h-4 w-4" />{t("admin.tools.createPromo")}</Button><div className="mt-6 space-y-3 border-t border-border pt-4">{(promoQ.data ?? []).slice(0, 12).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex-1"><span className="font-mono font-semibold">{item.code}</span><span className="ms-2 text-xs text-muted-foreground">{item.discountPercent}%</span>{item.expiresAt && <p className="mt-1 text-xs text-muted-foreground">{t("platformGrowth.expires")}: {new Date(item.expiresAt).toLocaleDateString()}</p>}</div><Button size="sm" variant="outline" onClick={() => toggleItem("promo-codes", item.id, item.active)}><Power className="me-1 h-3 w-3" />{item.active ? t("admin.tools.disable") : t("admin.tools.activate")}</Button></div>)}{(promoQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("platformGrowth.noPromos")}</p>}</div></section>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
