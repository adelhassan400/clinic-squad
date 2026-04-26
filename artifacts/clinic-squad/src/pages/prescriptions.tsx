import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListPrescriptions,
  useListPatients,
  useCreatePrescription,
  useDeletePrescription,
  getListPrescriptionsQueryKey,
  getListPatientsQueryKey,
  type Prescription,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Pill,
  Plus,
  Trash2,
  Printer,
  MessageCircle,
  Search,
  Eye,
  X,
  FileText,
  Stethoscope,
  User as UserIcon,
  Clock,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { printPrescription, sendPrescriptionWhatsApp } from "@/lib/prescription";

interface ItemForm {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
}

const blankItem = (): ItemForm => ({ drug: "", dosage: "", frequency: "", duration: "", notes: "" });

const FREQUENCY_PRESETS = ["Once daily", "Twice daily", "3× daily", "Every 8h", "Before meals", "After meals"];
const DURATION_PRESETS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];

interface PrescriptionsContentProps {
  initialPatientId?: string;
  embedded?: boolean;
}

export function PrescriptionsContent({ initialPatientId, embedded }: PrescriptionsContentProps) {
  const { clinic, user } = useAuth();
  const clinicId = clinic?.id ?? "";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(!!initialPatientId);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Prescription | null>(null);

  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemForm[]>([blankItem()]);

  const listParams = initialPatientId ? { patientId: initialPatientId } : undefined;
  const { data, isLoading, error } = useListPrescriptions(clinicId, listParams, {
    query: {
      enabled: !!clinicId,
      queryKey: getListPrescriptionsQueryKey(clinicId, listParams),
    },
  });

  const { data: patientsResp } = useListPatients(clinicId, { limit: 1000 }, {
    query: {
      enabled: !!clinicId && isAdmin,
      queryKey: getListPatientsQueryKey(clinicId, { limit: 1000 }),
    },
  });

  const createMutation = useCreatePrescription();
  const deleteMutation = useDeletePrescription();

  const filtered = useMemo(() => {
    const list = data?.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        (p.diagnosis ?? "").toLowerCase().includes(q) ||
        p.items.some((i) => i.drug.toLowerCase().includes(q)),
    );
  }, [data, search]);

  function resetForm() {
    setPatientId(initialPatientId ?? "");
    setDate(new Date().toISOString().split("T")[0]);
    setDiagnosis("");
    setNotes("");
    setItems([blankItem()]);
  }

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast({ title: "Select a patient", variant: "destructive" });
      return;
    }
    const cleaned = items
      .map((i) => ({
        drug: i.drug.trim(),
        dosage: i.dosage.trim(),
        frequency: i.frequency.trim(),
        duration: i.duration.trim(),
        notes: i.notes.trim() || null,
      }))
      .filter((i) => i.drug);
    if (cleaned.length === 0) {
      toast({ title: "Add at least one medication", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        clinicId,
        data: {
          patientId,
          date,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
          items: cleaned,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey(clinicId) });
      toast({ title: "Prescription created" });
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      toast({
        title: "Failed to create prescription",
        description: err?.data?.error ?? err?.message ?? "Try again",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this prescription?")) return;
    try {
      await deleteMutation.mutateAsync({ clinicId, prescriptionId: id });
      await queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey(clinicId) });
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
    }
  }

  const patientList = patientsResp?.data ?? [];

  return (
    <div className={embedded ? "" : "p-6 max-w-5xl mx-auto"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          {!embedded && (
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Pill className="w-6 h-6 text-primary" />
              ePrescription
            </h1>
          )}
          {embedded && (
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              ePrescription ({filtered.length})
            </h2>
          )}
          {!embedded && (
            <p className="text-sm text-muted-foreground mt-1">
              Write, print, and send prescriptions to your patients.
            </p>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((s) => !s)} data-testid="button-new-prescription">
            {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showForm ? "Cancel" : "New Prescription"}
          </Button>
        )}
      </div>

      {/* Create form + live preview */}
      {showForm && isAdmin && (
        <div className="grid lg:grid-cols-[1fr_minmax(0,420px)] gap-5 mb-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="patient">Patient *</Label>
              {initialPatientId ? (
                <Input
                  value={patientList.find((p) => p.id === initialPatientId)?.name ?? "Loading..."}
                  disabled
                />
              ) : (
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger id="patient" data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input
              id="diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute pharyngitis"
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                Medications <span className="text-destructive">*</span>
                <span className="text-xs font-normal text-muted-foreground">({items.filter(i => i.drug.trim()).length})</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, blankItem()])}
                data-testid="button-add-medication"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add medication
              </Button>
            </div>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-background/40 overflow-hidden transition-colors hover:border-primary/30 focus-within:border-primary/50"
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-muted-foreground">Medication</span>
                    {item.drug.trim() && (
                      <span className="text-foreground font-normal truncate max-w-[200px]">· {item.drug.trim()}</span>
                    )}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeItem(idx)}
                      title="Remove medication"
                      data-testid={`remove-item-${idx}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="p-3 space-y-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1.5">
                      <Pill className="w-3 h-3 text-muted-foreground" /> Drug name *
                    </Label>
                    <Input
                      value={item.drug}
                      onChange={(e) => updateItem(idx, { drug: e.target.value })}
                      placeholder="e.g. Amoxicillin 500mg"
                      className="mt-1 font-medium"
                      data-testid={`item-drug-${idx}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1.5">
                        <ClipboardList className="w-3 h-3 text-muted-foreground" /> Dosage
                      </Label>
                      <Input
                        value={item.dosage}
                        onChange={(e) => updateItem(idx, { dosage: e.target.value })}
                        placeholder="1 capsule"
                        className="mt-1"
                        data-testid={`item-dosage-${idx}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground" /> Frequency
                      </Label>
                      <Input
                        value={item.frequency}
                        onChange={(e) => updateItem(idx, { frequency: e.target.value })}
                        placeholder="3× daily"
                        className="mt-1"
                        data-testid={`item-frequency-${idx}`}
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {FREQUENCY_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateItem(idx, { frequency: preset })}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" /> Duration
                      </Label>
                      <Input
                        value={item.duration}
                        onChange={(e) => updateItem(idx, { duration: e.target.value })}
                        placeholder="7 days"
                        className="mt-1"
                        data-testid={`item-duration-${idx}`}
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {DURATION_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateItem(idx, { duration: preset })}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                      value={item.notes}
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                      placeholder="e.g. Take after meals with water"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="notes">Additional notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Advice for the patient"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-prescription">
              {createMutation.isPending ? "Saving..." : "Save prescription"}
            </Button>
          </div>
        </form>

        {/* Live preview panel */}
        <LivePreview
          clinicName={clinic?.name ?? ""}
          doctorName={user?.name ?? ""}
          doctorSpecialty={user?.specialty ?? null}
          patient={patientList.find((p) => p.id === patientId) ?? null}
          date={date}
          diagnosis={diagnosis}
          notes={notes}
          items={items}
        />
        </div>
      )}

      {/* Search */}
      {!embedded && (
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, diagnosis, or drug name"
            className="ps-9"
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Failed to load prescriptions.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No prescriptions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              data-testid={`prescription-${p.id}`}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{p.patientName}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
                </div>
                {p.diagnosis && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">Dx: {p.diagnosis}</p>
                )}
                <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                  {p.items.map((i) => i.drug).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewing(p)}
                  title="View"
                  data-testid={`view-prescription-${p.id}`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary"
                  onClick={() => printPrescription(p, clinic?.name ?? "")}
                  title="Print / PDF"
                  data-testid={`print-prescription-${p.id}`}
                >
                  <Printer className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600"
                  onClick={() => sendPrescriptionWhatsApp(p, clinic?.name ?? "")}
                  title="Send via WhatsApp"
                  data-testid={`whatsapp-prescription-${p.id}`}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(p.id)}
                    title="Delete"
                    data-testid={`delete-prescription-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prescription</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="font-medium">{viewing.patientName}</p>
                  <p className="text-xs text-muted-foreground">{viewing.patientPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(viewing.date)}</p>
                  <p className="text-xs text-muted-foreground">By {viewing.doctorName}</p>
                </div>
              </div>
              {viewing.diagnosis && (
                <div>
                  <p className="text-xs text-muted-foreground">Diagnosis</p>
                  <p>{viewing.diagnosis}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Medications</p>
                <ol className="space-y-2">
                  {viewing.items.map((it, i) => (
                    <li key={i} className="rounded-md border border-border p-3">
                      <p className="font-medium">
                        {i + 1}. {it.drug}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ")}
                      </p>
                      {it.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{it.notes}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              {viewing.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p>{viewing.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendPrescriptionWhatsApp(viewing, clinic?.name ?? "")}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button size="sm" onClick={() => printPrescription(viewing, clinic?.name ?? "")}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print / PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface LivePreviewProps {
  clinicName: string;
  doctorName: string;
  doctorSpecialty: string | null;
  patient: { name: string; phone: string; code?: string | null } | null;
  date: string;
  diagnosis: string;
  notes: string;
  items: ItemForm[];
}

function LivePreview({ clinicName, doctorName, doctorSpecialty, patient, date, diagnosis, notes, items }: LivePreviewProps) {
  const filledItems = items.filter((i) => i.drug.trim());
  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div className="lg:sticky lg:top-4 self-start space-y-2">
      {/* Header strip outside the paper */}
      <div className="flex items-center gap-2 text-xs">
        <Eye className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold uppercase tracking-wider text-primary">Live preview</span>
        <span className="ms-auto text-muted-foreground hidden sm:inline">A4 · what your patient receives</span>
      </div>

      {/* Paper sheet — always white-ish so it reads as a real Rx, even in dark mode */}
      <div className="relative rounded-lg shadow-xl ring-1 ring-zinc-200 bg-white text-zinc-900 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

        {/* Draft watermark stamp (top-right) */}
        <div className="absolute top-3 right-3 text-[9px] font-mono text-zinc-400 tracking-[0.2em] uppercase">
          Rx · Draft
        </div>

        <div className="px-6 pt-5 pb-6 space-y-5">
          {/* Header: ℞ mark + clinic */}
          <div className="flex items-center gap-3 border-b border-zinc-200 pb-4">
            <div
              aria-hidden
              className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-3xl font-serif font-bold leading-none select-none"
            >
              ℞
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-zinc-900 leading-tight tracking-tight truncate">
                {clinicName || "Clinic name"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
                Medical Prescription
              </p>
            </div>
          </div>

          {/* Doctor + Patient blocks */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Stethoscope className="w-2.5 h-2.5" /> Prescribed by
              </p>
              <p className="font-bold text-sm text-zinc-900">Dr. {doctorName || "—"}</p>
              <p className="text-[11px] text-zinc-500 italic">
                {doctorSpecialty || (
                  <span className="text-amber-700 not-italic">Set specialty in Settings</span>
                )}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <UserIcon className="w-2.5 h-2.5" /> Patient
              </p>
              <p className="font-bold text-sm text-zinc-900">
                {patient?.name || <span className="text-zinc-400 font-normal">No patient selected</span>}
              </p>
              {patient && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {patient.code && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {patient.code}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-500">{patient.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Date + diagnosis row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs border-y border-zinc-200 py-2.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-zinc-400" />
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">Date</span>
              <span className="font-medium text-zinc-900">{formattedDate}</span>
            </div>
            {diagnosis && (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <ClipboardList className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 shrink-0">Dx</span>
                <span className="font-medium text-zinc-900 truncate">{diagnosis}</span>
              </div>
            )}
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary font-serif text-base leading-none">℞</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                Medications
              </span>
              <span className="flex-1 h-px bg-zinc-200" />
              <span className="text-[10px] text-zinc-400 font-mono">{filledItems.length}</span>
            </div>

            {filledItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 py-5 text-center text-xs text-zinc-400 italic">
                Start typing a drug name to preview…
              </div>
            ) : (
              <ol className="space-y-2.5">
                {filledItems.map((it, i) => {
                  const dose = it.dosage.trim();
                  const freq = it.frequency.trim();
                  const dur = it.duration.trim();
                  const itemNotes = it.notes.trim();
                  return (
                    <li key={i} className="flex gap-3">
                      <span
                        className="shrink-0 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-zinc-900 leading-tight">{it.drug}</p>
                        {(dose || freq || dur) && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {dose && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                <Pill className="w-2.5 h-2.5" /> {dose}
                              </span>
                            )}
                            {freq && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                <Clock className="w-2.5 h-2.5" /> {freq}
                              </span>
                            )}
                            {dur && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                <CalendarDays className="w-2.5 h-2.5" /> {dur}
                              </span>
                            )}
                          </div>
                        )}
                        {itemNotes && (
                          <p className="text-[11px] text-zinc-600 italic mt-1.5">↳ {itemNotes}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {notes && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-[9px] uppercase tracking-wider text-amber-800 font-semibold">
                Notes for the patient
              </p>
              <p className="text-xs text-amber-900 mt-1 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Signature */}
          <div className="pt-4 flex justify-end">
            <div className="text-end">
              <p className="font-serif italic text-zinc-700 text-sm pb-1.5 px-3">
                Dr. {doctorName || ""}
              </p>
              <div className="border-t border-zinc-700 w-40 ms-auto" />
              <p className="text-[10px] text-zinc-500 mt-1">
                {doctorSpecialty || "Signature"}
              </p>
            </div>
          </div>

          {/* Footer ribbon */}
          <div className="text-center pt-1">
            <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-300">
              Issued via ClinicSquad
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const initialPatientId = params.get("patientId") ?? undefined;
  const _new = params.get("new");

  // If `new=1` was set, ensure form opens with patient pre-filled (we just rely on initialPatientId)
  void _new;
  void setLocation;

  return (
    <ProtectedRoute requireRole={["admin", "secretary", "nurse", "superadmin"]}>
      <DashboardLayout>
        <PrescriptionsContent initialPatientId={initialPatientId} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
