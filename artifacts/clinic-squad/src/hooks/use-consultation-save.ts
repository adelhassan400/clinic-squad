import { useEffect, useReducer, useRef } from "react";
import { customFetch } from "@workspace/api-client-react";
import { ConsultationSave } from "@/lib/consultation-save";
import { registerConsultationSave } from "@/lib/guarded-location";

export function useConsultationSave(clinicId: string, patientId: string) {
  const [, render] = useReducer((n) => n + 1, 0);
  const mounted = useRef(true);
  const ref = useRef<ConsultationSave | null>(null);
  if (!ref.current)
    ref.current = new ConsultationSave(
      (draft) =>
        customFetch(`/api/clinics/${clinicId}/patients/${patientId}`, {
          method: "PATCH",
          body: JSON.stringify({
            diagnosis: draft.diagnosis || null,
            clinicalNotes: draft.clinicalNotes || null,
          }),
        }),
      () => {
        if (mounted.current) render();
      },
    );
  const save = ref.current;
  useEffect(() => {
    mounted.current = true;
    const unregister = registerConsultationSave(save);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (save.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      unregister();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [save]);
  return save;
}
