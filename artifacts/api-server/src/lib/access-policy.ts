// Access rules shared by the API middleware and routes. No imports on purpose,
// so they can be unit tested without a database.

// Clinics in these states are awaiting activation by the platform admin.
const PRE_ACTIVATION_STATUSES = ["pending", "pending_approval"];

export function isPreActivationClinicStatus(status: string | null | undefined): boolean {
  return !!status && PRE_ACTIVATION_STATUSES.includes(status);
}

// Roles that may read or write clinic finance data. Doctors are not included as a role:
// the clinic's founding owner (clinics.owner_id) is allowed separately by requireFinanceAccess,
// and doctors added to the team keep clinical access only.
export const FINANCE_ROLES = ["admin", "superadmin"];

// Roles that must not see medical details of a patient. "manager" is a non-physician clinic
// owner: booking and demographic data only, no diagnosis, notes, allergies or prescriptions.
export const MEDICAL_REDACTED_ROLES = ["assistant", "secretary", "nurse", "manager"];

export function isMedicalRedactedRole(role: string | null | undefined): boolean {
  return !!role && MEDICAL_REDACTED_ROLES.includes(role);
}

export function redactPatientForRole<T extends object>(patient: T, role: string | null | undefined): T {
  if (!isMedicalRedactedRole(role)) return patient;
  const out: Record<string, unknown> = { ...patient, diagnosis: null, clinicalNotes: null, chronicConditions: null };
  if (role === "manager") {
    out.allergies = null;
    out.bloodType = null;
    out.notes = null;
  }
  return out as T;
}

export function canAccessFinance(role: string | null | undefined): boolean {
  return !!role && FINANCE_ROLES.includes(role);
}

// The dashboard summary carries monthly revenue and expenses. Other roles get
// zeros so the response shape stays the same but no finance figures leak.
export function dashboardForRole<T extends { monthlyRevenue: number; monthlyExpenses: number }>(
  summary: T,
  role: string | null | undefined,
): T {
  if (canAccessFinance(role)) return summary;
  return { ...summary, monthlyRevenue: 0, monthlyExpenses: 0 };
}
