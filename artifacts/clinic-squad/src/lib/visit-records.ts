import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Vitals {
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  weight?: number | null;
  bloodSugar?: number | null;
  spo2?: number | null;
}

export interface VisitRecord {
  id: string;
  patientId: string;
  visitDate: string;
  vitals: Vitals | null;
  vitalsByName: string | null;
  ready: boolean;
  readyAt: string | null;
  diagnosis: string | null;
  clinicalNotes: string | null;
  doctorName: string | null;
}

export const todayVisitsKey = (clinicId: string) => ["visit-records", clinicId, "today"];
export const patientVisitsKey = (clinicId: string, patientId: string) => ["visit-records", clinicId, "patient", patientId];

// Today's vitals / ready flags for every patient (the queue screens poll this).
export function useTodayVisits(clinicId: string) {
  return useQuery({
    queryKey: todayVisitsKey(clinicId),
    queryFn: () => customFetch<{ data: VisitRecord[] }>(`/api/clinics/${clinicId}/visit-records`),
    enabled: !!clinicId,
    refetchInterval: 15000,
    retry: false,
  });
}

// One patient's past visits (vitals and, for doctors, diagnosis and notes).
export function usePatientVisits(clinicId: string, patientId: string, enabled = true) {
  return useQuery({
    queryKey: patientVisitsKey(clinicId, patientId),
    queryFn: () => customFetch<{ data: VisitRecord[] }>(`/api/clinics/${clinicId}/visit-records?patientId=${encodeURIComponent(patientId)}`),
    enabled: !!clinicId && !!patientId && enabled,
    retry: false,
  });
}

export function useSaveVitals(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { patientId: string; vitals: Vitals; ready?: boolean }) =>
      customFetch<VisitRecord>(`/api/clinics/${clinicId}/visit-records/vitals`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit-records", clinicId] }),
  });
}

export function saveVisitNotes(clinicId: string, body: { patientId: string; diagnosis: string; clinicalNotes: string }) {
  return customFetch<VisitRecord>(`/api/clinics/${clinicId}/visit-records/notes`, { method: "PUT", body: JSON.stringify(body) });
}

export function formatVitals(v: Vitals | null | undefined): string[] {
  if (!v) return [];
  const out: string[] = [];
  if (v.bpSystolic != null && v.bpDiastolic != null) out.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
  if (v.pulse != null) out.push(`HR ${v.pulse}`);
  if (v.temperature != null) out.push(`${v.temperature}°C`);
  if (v.spo2 != null) out.push(`SpO2 ${v.spo2}%`);
  if (v.weight != null) out.push(`${v.weight} kg`);
  if (v.bloodSugar != null) out.push(`Sugar ${v.bloodSugar}`);
  return out;
}
