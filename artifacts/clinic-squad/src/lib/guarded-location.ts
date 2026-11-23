import { useSyncExternalStore } from "react";
import { navigate } from "wouter/use-browser-location";
import type { ConsultationSave } from "./consultation-save";
let activeSave: ConsultationSave | null = null;
export function registerConsultationSave(save: ConsultationSave) {
  activeSave = save;
  return () => {
    if (activeSave === save) activeSave = null;
  };
}
// A shared router snapshot is essential: every useLocation/Route must observe
// the SAME guarded path, not independently decide whether to leave a patient.
let shown = typeof location === "undefined" ? "/" : location.pathname;
const listeners = new Set<() => void>();
let navigation = 0;
async function update() {
  const target = location.pathname;
  if (target === shown) return;
  const version = ++navigation;
  try {
    if (activeSave?.dirty) await activeSave.flush();
    if (version !== navigation) return;
    shown = target;
    for (const listener of listeners) listener();
  } catch {
    if (version === navigation) navigate(shown, { replace: true });
  }
}
if (typeof window !== "undefined") {
  for (const event of ["popstate", "pushState", "replaceState", "hashchange"]) {
    window.addEventListener(event, () => {
      void update();
    });
  }
}
export function useGuardedLocation(): [string, typeof navigate] {
  const path = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => shown,
    () => "/",
  );
  return [path, navigate];
}
