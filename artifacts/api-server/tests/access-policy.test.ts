import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPreActivationClinicStatus,
  canAccessFinance,
  dashboardForRole,
  FINANCE_ROLES,
} from "../src/lib/access-policy.ts";

test("pending and pending_approval clinics are pre-activation", () => {
  assert.equal(isPreActivationClinicStatus("pending"), true);
  assert.equal(isPreActivationClinicStatus("pending_approval"), true);
});

test("active, blocked, deactivated and missing statuses are not pre-activation", () => {
  for (const s of ["active", "blocked", "deactivated", "", undefined, null]) {
    assert.equal(isPreActivationClinicStatus(s), false);
  }
});

test("only admin, doctor and superadmin can access finance", () => {
  assert.deepEqual([...FINANCE_ROLES].sort(), ["admin", "doctor", "superadmin"]);
  for (const r of ["nurse", "assistant", "secretary", "", undefined, null]) {
    assert.equal(canAccessFinance(r), false);
  }
});

test("dashboard keeps finance figures for finance roles and zeroes them otherwise", () => {
  const s = { totalPatients: 6, monthlyRevenue: 1200, monthlyExpenses: 300 };
  assert.deepEqual(dashboardForRole(s, "admin"), s);
  assert.deepEqual(dashboardForRole(s, "doctor"), s);
  for (const r of ["secretary", "nurse", "assistant"]) {
    assert.deepEqual(dashboardForRole(s, r), { totalPatients: 6, monthlyRevenue: 0, monthlyExpenses: 0 });
  }
  assert.equal(s.monthlyRevenue, 1200);
});
