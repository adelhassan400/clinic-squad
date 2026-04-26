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

function CaduceusWatermark() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden className="w-full h-full">
      <g fill="currentColor" stroke="currentColor">
        <path d="M50 18 Q22 12 8 28 Q14 30 24 28 Q38 26 50 24 Z" stroke="none" />
        <path d="M50 18 Q78 12 92 28 Q86 30 76 28 Q62 26 50 24 Z" stroke="none" />
        <circle cx="50" cy="16" r="5" stroke="none" />
        <line x1="50" y1="22" x2="50" y2="132" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M50 36 C36 44 36 56 50 60 C64 64 64 76 50 80 C36 84 36 96 50 100 C64 104 64 116 50 120"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M50 36 C64 44 64 56 50 60 C36 64 36 76 50 80 C64 84 64 96 50 100 C36 104 36 116 50 120"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="38" cy="42" r="2" stroke="none" />
        <circle cx="62" cy="42" r="2" stroke="none" />
        <path d="M50 130 L46 138 L54 138 Z" stroke="none" />
      </g>
    </svg>
  );
}

function LivePreview({ clinicName, doctorName, doctorSpecialty, patient, date, diagnosis, notes, items }: LivePreviewProps) {
  const filledItems = items.filter((i) => i.drug.trim());
  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="lg:sticky lg:top-4 self-start space-y-2">
      {/* Header strip outside the paper */}
      <div className="flex items-center gap-2 text-xs">
        <Eye className="w-3.5 h-3.5 text-teal-500" />
        <span className="font-semibold uppercase tracking-wider text-teal-500">Live preview</span>
        <span className="ms-auto text-muted-foreground hidden sm:inline">A4 · what your patient receives</span>
      </div>

      {/* Outer surround mimicking the colored backdrop */}
      <div className="rounded-xl bg-gradient-to-br from-teal-300 to-teal-500 p-3 shadow-2xl">
        {/* Paper sheet — always white so it reads as a real Rx, even in dark mode */}
        <div className="relative rounded-md bg-white text-zinc-900 overflow-hidden shadow-lg">
          {/* ===== Header banner ===== */}
          <div className="relative h-[92px] overflow-hidden">
            {/* Decorative angled stripes */}
            <div
              className="absolute inset-y-0 left-[60%] w-[60px] bg-gradient-to-br from-teal-400/55 to-teal-600/35"
              style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 50px) 100%, 0 100%)" }}
            />
            <div
              className="absolute inset-y-0 left-[68%] w-[40px] bg-gradient-to-br from-teal-400/30 to-teal-600/15"
              style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 40px) 100%, 0 100%)" }}
            />
            {/* Main banner */}
            <div
              className="absolute inset-y-0 left-0 w-[70%] bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center px-7"
              style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 60px) 100%, 0 100%)" }}
            >
              <div className="min-w-0">
                <p className="text-xl leading-tight tracking-tight truncate">
                  <span className="font-extrabold">Dr.</span>{" "}
                  <span className="font-extrabold">{doctorName || "Doctor Name"}</span>
                </p>
                <p className="text-[9px] uppercase tracking-[0.32em] text-white/90 mt-1 font-medium truncate">
                  {doctorSpecialty || "Medical Practitioner"}
                </p>
              </div>
            </div>
            {/* Stamp */}
            <div className="absolute top-2 right-[110px] text-[8px] font-mono text-zinc-400 tracking-[0.2em] uppercase">
              Rx · Draft
            </div>
            {/* Stethoscope disk */}
            <div className="absolute right-7 top-1/2 -translate-y-1/2 w-[58px] h-[58px] rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center border-[3px] border-white shadow-lg shadow-teal-500/30">
              <Stethoscope className="w-7 h-7" strokeWidth={2} />
            </div>
          </div>

          {/* ===== Patient info form ===== */}
          <div className="px-7 pt-5 pb-3 grid grid-cols-2 gap-x-7 gap-y-3 text-[12px]">
            <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 min-h-[22px]">
              <span className="text-slate-600 font-medium shrink-0">Patient Name:</span>
              <span className="text-slate-900 font-semibold flex-1 truncate">
                {patient?.name || <span className="text-slate-400 font-normal italic">—</span>}
                {patient?.code && (
                  <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 border border-teal-500/30 font-semibold">
                    {patient.code}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 min-h-[22px]">
              <span className="text-slate-600 font-medium shrink-0">Date:</span>
              <span className="text-slate-900 font-semibold flex-1">{formattedDate}</span>
            </div>
            <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 min-h-[22px]">
              <span className="text-slate-600 font-medium shrink-0">Phone:</span>
              <span className="text-slate-900 font-semibold flex-1 truncate">
                {patient?.phone || <span className="text-slate-400 font-normal italic">—</span>}
              </span>
            </div>
            <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 min-h-[22px]">
              <span className="text-slate-600 font-medium shrink-0">Clinic:</span>
              <span className="text-slate-900 font-semibold flex-1 truncate">
                {clinicName || <span className="text-slate-400 font-normal italic">—</span>}
              </span>
            </div>
            <div className="col-span-2 flex items-baseline gap-2 border-b border-slate-300 pb-1 min-h-[22px]">
              <span className="text-slate-600 font-medium shrink-0">Diagnosis:</span>
              <span className="text-slate-900 font-semibold flex-1 truncate">
                {diagnosis || <span className="text-slate-400 font-normal italic">—</span>}
              </span>
            </div>
          </div>

          {/* ===== Body / meds ===== */}
          <div className="relative px-7 pt-3 pb-5 min-h-[280px]">
            {/* Watermark caduceus */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[260px] h-[340px] text-teal-500 opacity-[0.05] pointer-events-none z-0">
              <CaduceusWatermark />
            </div>

            {/* Big Rx mark */}
            <div className="relative z-10 mb-3 leading-[0.8]">
              <span className="font-serif text-[52px] font-bold text-slate-900">R</span>
              <span className="font-serif italic text-[52px] font-bold text-teal-600 -ml-2">x</span>
            </div>

            {filledItems.length === 0 ? (
              <div className="relative z-10 rounded-md border border-dashed border-zinc-300 py-5 text-center text-xs text-zinc-400 italic">
                Start typing a drug name to preview…
              </div>
            ) : (
              <ol className="relative z-10 space-y-2">
                {filledItems.map((it, i) => {
                  const dose = it.dosage.trim();
                  const freq = it.frequency.trim();
                  const dur = it.duration.trim();
                  const itemNotes = it.notes.trim();
                  return (
                    <li key={i} className="flex gap-3 py-2 border-b border-dashed border-slate-200 last:border-b-0">
                      <span
                        className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white text-[11px] font-bold flex items-center justify-center shadow-sm shadow-teal-500/30"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 leading-tight">{it.drug}</p>
                        {(dose || freq || dur) && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {dose && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/30 font-medium">
                                <Pill className="w-2.5 h-2.5" /> {dose}
                              </span>
                            )}
                            {freq && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/30 font-medium">
                                <Clock className="w-2.5 h-2.5" /> {freq}
                              </span>
                            )}
                            {dur && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/30 font-medium">
                                <CalendarDays className="w-2.5 h-2.5" /> {dur}
                              </span>
                            )}
                          </div>
                        )}
                        {itemNotes && (
                          <p className="text-[11px] text-slate-600 italic mt-1.5">↳ {itemNotes}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {notes && (
              <div className="relative z-10 mt-4 border-l-[3px] border-teal-500 bg-teal-500/5 rounded p-3">
                <p className="text-[9px] uppercase tracking-[0.18em] text-teal-700 font-bold">
                  Notes for the patient
                </p>
                <p className="text-xs text-slate-800 mt-1 whitespace-pre-wrap">{notes}</p>
              </div>
            )}
          </div>

          {/* ===== Signature ===== */}
          <div className="px-7 pb-3 flex justify-end">
            <div className="text-center min-w-[200px]">
              <p
                className="text-[18px] text-slate-900 pb-1 italic"
                style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", "Segoe Script", cursive' }}
              >
                Dr. {doctorName || "—"}
              </p>
              <div className="border-t border-slate-900 mx-auto w-44" />
              <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-[0.15em]">Signature</p>
            </div>
          </div>

          {/* ===== Footer ===== */}
          <footer className="px-7 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap text-[11px]">
            <div className="font-bold uppercase tracking-[0.15em] text-slate-900 text-[11px] truncate max-w-[180px]">
              {clinicName || "Clinic"}
            </div>
            <div className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="text-teal-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className="truncate max-w-[160px]">{doctorSpecialty || "Medical Practice"}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="text-teal-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
                </svg>
              </span>
              <span className="truncate max-w-[140px]">{patient?.phone || "—"}</span>
            </div>
          </footer>
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
