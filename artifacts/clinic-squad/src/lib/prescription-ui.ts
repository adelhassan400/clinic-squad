export type UiLang = "en" | "ar";

export interface Preset {
  en: string;
  ar: string;
}

// Roles allowed to create prescriptions. Mirrors the API route
// POST /clinics/:clinicId/prescriptions (requireRole admin, doctor, superadmin).
const PRESCRIBER_ROLES = ["admin", "doctor", "superadmin"];

export function canCreatePrescription(role: string | null | undefined): boolean {
  return !!role && PRESCRIBER_ROLES.includes(role);
}

export const FREQUENCY_PRESETS: Preset[] = [
  { en: "Once daily", ar: "مرة يومياً" },
  { en: "Twice daily", ar: "مرتين يومياً" },
  { en: "3× daily", ar: "3 مرات يومياً" },
  { en: "Every 8h", ar: "كل 8 ساعات" },
  { en: "Before meals", ar: "قبل الأكل" },
  { en: "After meals", ar: "بعد الأكل" },
];

export const DURATION_PRESETS: Preset[] = [
  { en: "3 days", ar: "3 أيام" },
  { en: "5 days", ar: "5 أيام" },
  { en: "7 days", ar: "7 أيام" },
  { en: "10 days", ar: "10 أيام" },
  { en: "14 days", ar: "14 يوماً" },
  { en: "1 month", ar: "شهر واحد" },
];

export function presetLabel(preset: Preset, lang: string): string {
  return lang === "ar" ? preset.ar : preset.en;
}
