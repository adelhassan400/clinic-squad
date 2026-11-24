// Access rules shared by the API middleware and routes. No imports on purpose,
// so they can be unit tested without a database.

// Clinics in these states are awaiting activation by the platform admin.
const PRE_ACTIVATION_STATUSES = ["pending", "pending_approval"];

export function isPreActivationClinicStatus(status: string | null | undefined): boolean {
  return !!status && PRE_ACTIVATION_STATUSES.includes(status);
}

// Roles that may read or write clinic finance data. Matches the UI: the
// Finances and Insights pages are shown to admin and doctor only.
export const FINANCE_ROLES = ["admin", "doctor", "superadmin"];

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
