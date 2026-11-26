import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/lang";
import { useToast } from "@/hooks/use-toast";
import { useSaveVitals, type Vitals } from "@/lib/visit-records";
import { Loader2, HeartPulse } from "lucide-react";

type Field = { key: keyof Vitals; labelKey: string; unit: string; step?: string };
const FIELDS: Field[] = [
  { key: "bpSystolic", labelKey: "vitals.bpSys", unit: "mmHg" },
  { key: "bpDiastolic", labelKey: "vitals.bpDia", unit: "mmHg" },
  { key: "pulse", labelKey: "vitals.pulse", unit: "/min" },
  { key: "temperature", labelKey: "vitals.temp", unit: "°C", step: "0.1" },
  { key: "weight", labelKey: "vitals.weight", unit: "kg", step: "0.1" },
  { key: "bloodSugar", labelKey: "vitals.sugar", unit: "mg/dL" },
  { key: "spo2", labelKey: "vitals.spo2", unit: "%" },
];

export function VitalsDialog({
  open,
  onOpenChange,
  clinicId,
  patientId,
  patientName,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinicId: string;
  patientId: string;
  patientName: string;
  initial?: Vitals | null;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const save = useSaveVitals(clinicId);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.key] = initial?.[f.key] != null ? String(initial[f.key]) : "";
    setValues(next);
  }, [open, initial]);

  const submit = async (ready: boolean) => {
    const vitals: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = (values[f.key] ?? "").trim();
      vitals[f.key] = raw === "" ? null : Number(raw);
    }
    try {
      await save.mutateAsync({ patientId, vitals, ready });
      toast({ title: ready ? t("vitals.savedReady") : t("vitals.saved") });
      onOpenChange(false);
    } catch {
      toast({ title: t("vitals.failed"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            {t("vitals.title")}
          </DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs">
                {t(f.labelKey)} <span className="text-muted-foreground">({f.unit})</span>
              </Label>
              <input
                type="number"
                inputMode="decimal"
                step={f.step ?? "1"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                data-testid={`vitals-${f.key}`}
                className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-base md:text-sm"
              />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => submit(false)} disabled={save.isPending} data-testid="vitals-save">
            {t("vitals.save")}
          </Button>
          <Button onClick={() => submit(true)} disabled={save.isPending} data-testid="vitals-save-ready">
            {save.isPending && <Loader2 className="w-4 h-4 me-1.5 animate-spin" />}
            {t("vitals.saveReady")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
