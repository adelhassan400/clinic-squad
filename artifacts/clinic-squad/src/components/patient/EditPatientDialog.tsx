import { useEffect, useState } from "react";
import {
  usePatchPatient,
  getGetPatientQueryKey,
  getListPatientsQueryKey,
  type Patient,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/lib/lang";
import { apiErrorText } from "@/lib/error-i18n";
import { Loader2 } from "lucide-react";

interface Props {
  patient: Patient;
  clinicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPatientDialog({ patient, clinicId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useLang();
  const patchPatient = usePatchPatient();

  const [name, setName] = useState(patient.name);
  const [age, setAge] = useState<string>(patient.age != null ? String(patient.age) : "");
  const [phone, setPhone] = useState(patient.phone);
  const [chronicConditions, setChronicConditions] = useState(patient.chronicConditions ?? "");

  // Re-hydrate when patient changes or dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setName(patient.name);
    setAge(patient.age != null ? String(patient.age) : "");
    setPhone(patient.phone);
    setChronicConditions(patient.chronicConditions ?? "");
  }, [open, patient]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      toast({ title: t("editp.nameRequired"), variant: "destructive" });
      return;
    }
    if (!trimmedPhone) {
      toast({ title: t("editp.phoneRequired"), variant: "destructive" });
      return;
    }

    let ageValue: number | null = null;
    if (age.trim() !== "") {
      const n = Number(age);
      if (!Number.isFinite(n) || n < 0 || n > 149 || !Number.isInteger(n)) {
        toast({ title: t("editp.ageInvalid"), variant: "destructive" });
        return;
      }
      ageValue = n;
    }

    try {
      await patchPatient.mutateAsync({
        clinicId,
        patientId: patient.id,
        data: {
          name: trimmedName,
          phone: trimmedPhone,
          age: ageValue,
          chronicConditions: chronicConditions.trim() === "" ? null : chronicConditions.trim(),
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetPatientQueryKey(clinicId, patient.id) }),
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) }),
      ]);
      toast({ title: t("editp.updated") });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: t("editp.fail"),
        description: apiErrorText(err, t("editp.tryAgain")),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editp.title")}</DialogTitle>
          <DialogDescription>{t("editp.desc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">{t("editp.name")} *</Label>
            <Input
              id="edit-name"
              data-testid="edit-patient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-age">{t("editp.age")}</Label>
              <Input
                id="edit-age"
                data-testid="edit-patient-age"
                type="number"
                min={0}
                max={149}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1"
                placeholder="—"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">{t("editp.phone")} *</Label>
              <Input
                id="edit-phone"
                data-testid="edit-patient-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-chronic">{t("editp.chronic")}</Label>
            <Textarea
              id="edit-chronic"
              data-testid="edit-patient-chronic"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              className="mt-1 min-h-20"
              placeholder={t("editp.chronicPh")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={patchPatient.isPending}
              data-testid="button-save-edit-patient"
            >
              {patchPatient.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t("editp.saving")}
                </>
              ) : (
                t("editp.saveChanges")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
        }
