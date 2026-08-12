import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPatients, useCreatePatient, useDeletePatient, usePatchPatient,
  getListPatientsQueryKey, getGetPatientQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Users, Trash2, Eye, Loader2, MessageCircle, LogIn, Clock } from "lucide-react";
import { Link } from "wouter";
import { openWhatsApp, whatsappPatientGreeting } from "@/lib/whatsapp";
import { PATIENT_VISIT_TYPES, getVisitTypeStyle } from "@/lib/visit-types";
import { cn } from "@/lib/utils";

const patientSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(6, "Phone required"),
  age: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z
      .number()
      .int("Age must be a whole number")
      .min(0, "Age is required and must be 0 or greater")
      .max(149, "Age looks too high"),
  ),
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});
type PatientForm = z.infer<typeof patientSchema>;

const checkInSchema = z.object({
  visitType: z.enum(PATIENT_VISIT_TYPES, { message: "Visit type is required" }),
});
type CheckInForm = z.infer<typeof checkInSchema>;

function displayAge(age: number | null | undefined): string {
  if (age === null || age === undefined) return "—";
  return `${age}`;
}

function StatusPill({ status }: { status: string }) {
  const { t } = useLang();
  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        {t("status.inProgress")}
      </span>
    );
  }
  if (status === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Clock className="w-3 h-3" /> {t("status.waiting")}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        {t("status.completed")}
      </span>
    );
  }
  // registered (default for newly created records)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground">
      {t("status.registered")}
    </span>
  );
}

export default function PatientsPage() {
  const { clinic } = useAuth();
  const { t, lang } = useLang();
  const clinicId = clinic?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [checkInPatient, setCheckInPatient] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useListPatients(clinicId, { search: search || undefined }, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId, { search: search || undefined }) }
  });

  const createMutation = useCreatePatient();
  const deleteMutation = useDeletePatient();
  const patchMutation = usePatchPatient();

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { name: "", phone: "" },
  });

  const checkInForm = useForm<CheckInForm>({
    resolver: zodResolver(checkInSchema),
    defaultValues: { visitType: "New Consultation" },
  });

  const onSubmit = (values: PatientForm) => {
    createMutation.mutate({ clinicId, data: values }, {
      onSuccess: () => {
        toast({ title: t("patients.toast.added") });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
        setAddOpen(false);
        form.reset({ name: "", phone: "" });
      },
      onError: () => toast({ title: t("patients.toast.addFailed"), variant: "destructive" }),
    });
  };

  const openCheckIn = (id: string, name: string) => {
    checkInForm.reset({ visitType: "New Consultation" });
    setCheckInPatient({ id, name });
  };

  const onCheckIn = (values: CheckInForm) => {
    if (!checkInPatient) return;
    patchMutation.mutate(
      { clinicId, patientId: checkInPatient.id, data: { status: "waiting", visitType: values.visitType } },
      {
        onSuccess: () => {
          toast({ title: `${checkInPatient.name} ${t("patients.toast.sentToQueue")}` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getGetPatientQueryKey(clinicId, checkInPatient.id) });
          setCheckInPatient(null);
        },
        onError: () => toast({ title: t("patients.toast.checkInFailed"), variant: "destructive" }),
      },
    );
  };

  const handleDelete = (patientId: string, name: string) => {
    if (!confirm(`${t("patients.confirmDelete")} "${name}"?`)) return;
    deleteMutation.mutate({ clinicId, patientId }, {
      onSuccess: () => {
        toast({ title: t("patients.toast.deleted") });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
      },
      onError: () => toast({ title: t("patients.toast.deleteFailed"), variant: "destructive" }),
    });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t("patients.title")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} {t("patients.onFile")}</p>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-patient">
              <Plus className="w-4 h-4 mr-2" />
              {t("patients.add")}
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("patients.searchPh")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          {/* Table — Name, Age, Phone, Status, Actions (Check-in / WhatsApp / View / Delete) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_70px_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("patients.id")}</span>
              <span>{t("patients.name")}</span>
              <span>{t("patients.age")}</span>
              <span>{t("patients.phone")}</span>
              <span>{t("patients.status")}</span>
              <span>{t("patients.dateAdded")}</span>
              <span>{t("patients.actions")}</span>
            </div>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : !data?.data.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">{search ? t("patients.notFound") : t("patients.empty")}</p>
                <p className="text-xs mt-1">{search ? t("patients.tryDifferent") : t("patients.addFirst")}</p>
                {!search && (
                  <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" />{t("patients.add")}
                  </Button>
                )}
              </div>
            ) : (
              data.data.map(patient => {
                const onActiveQueue = patient.status === "waiting" || patient.status === "in-progress";
                return (
                  <div
                    key={patient.id}
                    data-testid={`patient-row-${patient.id}`}
                    className="grid grid-cols-[110px_1fr_70px_1fr_auto_auto_auto] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <span
                      className="text-sm font-mono font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-center"
                      data-testid={`patient-code-${patient.id}`}
                    >
                      {patient.code ?? "—"}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{patient.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{patient.name}</p>
                        {patient.bloodType && <p className="text-xs text-muted-foreground">{t("patients.blood")}: {patient.bloodType}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground" data-testid={`patient-age-${patient.id}`}>
                      {displayAge(patient.age)}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono">{patient.phone}</span>
                    <span data-testid={`patient-status-${patient.id}`}>
                      <StatusPill status={patient.status} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(patient.createdAt, lang === "ar" ? "ar-EG" : "en-US")}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant={onActiveQueue ? "ghost" : "default"}
                        size="sm"
                        className={cn(
                          "h-8",
                          onActiveQueue && "text-muted-foreground",
                        )}
                        onClick={() => openCheckIn(patient.id, patient.name)}
                        disabled={onActiveQueue}
                        title={onActiveQueue ? t("patients.alreadyOnQueue") : t("patients.sendToQueue")}
                        data-testid={`checkin-patient-${patient.id}`}
                      >
                        <LogIn className="w-3.5 h-3.5 mr-1" />
                        {onActiveQueue ? t("patients.onQueue") : t("patients.checkIn")}
                      </Button>
                      <Link href={`/patients/${patient.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`view-patient-${patient.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                        onClick={() =>
                          openWhatsApp(
                            patient.phone,
                            whatsappPatientGreeting({
                              patientName: patient.name,
                              clinicName: clinic?.name ?? "the clinic",
                            })
                          )
                        }
                        title="Send WhatsApp message"
                        data-testid={`whatsapp-patient-${patient.id}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(patient.id, patient.name)}
                        data-testid={`delete-patient-${patient.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Add Patient Dialog — master record only */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("patients.addDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("patients.addDialog.desc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>{t("patients.fullName")} *</Label>
                  <Input {...form.register("name")} placeholder={t("patients.fullNamePh")} className="mt-1" />
                  {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <Label>{t("patients.phone")} *</Label>
                  <Input {...form.register("phone")} placeholder="01012345678" className="mt-1" />
                  {form.formState.errors.phone && <p className="text-xs text-destructive mt-1">{form.formState.errors.phone.message}</p>}
                </div>
                <div>
                  <Label>{t("patients.age")} *</Label>
                  <Input
                    {...form.register("age")}
                    type="number"
                    min={0}
                    max={149}
                    step={1}
                    inputMode="numeric"
                    className="mt-1"
                  />
                  {form.formState.errors.age && <p className="text-xs text-destructive mt-1">{form.formState.errors.age.message}</p>}
                </div>
                <div>
                  <Label>{t("patients.bloodType")}</Label>
                  <Input {...form.register("bloodType")} placeholder="e.g. O+" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>{t("patients.allergies")}</Label>
                  <Input {...form.register("allergies")} placeholder="e.g. Penicillin" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>{t("patients.clinicalNotes")}</Label>
                  <Input {...form.register("notes")} placeholder="Chronic conditions, history..." className="mt-1" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("presc.cancel")}</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-patient">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("patients.save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Check-in Dialog */}
        <Dialog open={!!checkInPatient} onOpenChange={(open) => !open && setCheckInPatient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("patients.checkInDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("patients.checkInDialog.desc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={checkInForm.handleSubmit(onCheckIn)} className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">{t("patients.name")}</Label>
                <div className="px-3 py-2 rounded-md bg-muted/50 border border-border text-sm font-semibold">
                  {checkInPatient?.name}
                </div>
              </div>
              <div>
                <Label>{t("patients.visitType")} *</Label>
                <Controller
                  control={checkInForm.control}
                  name="visitType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1" data-testid="select-visit-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PATIENT_VISIT_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {checkInForm.formState.errors.visitType && (
                  <p className="text-xs text-destructive mt-1">{checkInForm.formState.errors.visitType.message}</p>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setCheckInPatient(null)}>{t("presc.cancel")}</Button>
                <Button type="submit" disabled={patchMutation.isPending} data-testid="button-confirm-checkin">
                  {patchMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("patients.sendToDoctor")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
