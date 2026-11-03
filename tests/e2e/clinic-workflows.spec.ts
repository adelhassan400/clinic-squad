import { test, expect, authHeaders } from "./fixtures";

async function createPatient(api: any, token: string, clinicId: string, suffix = Date.now()) {
  const response = await api.post(`/api/clinics/${clinicId}/patients`, {
    headers: authHeaders(token),
    data: { name: `Synthetic Patient ${suffix}`, phone: `010${String(suffix).slice(-8)}`, age: 34 },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

test.describe("Patient management", () => {
  test("registers, views, edits, searches, and persists a patient", async ({ api, clinicAdmin }) => {
    const patient = await createPatient(api, clinicAdmin.token, clinicAdmin.clinicId, "patient-a");
    const detail = await api.get(`/api/clinics/${clinicAdmin.clinicId}/patients/${patient.id}`, { headers: authHeaders(clinicAdmin.token) });
    expect(detail.status()).toBe(200);
    expect((await detail.json()).name).toContain("Synthetic Patient");

    const update = await api.patch(`/api/clinics/${clinicAdmin.clinicId}/patients/${patient.id}`, {
      headers: authHeaders(clinicAdmin.token),
      data: { name: "Synthetic Patient Updated", phone: patient.phone, age: 35 },
    });
    expect(update.status()).toBe(200);

    const search = await api.get(`/api/clinics/${clinicAdmin.clinicId}/patients?search=Updated`, { headers: authHeaders(clinicAdmin.token) });
    expect(search.status()).toBe(200);
    expect((await search.json()).data.some((row: any) => row.id === patient.id)).toBeTruthy();

    const persisted = await api.get(`/api/clinics/${clinicAdmin.clinicId}/patients/${patient.id}`, { headers: authHeaders(clinicAdmin.token) });
    expect((await persisted.json()).name).toBe("Synthetic Patient Updated");
  });
});

test.describe("Appointments", () => {
  test("creates, reschedules, cancels, and checks in an appointment", async ({ api, clinicAdmin }) => {
    const patient = await createPatient(api, clinicAdmin.token, clinicAdmin.clinicId, "appointment-a");
    const create = await api.post(`/api/clinics/${clinicAdmin.clinicId}/appointments`, {
      headers: authHeaders(clinicAdmin.token),
      data: { patientId: patient.id, date: "2030-01-15", time: "10:30", type: "New Consultation", notes: "Synthetic appointment" },
    });
    expect(create.status()).toBe(201);
    const appointment = await create.json();

    const update = await api.put(`/api/clinics/${clinicAdmin.clinicId}/appointments/${appointment.id}`, {
      headers: authHeaders(clinicAdmin.token),
      data: { date: "2030-01-16", time: "11:00", status: "scheduled" },
    });
    expect(update.status()).toBe(200);
    expect((await update.json()).date).toBe("2030-01-16");

    const cancel = await api.delete(`/api/clinics/${clinicAdmin.clinicId}/appointments/${appointment.id}`, { headers: authHeaders(clinicAdmin.token) });
    expect(cancel.status()).toBe(204);

    const checkIn = await api.post(`/api/clinics/${clinicAdmin.clinicId}/patients/register-and-queue`, {
      headers: authHeaders(clinicAdmin.token),
      data: { patientId: patient.id, visitType: "Follow-up", cashCollected: true },
    });
    expect(checkIn.status()).toBe(201);
  });
});

test.describe("Complete patient journey and payments", () => {
  test("registers, queues, pays, documents, prescribes, and verifies records", async ({ api, clinicAdmin, doctor }) => {
    const admission = await api.post(`/api/clinics/${clinicAdmin.clinicId}/patients/register-and-queue`, {
      headers: authHeaders(clinicAdmin.token),
      data: { name: "Synthetic Journey Patient", phone: "01099990000", age: 41, visitType: "New Consultation", cashCollected: true, doctorId: doctor.userId },
    });
    expect(admission.status()).toBe(201);
    const encounter = await admission.json();
    expect(encounter.paymentStatus).toBe("paid");

    const update = await api.patch(`/api/clinics/${clinicAdmin.clinicId}/patients/${encounter.patientId}`, {
      headers: authHeaders(doctor.token),
      data: { diagnosis: "Synthetic diagnosis", clinicalNotes: "Synthetic clinical notes", status: "completed" },
    });
    expect(update.status()).toBe(200);

    const prescription = await api.post(`/api/clinics/${clinicAdmin.clinicId}/prescriptions`, {
      headers: authHeaders(doctor.token),
      data: { patientId: encounter.patientId, diagnosis: "Synthetic diagnosis", notes: "Synthetic prescription", items: [{ drug: "Synthetic Drug", dosage: "10 mg", frequency: "Once daily", duration: "7 days" }] },
    });
    expect(prescription.status()).toBe(201);

    const daily = await api.get(`/api/clinics/${clinicAdmin.clinicId}/cash-transactions/daily`, { headers: authHeaders(clinicAdmin.token) });
    expect(daily.status()).toBe(200);
    const report = await daily.json();
    expect(report.paidCount).toBeGreaterThanOrEqual(1);
    expect(Number(report.totalCollected)).toBeGreaterThanOrEqual(200);

    const prescriptions = await api.get(`/api/clinics/${clinicAdmin.clinicId}/prescriptions?patientId=${encounter.patientId}`, { headers: authHeaders(doctor.token) });
    expect((await prescriptions.json()).data).toHaveLength(1);
  });

  test("prevents duplicate queue admission and duplicate payment", async ({ api, clinicAdmin }) => {
    const first = await api.post(`/api/clinics/${clinicAdmin.clinicId}/patients/register-and-queue`, {
      headers: authHeaders(clinicAdmin.token),
      data: { name: "Synthetic Duplicate Patient", phone: "01088880000", age: 28, visitType: "Follow-up", cashCollected: true },
    });
    expect(first.status()).toBe(201);
    const patientId = (await first.json()).patientId;
    const duplicate = await api.post(`/api/clinics/${clinicAdmin.clinicId}/patients/register-and-queue`, {
      headers: authHeaders(clinicAdmin.token),
      data: { patientId, visitType: "Follow-up", cashCollected: true },
    });
    expect(duplicate.status()).toBe(409);

    const daily = await api.get(`/api/clinics/${clinicAdmin.clinicId}/cash-transactions/daily`, { headers: authHeaders(clinicAdmin.token) });
    const rows = (await daily.json()).transactions.filter((row: any) => row.patient_id === patientId || row.patientId === patientId);
    expect(rows).toHaveLength(1);
  });
});

test.describe("RBAC and tenant isolation", () => {
  test("assistant can read but cannot mutate clinical records", async ({ api, clinicAdmin, assistant }) => {
    const patient = await createPatient(api, clinicAdmin.token, clinicAdmin.clinicId, "rbac-a");
    const list = await api.get(`/api/clinics/${clinicAdmin.clinicId}/patients`, { headers: authHeaders(assistant.token) });
    expect(list.status()).toBe(200);
    const mutation = await api.patch(`/api/clinics/${clinicAdmin.clinicId}/patients/${patient.id}`, { headers: authHeaders(assistant.token), data: { diagnosis: "Forbidden" } });
    expect(mutation.status()).toBe(403);
    const prescription = await api.post(`/api/clinics/${clinicAdmin.clinicId}/prescriptions`, { headers: authHeaders(assistant.token), data: { patientId: patient.id, diagnosis: "Forbidden", items: [] } });
    expect(prescription.status()).toBe(403);
  });

  test("blocks cross-tenant access at the API boundary", async ({ api, clinicAdmin }) => {
    const response = await api.get("/api/clinics/other-synthetic-clinic/patients", { headers: authHeaders(clinicAdmin.token) });
    expect(response.status()).toBe(403);
    const direct = await api.get("/api/clinics/other-synthetic-clinic/patients/not-owned", { headers: authHeaders(clinicAdmin.token) });
    expect(direct.status()).toBe(403);
  });
});
