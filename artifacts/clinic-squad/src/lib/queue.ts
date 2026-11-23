import { customFetch, type Patient } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";

export const queueKey = (clinicId: string) => ["queue", clinicId];
export function useQueue(clinicId: string, doctorId?: string) {
  const { user } = useAuth();
  const assigned = user?.role === "doctor" ? user.id : doctorId;
  return useQuery({
    queryKey: [...queueKey(clinicId), assigned ?? "all"],
    queryFn: () =>
      customFetch<{ data: Patient[] }>(
        `/api/clinics/${clinicId}/patients/queue${assigned ? `?doctorId=${encodeURIComponent(assigned)}` : ""}`,
      ),
    enabled: !!clinicId,
    refetchInterval: 15000,
  });
}
export function useCheckIn(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      appointmentId?: string;
      visitType?: string;
    }) =>
      customFetch(`/api/clinics/${clinicId}/patients/register-and-queue`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
