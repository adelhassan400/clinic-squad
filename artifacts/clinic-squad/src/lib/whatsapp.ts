/**
 * WhatsApp helpers — open https://wa.me/<phone>?text=... in a new tab.
 * No API/cost required; uses WhatsApp's public click-to-chat link.
 */

/**
 * Normalize a phone number into the digits-only format wa.me expects.
 * - Strips spaces, dashes, parentheses.
 * - Egyptian local numbers starting with `0` (e.g. `01012345678`) are
 *   converted to `20XXXXXXXXXX` (Egypt country code).
 * - Numbers already in international form (`+20...` or `00...`) are kept.
 */
export function sanitizePhone(raw: string): string {
  if (!raw) return "";
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("+")) p = p.slice(1);
  // Egyptian local format: 0XXXXXXXXXX (11 digits) -> 20XXXXXXXXXX
  if (p.length === 11 && p.startsWith("0")) {
    p = "20" + p.slice(1);
  }
  return p;
}

export function whatsappUrl(phone: string, message: string): string {
  const number = sanitizePhone(phone);
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

export function openWhatsApp(phone: string, message: string): void {
  if (!phone) return;
  const url = whatsappUrl(phone, message);
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Generic "hello from the clinic" message. */
export function whatsappPatientGreeting(opts: {
  patientName: string;
  clinicName: string;
}): string {
  const { patientName, clinicName } = opts;
  return `Hello ${patientName}, this is ${clinicName}. How can we help you today?`;
}

/** Appointment reminder message. */
export function whatsappAppointmentReminder(opts: {
  patientName: string;
  clinicName: string;
  date: string;
  time: string;
  type?: string | null;
}): string {
  const { patientName, clinicName, date, time, type } = opts;
  const typeLine = type ? ` for ${type}` : "";
  return (
    `Hello ${patientName}, this is a reminder of your appointment${typeLine} ` +
    `at ${clinicName} on ${date} at ${time}. ` +
    `Please reply to confirm. Thank you!`
  );
}
