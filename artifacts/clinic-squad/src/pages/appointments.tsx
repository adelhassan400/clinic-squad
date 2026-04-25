import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  useListAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment,
  useListPatients, getListAppointmentsQueryKey, getListPatientsQueryKey
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
  ChevronsUpDown, Check, Users, List, ChevronLeft, ChevronRight, Pill
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency";

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

// --- Helpers ---

const HOUR_HEIGHT = 72; // px per hour
const DAY_START = 8;    // 8 AM
const DAY_END = 21;     // 9 PM

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesFromDayStart(time: string): number {
  return timeToMinutes(time) - DAY_START * 60;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

// --- Status Badge ---
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", s?.badge ?? "bg-muted text-muted-foreground")}>
      {status.replace("_", " ")}
    </span>
  );
}

// --- Patient Combobox ---
interface PatientSearchProps {
  value: string;
  onChange: (id: string) => void;
  patients: Array<{ id: string; name: string; phone: string }>;
}

function PatientSearch({ value, onChange, patients }: PatientSearchProps) {
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
              Search patient by name or phone...
            </span>
          )}
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Type name or phone number..." className="h-10" />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <Users className="w-8 h-8 opacity-30" />
                <p>No patients found</p>
              </div>
            </CommandEmpty>
            <CommandGroup heading={`${patients.length} patient${patients.length !== 1 ? "s" : ""}`}>
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

// --- Day Calendar ---
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
  currencyCode: string;
}

function DayCalendar({
  appointments, date, onPrevDay, onNextDay, onToday,
  onClickSlot, onComplete, onCancel, onDelete, currencyCode
}: DayCalendarProps) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Only show appointments that fall within the visible range
  const visibleAppts = appointments.filter(a => {
    const mins = minutesFromDayStart(a.time);
    return mins >= 0 && mins < (DAY_END - DAY_START) * 60;
  });

  // Current time indicator
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
      {/* Day nav header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevDay}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-semibold">{formatDayLabel(date)}</p>
            {isToday(date) && (
              <p className="text-xs text-primary font-medium">Today</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextDay}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {visibleAppts.length} appointment{visibleAppts.length !== 1 ? "s" : ""}
          </span>
          {!isToday(date) && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToday}>
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="flex" style={{ minHeight: totalHeight }}>

          {/* Time gutter */}
          <div className="w-16 shrink-0 relative select-none" style={{ height: totalHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full flex items-start justify-end pr-3 pt-1"
                style={{ top: (hour - DAY_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-muted-foreground/60 font-mono leading-none">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Grid + appointments */}
          <div className="flex-1 relative border-l border-border" style={{ height: totalHeight }}>

            {/* Hour rows (clickable) */}
            {hours.map((hour) => (
              <div
                key={hour}
                onClick={() => handleSlotClick(hour)}
                title={`Schedule at ${String(hour).padStart(2, "0")}:00`}
                className="absolute w-full border-b border-border/50 cursor-pointer hover:bg-primary/[0.03] transition-colors group"
                style={{ top: (hour - DAY_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                {/* Half-hour tick */}
                <div
                  className="absolute w-full border-b border-border/20 border-dashed"
                  style={{ top: HOUR_HEIGHT / 2 }}
                />
                {/* Click hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-xs text-primary/50 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              </div>
            ))}

            {/* Now indicator */}
            {showNowLine && (
              <div
                className="absolute w-full flex items-center pointer-events-none z-20"
                style={{ top: nowTop }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0 shadow-sm" />
                <div className="flex-1 border-t-2 border-red-500" />
              </div>
            )}

            {/* Appointment blocks */}
            {visibleAppts.map((appt) => {
              const topMins = minutesFromDayStart(appt.time);
              const top = (topMins / 60) * HOUR_HEIGHT;
              const minHeight = 52;
              const s = STATUS_STYLES[appt.status] ?? STATUS_STYLES.scheduled;

              return (
                <div
                  key={appt.id}
                  data-testid={`cal-appt-${appt.id}`}
                  className={cn(
                    "absolute left-2 right-2 rounded-lg border px-3 py-2 flex gap-2 overflow-hidden z-10 shadow-sm",
                    s.bg
                  )}
                  style={{ top: top + 2, minHeight }}
                >
                  {/* Color bar */}
                  <div className={cn("w-1 rounded-full shrink-0 self-stretch", s.bar)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", s.text)}>{appt.patientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{appt.type}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {appt.status === "scheduled" && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onComplete(appt.id); }}
                              title="Mark completed"
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onCancel(appt.id); }}
                              title="Cancel"
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/20 text-destructive transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(appt.id); }}
                          title="Delete"
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={cn("text-xs font-mono font-medium", s.text)}>{appt.time}</span>
                      {appt.fee && (
                        <span className="text-xs text-muted-foreground">{appt.fee} {currencyCode}</span>
                      )}
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

// --- Main Page ---
export default function AppointmentsPage() {
  const { currency: { code: currencyCode } } = useCurrency();
  const { clinic } = useAuth();
  const clinicId = clinic?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dayDate, setDayDate] = useState(todayStr);
  const [addOpen, setAddOpen] = useState(false);

  // In day view we always filter by the selected day
  const listParams = {
    ...(filterDate ? { date: filterDate } : {}),
    ...(filterStatus && filterStatus !== "all" ? { status: filterStatus as "scheduled" | "completed" | "cancelled" | "no_show" } : {}),
  };

  const dayParams = { date: dayDate };

  const { data: listData, isLoading: listLoading } = useListAppointments(clinicId, listParams, {
    query: { enabled: !!clinicId && viewMode === "list", queryKey: getListAppointmentsQueryKey(clinicId, listParams) }
  });

  const { data: dayData, isLoading: dayLoading } = useListAppointments(clinicId, dayParams, {
    query: { enabled: !!clinicId && viewMode === "day", queryKey: getListAppointmentsQueryKey(clinicId, dayParams) }
  });

  const { data: patients } = useListPatients(clinicId, {}, {
    query: { enabled: !!clinicId, queryKey: getListPatientsQueryKey(clinicId, {}) }
  });

  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const deleteMutation = useDeleteAppointment();

  const form = useForm<ApptForm>({
    resolver: zodResolver(apptSchema),
    defaultValues: { patientId: "", date: todayStr, time: "", type: "" },
  });

  function openSchedule(prefillDate?: string, prefillTime?: string) {
    form.reset({
      patientId: "",
      date: prefillDate ?? (viewMode === "day" ? dayDate : todayStr),
      time: prefillTime ?? "",
      type: "",
    });
    setAddOpen(true);
  }

  const onSubmit = (values: ApptForm) => {
    createMutation.mutate({ clinicId, data: { ...values, fee: values.fee ?? undefined } }, {
      onSuccess: () => {
        toast({ title: "Appointment scheduled" });
        qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
        setAddOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to schedule appointment", variant: "destructive" }),
    });
  };

  const handleStatus = (appointmentId: string, status: string) => {
    updateMutation.mutate({ clinicId, appointmentId, data: { status: status as "scheduled" | "completed" | "cancelled" | "no_show" } }, {
      onSuccess: () => {
        toast({ title: `Appointment marked as ${status}` });
        qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  const handleDelete = (appointmentId: string) => {
    if (!confirm("Delete this appointment?")) return;
    deleteMutation.mutate({ clinicId, appointmentId }, {
      onSuccess: () => {
        toast({ title: "Appointment deleted" });
        qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const patientList = patients?.data ?? [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold">Appointments</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {viewMode === "list" ? `${listData?.total ?? 0} total` : `${dayData?.data.length ?? 0} today`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  data-testid="view-list"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  onClick={() => setViewMode("day")}
                  data-testid="view-day"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-border transition-colors",
                    viewMode === "day"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Day
                </button>
              </div>
              <Button onClick={() => openSchedule()} data-testid="button-add-appointment">
                <Plus className="w-4 h-4 mr-2" />Schedule
              </Button>
            </div>
          </div>

          {/* List view filters */}
          {viewMode === "list" && (
            <div className="flex flex-wrap gap-3 mb-5">
              <Input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="w-44"
                data-testid="filter-date"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
              {(filterDate || filterStatus !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterDate(""); setFilterStatus("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === "list" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Patient</span>
                <span>Date & Time</span>
                <span>Type</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {listLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-6 py-4 border-b border-border"><Skeleton className="h-5 w-full" /></div>
                ))
              ) : !listData?.data.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">No appointments found</p>
                  <Button size="sm" className="mt-4" onClick={() => openSchedule()}>
                    <Plus className="w-3 h-3 mr-1" />Schedule appointment
                  </Button>
                </div>
              ) : (
                listData.data.map(appt => (
                  <div
                    key={appt.id}
                    data-testid={`appt-row-${appt.id}`}
                    className="grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{appt.patientName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{appt.patientName}</p>
                        {appt.fee && <p className="text-xs text-muted-foreground">{appt.fee} {currencyCode}</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{appt.date}</p>
                      <p className="text-xs text-muted-foreground font-mono">{appt.time}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{appt.type}</span>
                    <StatusBadge status={appt.status} />
                    <div className="flex items-center gap-1">
                      {appt.status === "scheduled" && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                            onClick={() => handleStatus(appt.id, "completed")}
                            title="Mark completed"
                            data-testid={`complete-appt-${appt.id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                            onClick={() => handleStatus(appt.id, "cancelled")}
                            title="Cancel"
                            data-testid={`cancel-appt-${appt.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Link href={`/prescriptions?patientId=${appt.patientId}`}>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10"
                          title="Write prescription"
                          data-testid={`prescribe-appt-${appt.id}`}
                        >
                          <Pill className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(appt.id)}
                        data-testid={`delete-appt-${appt.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DAY VIEW */}
          {viewMode === "day" && (
            dayLoading ? (
              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : (
              <DayCalendar
                appointments={dayData?.data ?? []}
                date={dayDate}
                onPrevDay={() => setDayDate(d => addDays(d, -1))}
                onNextDay={() => setDayDate(d => addDays(d, 1))}
                onToday={() => setDayDate(todayStr)}
                onClickSlot={(time) => openSchedule(dayDate, time)}
                onComplete={(id) => handleStatus(id, "completed")}
                onCancel={(id) => handleStatus(id, "cancelled")}
                onDelete={handleDelete}
                currencyCode={currencyCode}
              />
            )
          )}
        </div>

        {/* Schedule Dialog */}
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) form.reset(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Appointment</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Patient *</Label>
                <Controller
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <PatientSearch value={field.value} onChange={field.onChange} patients={patientList} />
                  )}
                />
                {form.formState.errors.patientId && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.patientId.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input {...form.register("date")} type="date" className="mt-1" />
                </div>
                <div>
                  <Label>Time *</Label>
                  <Input {...form.register("time")} type="time" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Appointment Type *</Label>
                <Input {...form.register("type")} placeholder="General Checkup, Consultation..." className="mt-1" />
                {form.formState.errors.type && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.type.message}</p>
                )}
              </div>
              <div>
                <Label>Fee ({currencyCode})</Label>
                <Input {...form.register("fee")} type="number" placeholder="150" className="mt-1" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input {...form.register("notes")} placeholder="Any special notes..." className="mt-1" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => { setAddOpen(false); form.reset(); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-appointment">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Schedule
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
