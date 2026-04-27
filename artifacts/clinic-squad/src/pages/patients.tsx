import { useState } from "react";
import { useAuth } from "@/lib/auth";
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
  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        In progress
      </span>
    );
  }
  if (status === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Clock className="w-3 h-3" /> Waiting
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        Completed
      </span>
    );
  }
  // registered (default for newly created records)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground">
      Registered
    </span>
  );
}

export default function PatientsPage() {
  const { clinic } = useAuth();
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
        toast({ title: "Patient added to records" });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
        setAddOpen(false);
        form.reset({ name: "", phone: "" });
      },
      onError: () => toast({ title: "Failed to add patient", variant: "destructive" }),
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
          toast({ title: `${checkInPatient.name} sent to the Doctor's Waiting List` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getGetPatientQueryKey(clinicId, checkInPatient.id) });
          setCheckInPatient(null);
        },
        onError: () => toast({ title: "Failed to check in patient", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (patientId: string, name: string) => {
    if (!confirm(`Delete patient "${name}"?`)) return;
    deleteMutation.mutate({ clinicId, patientId }, {
      onSuccess: () => {
        toast({ title: "Patient deleted" });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
      },
      onError: () => toast({ title: "Failed to delete patient", variant: "destructive" }),
    });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Patients</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{data?.total ?? 0} patients on file</p>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-patient">
              <Plus className="w-4 h-4 mr-2" />
              Add Patient
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by code (PT-0001), name, or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          {/* Table — Name, Age, Phone, Status, Actions (Check-in / WhatsApp / View / Delete) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_70px_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>ID</span>
              <span>Name</span>
              <span>Age</span>
              <span>Phone</span>
              <span>Status</span>
              <span>Date Added</span>
              <span>Actions</span>
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
                <p className="font-medium text-sm">{search ? "No patients found" : "No patients yet"}</p>
                <p className="text-xs mt-1">{search ? "Try a different search" : "Add your first patient to get started"}</p>
                {!search && (
                  <Button size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" />Add Patient
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
                        {patient.bloodType && <p className="text-xs text-muted-foreground">Blood: {patient.bloodType}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground" data-testid={`patient-age-${patient.id}`}>
                      {displayAge(patient.age)}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono">{patient.phone}</span>
                    <span data-testid={`patient-status-${patient.id}`}>
                      <StatusPill status={patient.status} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(patient.createdAt)}</span>
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
                        title={onActiveQueue ? "Already on the waiting list" : "Send to the Doctor's Waiting List"}
                        data-testid={`checkin-patient-${patient.id}`}
                      >
                        <LogIn className="w-3.5 h-3.5 mr-1" />
                        {onActiveQueue ? "On queue" : "Check-in"}
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
              <DialogTitle>Add Patient</DialogTitle>
              <DialogDescription>
                Save the patient&apos;s master record. They will not be added to today&apos;s waiting list — use the Check-in button on the row when they arrive.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Full Name *</Label>
                  <Input {...form.register("name")} placeholder="Fatima Al-Rashid" className="mt-1" />
                  {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input {...form.register("phone")} placeholder="01012345678" className="mt-1" />
                  {form.formState.errors.phone && <p className="text-xs text-destructive mt-1">{form.formState.errors.phone.message}</p>}
                </div>
                <div>
                  <Label>Age *</Label>
                  <Input
                    {...form.register("age")}
                    type="number"
                    min={0}
                    max={149}
                    step={1}
                    inputMode="numeric"
                    placeholder="e.g. 32"
                    className="mt-1"
                    data-testid="input-age"
                  />
                  {form.formState.errors.age && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.age.message}</p>
                  )}
                </div>
                <div>
                  <Label>Blood Type</Label>
                  <Input {...form.register("bloodType")} placeholder="A+" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Allergies</Label>
                  <Input {...form.register("allergies")} placeholder="Penicillin, Aspirin..." className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input {...form.register("notes")} placeholder="Additional medical notes..." className="mt-1" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-patient">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Patient
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Check-in Dialog — pick visit type, then send to waiting list */}
        <Dialog open={!!checkInPatient} onOpenChange={(open) => !open && setCheckInPatient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Check-in {checkInPatient?.name ?? ""}</DialogTitle>
              <DialogDescription>
                Pick the reason for today&apos;s visit. The patient will be sent to the Doctor&apos;s Waiting List.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={checkInForm.handleSubmit(onCheckIn)} className="space-y-4">
              <div>
                <Label>Visit Type *</Label>
                <Controller
                  control={checkInForm.control}
                  name="visitType"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1" data-testid="select-checkin-visit-type">
                        <SelectValue placeholder="Select visit type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PATIENT_VISIT_TYPES.map((vt) => {
                          const style = getVisitTypeStyle(vt);
                          return (
                            <SelectItem
                              key={vt}
                              value={vt}
                              data-testid={`checkin-visit-type-option-${vt}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", style.dot)} />
                                {vt}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
                {checkInForm.formState.errors.visitType && (
                  <p className="text-xs text-destructive mt-1">
                    {checkInForm.formState.errors.visitType.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setCheckInPatient(null)}>Cancel</Button>
                <Button type="submit" disabled={patchMutation.isPending} data-testid="button-confirm-checkin">
                  {patchMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <LogIn className="w-4 h-4 mr-1" />
                  Send to Waiting List
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
