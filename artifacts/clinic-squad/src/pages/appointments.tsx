import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment,
  useListPatients, usePatchPatient,
  getListAppointmentsQueryKey, getListPatientsQueryKey, getGetPatientQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Calendar, Trash2, CheckCircle, XCircle, Loader2,
  ChevronsUpDown, Check, Users, List, ChevronLeft, ChevronRight, Pill, MessageCircle, LogIn, Clock, User
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";
import { openWhatsApp, whatsappAppointmentReminder } from "@/lib/whatsapp";
import { PATIENT_VISIT_TYPES, VisitTypeBadge, getVisitTypeStyle } from "@/lib/visit-types";

const apptSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  date: z.string().min(1, "Date required"),
  time: z.string().min(1, "Time required"),
  type: z.string().min(1, "Type required"),
  fee: z.coerce.number().optional(),
  notes: z.string().optional(),
});
type ApptForm = z.infer<typeof apptSchema>;

type ViewMode = "list" | "day";

const HOUR_HEIGHT = 72;
const DAY_START = 8;
const DAY_END = 21;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesFromDayStart(time: string): number {
  return timeToMinutes(time) - DAY_START * 60;
}

function formatDayLabel(dateStr: string, lang: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", month: "long", day: "numeric" });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

const STATUS_STYLES: Record<string, { bar: string; bg: string; text: string; badge: string }> = {
  scheduled: {
    bar: "bg-primary",
    bg: "bg-primary/10 border-primary/30",
    text: "text-primary",
    badge: "bg-primary/10 text-primary",
  },
  checked_in: {
    bar: "bg-accent",
    bg: "bg-accent/15 border-accent/40",
    text: "text-accent-foreground",
    badge: "bg-accent/20 text-accent-foreground",
  },
  completed: {
    bar: "bg-green-500",
    bg: "bg-green-500/10 border-green-500/30",
    text: "text-green-600 dark:text-green-400",
    badge: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  cancelled: {
    bar: "bg-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  no_show: {
    bar: "bg-orange-500",
    bg: "bg-orange-500/10 border-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const s = STATUS_STYLES[status];
  const label = t(`status.${status.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`);
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", s?.badge ?? "bg-muted text-muted-foreground")}>
      {label || status.replace("_", " ")}
    </span>
  );
}

interface PatientSearchProps {
  value: string;
  onChange: (id: string) => void;
  patients: Array<{ id: string; name: string; phone: string }>;
}

function PatientSearch({ value, onChange, patients }: PatientSearchProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const selected = patients.find(p => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          data-testid="patient-combobox-trigger"
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors",
            "hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !value && "text-muted-foreground"
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                {selected.name.charAt(0)}
              </span>
              <span className="truncate font-medium text-foreground">{selected.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{selected.phone}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 shrink-0" />
              {t("appt.searchPh")}
            </span>
          )}
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder={t("appt.typePh")} className="h-10" />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <Users className="w-8 h-8 opacity-30" />
                <p>{t("patients.notFound")}</p>
              </div>
            </CommandEmpty>
            <CommandGroup heading={`${patients.length} ${t("patients.title")}`}>
              {patients.map(patient => (
                <CommandItem
                  key={patient.id}
                  value={`${patient.name} ${patient.phone}`}
                  onSelect={() => { onChange(patient.id); setOpen(false); }}
                  className="flex items-center gap-3 py-2.5 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{patient.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.phone}</p>
                  </div>
                  <Check className={cn("w-4 h-4 text-primary shrink-0", value === patient.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Appointment {
  id: string;
  patientName: string;
  date: string;
  time: string;
  type: string;
  status: string;
  fee?: number | null;
}

interface DayCalendarProps {
  appointments: Appointment[];
  date: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onClickSlot: (time: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onCheckIn: (id: string, patientId: string, patientName: string) => void;
  checkingInId: string | null;
  currencyCode: string;
}

function DayCalendar({
  appointments, date, onPrevDay, onNextDay, onToday,
  onClickSlot, onComplete, onCancel, onDelete, onCheckIn, checkingInId, currencyCode
}: DayCalendarProps) {
  const { t, lang } = useLang();
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const visibleAppts = appointments.filter(a => {
    const mins = minutesFromDayStart(a.time);
    return mins >= 0 && mins < (DAY_END - DAY_START) * 60;
  });

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes() - DAY_START * 60;
  const showNowLine = isToday(date) && nowMins >= 0 && nowMins < (DAY_END - DAY_START) * 60;
  const nowTop = (nowMins / 60) * HOUR_HEIGHT;

  function handleSlotClick(hour: number) {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    onClickSlot(timeStr);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevDay}>
            {lang === "ar" ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-semibold">{formatDayLabel(date, lang)}</p>
            {isToday(date) && (
              <p className="text-xs text-primary font-medium">{t("appt.today")}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextDay}>
            {lang === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {visibleAppts.length} {visibleAppts.length === 1 ? t("appt.appointment") : t("appt.appointments")}
          </span>
          {!isToday(date) && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToday}>
              {t("appt.today")}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="flex" style={{ minHeight: totalHeight }}>
          <div className="w-16 shrink-0 relative select-none" style={{ height: totalHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn("absolute w-full flex items-start justify-end pr-3 pt-1", lang === "ar" ? "pr-0 pl-3" : "pr-3")}
                style={{ top: (hour - DAY_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-muted-foreground/60 font-mono leading-none">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 relative border-l border-border" style={{ height: totalHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                onClick={() => handleSlotClick(hour)}
                title={`${t("appt.scheduleAt")} ${String(hour).padStart(2, "0")}:00`}
                className="absolute w-full border-b border-border/50 cursor-pointer hover:bg-primary/[0.03] transition-colors group"
                style={{ top: (hour - DAY_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <div
                  className="absolute w-full border-b border-border/20 border-dashed"
                  style={{ top: HOUR_HEIGHT / 2 }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-xs text-primary/50 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              </div>
            ))}

            {showNowLine && (
              <div
                className="absolute w-full flex items-center pointer-events-none z-20"
                style={{ top: nowTop }}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-sm", lang === "ar" ? "-mr-1.5" : "-ml-1.5")} />
                <div className="flex-1 border-t-2 border-red-500" />
              </div>
            )}

            {visibleAppts.map((appt) => {
              const topMins = minutesFromDayStart(appt.time);
              const top = (topMins / 60) * HOUR_HEIGHT;
              const minHeight = 52;
              const s = STATUS_STYLES[appt.status] ?? STATUS_STYLES.scheduled;
              const vt = getVisitTypeStyle(appt.type);

              return (
                <div
                  key={appt.id}
                  data-testid={`cal-appt-${appt.id}`}
                  className={cn(
                    "absolute left-2 right-2 rounded-lg border px-3 py-2 flex gap-2 overflow-hidden z-10 shadow-sm",
                    s.bg,
                    lang === "ar" && "flex-row-reverse"
                  )}
                  style={{ top: top + 2, minHeight }}
                >
                  <div className={cn("w-1 rounded-full shrink-0 self-stretch", vt.bar)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", s.text)}>{appt.patientName}</p>
                        <div className="mt-0.5">
                          <VisitTypeBadge type={appt.type} className="text-[10px] px-1.5 py-0" />
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {appt.status === "scheduled" && isToday(date) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onCheckIn(appt.id, (appt as any).patientId, appt.patientName); }}
                            className="p-1 rounded-md hover:bg-accent/20 text-accent-foreground"
                            title={t("patients.checkIn")}
                          >
                            {checkingInId === appt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(appt.id); }}
                          className="p-1 rounded-md hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
                          title={t("presc.delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const { clinic } = useAuth();
  const { t, lang } = useLang();
  const clinicId = clinic?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { format: formatCurrency } = useCurrency();

  const [view, setView] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const { data: appointments, isLoading } = useListAppointments(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, {}) }
  });

  const { data: patients } = useListPatients(clinicId, { limit: 1000 }, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId, { limit: 1000 }) }
  });
  const patientPhones = new Map((patients?.data ?? []).map((patient) => [patient.id, patient.phone]));

  const createMutation = useCreateAppointment();
  const deleteMutation = useDeleteAppointment();
  const patchPatient = usePatchPatient();

  const form = useForm<ApptForm>({
    resolver: zodResolver(apptSchema),
    defaultValues: {
      patientId: "",
      date: currentDate,
      time: "10:00",
      type: "New Consultation",
      notes: "",
    },
  });

  const onSubmit = (values: ApptForm) => {
    createMutation.mutate({ clinicId, data: values }, {
      onSuccess: () => {
        toast({ title: t("appt.toast.created") });
        qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
        setAddOpen(false);
        form.reset({ ...form.getValues(), patientId: "", notes: "" });
      },
      onError: () => toast({ title: t("appt.toast.failed"), variant: "destructive" }),
    });
  };

  const handleCheckIn = (appointmentId: string, patientId: string, patientName: string) => {
    setCheckingInId(appointmentId);
    patchPatient.mutate(
      { clinicId, patientId, data: { status: "waiting" } },
      {
        onSuccess: () => {
          toast({ title: `${patientName} ${t("patients.toast.sentToQueue")}` });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey(clinicId) });
          qc.invalidateQueries({ queryKey: getGetPatientQueryKey(clinicId, patientId) });
          qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
        },
        onError: () => toast({ title: t("patients.toast.checkInFailed"), variant: "destructive" }),
        onSettled: () => setCheckingInId(null),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("appt.confirmDelete"))) return;
    deleteMutation.mutate({ clinicId, appointmentId: id }, {
      onSuccess: () => {
        toast({ title: t("appt.toast.deleted") });
        qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
      },
      onError: () => toast({ title: t("appt.toast.failed"), variant: "destructive" }),
    });
  };

  const dayAppts = appointments?.data.filter(a => a.date.split("T")[0] === currentDate) ?? [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t("appt.title")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t("appt.scheduleAt")} {formatDayLabel(currentDate, lang)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded-lg p-1 bg-muted/20 mr-2">
                <Button
                  variant={view === "day" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setView("day")}
                >
                  {t("appt.viewDay")}
                </Button>
                <Button
                  variant={view === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setView("list")}
                >
                  {t("appt.viewList")}
                </Button>
              </div>
              <Button onClick={() => setAddOpen(true)} data-testid="button-add-appt">
                <Plus className="w-4 h-4 mr-2" />{t("appt.new")}
              </Button>
            </div>
          </div>

          {view === "day" ? (
            <DayCalendar
              appointments={dayAppts}
              date={currentDate}
              onPrevDay={() => setCurrentDate(d => addDays(d, -1))}
              onNextDay={() => setCurrentDate(d => addDays(d, 1))}
              onToday={() => setCurrentDate(new Date().toISOString().split("T")[0])}
              onClickSlot={(time) => { form.setValue("time", time); form.setValue("date", currentDate); setAddOpen(true); }}
              onComplete={() => {}}
              onCancel={() => {}}
              onDelete={handleDelete}
              onCheckIn={handleCheckIn}
              checkingInId={checkingInId}
              currencyCode="EGP"
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[120px_80px_minmax(220px,1fr)_140px_auto_140px] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>{t("appt.date")}</span>
                <span>{t("appt.time")}</span>
                <span>{t("patients.name")}</span>
                <span>{t("patients.visitType")}</span>
                <span>{t("patients.status")}</span>
                <span className="text-right">{t("patients.actions")}</span>
              </div>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-6 py-4 border-b border-border"><Skeleton className="h-5 w-full" /></div>
                ))
              ) : !appointments?.data.length ? (
                <div className="text-center py-14 text-muted-foreground">
                  <p className="font-medium text-sm">{t("appt.noAppts")}</p>
                </div>
              ) : (
                appointments.data.map(appt => (
                  <div
                    key={appt.id}
                    data-testid={`appt-row-${appt.id}`}
                    className="grid grid-cols-[120px_80px_minmax(220px,1fr)_140px_auto_140px] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm">{new Date(`${appt.date}T00:00:00`).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                    <span className="text-sm font-mono text-muted-foreground">{appt.time}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                        {appt.patientName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium truncate">{appt.patientName}</span>
                    </div>
                    <span><VisitTypeBadge type={appt.type} /></span>
                    <StatusBadge status={appt.status} />
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                        disabled={!patientPhones.get(appt.patientId)}
                        onClick={() =>
                          openWhatsApp(
                            patientPhones.get(appt.patientId) ?? "",
                            whatsappAppointmentReminder({
                              patientName: appt.patientName,
                              clinicName: clinic?.name ?? "the clinic",
                              date: appt.date,
                              time: appt.time
                            })
                          )
                        }
                        title={t("appt.whatsapp")}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(appt.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("appt.new")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>{t("presc.patient")} *</Label>
                <Controller
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <PatientSearch value={field.value} onChange={field.onChange} patients={patients?.data ?? []} />
                  )}
                />
                {form.formState.errors.patientId && <p className="text-xs text-destructive mt-1">{form.formState.errors.patientId.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("appt.date")} *</Label>
                  <Input {...form.register("date")} type="date" className="mt-1" />
                </div>
                <div>
                  <Label>{t("appt.time")} *</Label>
                  <Input {...form.register("time")} type="time" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>{t("patients.visitType")} *</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PATIENT_VISIT_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>{t("appt.notes")}</Label>
                <Input {...form.register("notes")} placeholder="Optional..." className="mt-1" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("presc.cancel")}</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-appt">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("appt.save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
