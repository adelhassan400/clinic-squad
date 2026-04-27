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
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!trimmedPhone) {
      toast({ title: "Phone is required", variant: "destructive" });
      return;
    }

    let ageValue: number | null = null;
    if (age.trim() !== "") {
      const n = Number(age);
      if (!Number.isFinite(n) || n < 0 || n > 149 || !Number.isInteger(n)) {
        toast({ title: "Age must be a whole number between 0 and 149", variant: "destructive" });
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
      toast({ title: "Profile updated" });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Failed to update profile",
        description: err?.data?.error ?? err?.message ?? "Try again",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Patient Profile</DialogTitle>
          <DialogDescription>Update name, age, phone, and chronic conditions.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name *</Label>
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
              <Label htmlFor="edit-age">Age</Label>
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
              <Label htmlFor="edit-phone">Phone *</Label>
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
            <Label htmlFor="edit-chronic">Chronic Conditions</Label>
            <Textarea
              id="edit-chronic"
              data-testid="edit-patient-chronic"
              value={chronicConditions}
              onChange={(e) => setChronicConditions(e.target.value)}
              className="mt-1 min-h-20"
              placeholder="e.g. Diabetes Type 2, Hypertension, Asthma…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={patchPatient.isPending}
              data-testid="button-save-edit-patient"
            >
              {patchPatient.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
