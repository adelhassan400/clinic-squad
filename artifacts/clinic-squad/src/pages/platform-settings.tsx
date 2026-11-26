import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CreditCard, Info, Loader2, Save, Settings, Smartphone, Wallet } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/lang";
import { useToast } from "@/hooks/use-toast";
import { sanitizePhone } from "@/lib/whatsapp";

interface PlatformSettings {
  basicMonthlyPrice: string;
  premiumMonthlyPrice: string;
  vodafoneCashNumber: string;
  instapayHandle: string;
  whatsappNumber: string;
  updatedAt?: string;
}

const defaultSettings: PlatformSettings = {
  basicMonthlyPrice: "",
  premiumMonthlyPrice: "",
  vodafoneCashNumber: "",
  instapayHandle: "",
  whatsappNumber: "",
};

export default function PlatformSettingsPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(defaultSettings);
  const [savedSnapshot, setSavedSnapshot] = useState<PlatformSettings>(defaultSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editableKeys: (keyof PlatformSettings)[] = ["basicMonthlyPrice", "premiumMonthlyPrice", "vodafoneCashNumber", "instapayHandle", "whatsappNumber"];
  const isDirty = useMemo(
    () => editableKeys.some((key) => (settingsForm[key] ?? "").trim() !== (savedSnapshot[key] ?? "").trim()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsForm, savedSnapshot],
  );
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;

  const settingsQ = useQuery<PlatformSettings>({
    queryKey: ["/api/platform/settings"],
    queryFn: () => customFetch<PlatformSettings>("/api/platform/settings"),
  });

  useEffect(() => {
    if (settingsQ.data) {
      const incoming = { ...defaultSettings, ...settingsQ.data };
      setSavedSnapshot(incoming);
      // Never overwrite edits the user has not saved yet (for example after a background refetch).
      if (!dirtyRef.current) setSettingsForm(incoming);
    }
  }, [settingsQ.data]);

  // Warn before closing or reloading the tab, and before following an in-app link, with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      if (!window.confirm(t("platformSettings.leaveConfirm"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [t]);

  const updateField = (field: keyof PlatformSettings, value: string) => {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  };

  const saveSettings = async () => {
    if (!isDirty || savingSettings) return;
    setSavingSettings(true);
    setJustSaved(false);
    try {
      const saved = await customFetch<PlatformSettings>("/api/platform/settings", {
        method: "PUT",
        body: JSON.stringify({
          basicMonthlyPrice: settingsForm.basicMonthlyPrice,
          premiumMonthlyPrice: settingsForm.premiumMonthlyPrice,
          vodafoneCashNumber: settingsForm.vodafoneCashNumber,
          instapayHandle: settingsForm.instapayHandle,
          whatsappNumber: sanitizePhone(settingsForm.whatsappNumber),
        }),
      });
      const next = { ...defaultSettings, ...saved };
      setSavedSnapshot(next);
      setSettingsForm(next);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
      toast({ title: t("platformSettings.saved") });
      qc.invalidateQueries({ queryKey: ["/api/platform/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/platform/audit-logs"] });
    } catch {
      toast({ title: t("platformSettings.saveFailed"), variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">{t("platformSettings.title")}</h1>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("platformSettings.subtitle")}</p>
            </div>
            {settingsQ.data?.updatedAt && (
              <span className="text-xs text-muted-foreground">
                {t("platformSettings.lastUpdated")}: {new Date(settingsQ.data.updatedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
              </span>
            )}
          </header>

          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{t("platformSettings.info")}</p>
          </div>

          {settingsQ.isLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
              {t("platformSettings.loading")}
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><CreditCard className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">{t("platformSettings.pricingTitle")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("platformSettings.pricingSubtitle")}</p>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platform-basic-price">{t("admin.tools.basicPrice")}</Label>
                    <Input id="platform-basic-price" inputMode="decimal" value={settingsForm.basicMonthlyPrice} onChange={(event) => updateField("basicMonthlyPrice", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform-premium-price">{t("admin.tools.premiumPrice")}</Label>
                    <Input id="platform-premium-price" inputMode="decimal" value={settingsForm.premiumMonthlyPrice} onChange={(event) => updateField("premiumMonthlyPrice", event.target.value)} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><Wallet className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">{t("platformSettings.paymentTitle")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("platformSettings.paymentSubtitle")}</p>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platform-vodafone">{t("admin.tools.vodafone")}</Label>
                    <Input id="platform-vodafone" inputMode="tel" value={settingsForm.vodafoneCashNumber} onChange={(event) => updateField("vodafoneCashNumber", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform-instapay">{t("admin.tools.instapay")}</Label>
                    <Input id="platform-instapay" value={settingsForm.instapayHandle} onChange={(event) => updateField("instapayHandle", event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="platform-whatsapp" className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" />{t("admin.tools.whatsapp")}</Label>
                    <Input id="platform-whatsapp" inputMode="tel" value={settingsForm.whatsappNumber} onChange={(event) => updateField("whatsappNumber", event.target.value)} />
                    <p className="text-xs text-muted-foreground">{t("platformSettings.whatsappHint")}</p>
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-end gap-3">
                {isDirty && !savingSettings && <span className="text-xs text-amber-600" data-testid="text-unsaved">{t("platformSettings.unsaved")}</span>}
                <Button
                  onClick={saveSettings}
                  disabled={savingSettings || settingsQ.isLoading || (!isDirty && !justSaved)}
                  className={justSaved ? "bg-emerald-600 text-white hover:bg-emerald-600" : undefined}
                  data-testid="button-save-platform-settings"
                >
                  {savingSettings ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : justSaved ? (
                    <Check className="me-2 h-4 w-4" />
                  ) : (
                    <Save className="me-2 h-4 w-4" />
                  )}
                  {savingSettings ? t("platformSettings.saving") : justSaved ? t("platformSettings.savedShort") : t("platformSettings.save")}
                </Button>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
