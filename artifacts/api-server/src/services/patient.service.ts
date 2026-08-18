import { eq, and, or, ilike, count, sql, SQL, inArray } from "drizzle-orm";
import { db, patientsTable, appointmentsTable, cashTransactionsTable, Patient } from "@workspace/db";
import { randomUUID } from "crypto";

function formatEgyptDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatEgyptTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export interface PatientFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class PatientService {
  static async listPatients(clinicId: string, filters: PatientFilters) {
    const { search, status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(patientsTable.clinicId, clinicId)];
    
    if (status) {
      conditions.push(eq(patientsTable.status, status));
    }

    if (search) {
      const s = `%${search}%`;
      conditions.push(
        or(
          ilike(patientsTable.name, s),
          ilike(patientsTable.phone, s),
          ilike(patientsTable.code, s)
        )!
      );
    }

    const whereClause = and(...conditions)!;

    const [countResult] = await db
      .select({ value: count() })
      .from(patientsTable)
      .where(whereClause);
    
    const total = countResult.value;

    const data = await db
      .select()
      .from(patientsTable)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(patientsTable.name);

    return {
      data: data.map(this.serialize),
      total,
      page,
      limit,
    };
  }

  static async getPatient(clinicId: string, patientId: string) {
    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
      .limit(1);

    if (!patient) throw new Error("Patient not found");
    return this.serialize(patient);
  }

  static async createPatient(clinicId: string, data: any) {
    return await db.transaction(async (tx: any) => {
      const id = randomUUID();
      const code = await this.nextPatientCode(clinicId, tx);

      await tx.insert(patientsTable).values({
        id,
        clinicId,
        code,
        ...data,
        // Keep the initial visit type on the patient record so the table and check-in share one value.
        visitType: data.visitType || "New Consultation",
        status: data.status || "registered",
      });

      const [newPatient] = await tx
        .select()
        .from(patientsTable)
        .where(eq(patientsTable.id, id))
        .limit(1);

      return this.serialize(newPatient);
    });
  }

  static async registerAndQueuePatient(clinicId: string, actor: { id: string; role: string }, data: any) {
    const isSupervisor = ["admin", "doctor", "superadmin"].includes(actor.role);
    const cashCollected = data.cashCollected !== false;
    const paymentStatus = cashCollected ? "paid" : (data.paymentStatus === "unpaid" ? "unpaid" : "free");

    if (!cashCollected && !isSupervisor) {
      throw new Error("Only a reception supervisor or administrator can register an unpaid visit");
    }
    if (cashCollected && (!Number.isFinite(Number(data.collectedAmount)) || Number(data.collectedAmount) < 0)) {
      throw new Error("A valid collected amount is required when cash is collected");
    }

    const visitType = data.visitType || "New Consultation";
    const shiftDate = formatEgyptDate();
    const amount = cashCollected ? Number(data.collectedAmount).toFixed(2) : "0.00";
    const receivedAt = cashCollected ? new Date() : null;

    return db.transaction(async (tx: any) => {
      let patientId = data.patientId as string | undefined;
      let patient: any;

      if (patientId) {
        const rows = await tx
          .select()
          .from(patientsTable)
          .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
          .limit(1);
        patient = rows[0];
        if (!patient) throw new Error("Patient not found");
        if (["waiting", "in-progress"].includes(patient.status)) throw new Error("Patient is already in the queue");
      } else {
        patientId = randomUUID();
        const code = await this.nextPatientCode(clinicId, tx);
        const inserted = await tx.insert(patientsTable).values({
          id: patientId,
          clinicId,
          code,
          name: data.name,
          phone: data.phone,
          age: data.age,
          bloodType: data.bloodType ?? null,
          allergies: data.allergies ?? null,
          notes: data.notes ?? null,
          visitType,
        }).returning();
        patient = inserted[0];
      }

      const patientUpdates = {
        visitType,
        assignedDoctorId: data.doctorId ?? null,
        status: "waiting",
        paymentStatus,
        paymentAmount: amount,
        paymentMethod: cashCollected ? "cash" : null,
        paymentReference: data.paymentReference ?? null,
        paymentCollectedBy: actor.id,
        paymentShiftDate: shiftDate,
        paymentReceivedAt: receivedAt,
      };

      const updatedRows = await tx
        .update(patientsTable)
        .set(patientUpdates)
        .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
        .returning();
      patient = updatedRows[0];

      const now = new Date();
      const appointmentId = randomUUID();
      await tx.insert(appointmentsTable).values({
        id: appointmentId,
        clinicId,
        patientId,
        patientName: patient.name,
        date: shiftDate,
        time: formatEgyptTime(now),
        status: "waiting",
        type: visitType,
        fee: amount,
      });

      await tx.insert(cashTransactionsTable).values({
        id: randomUUID(),
        clinicId,
        patientId,
        doctorId: data.doctorId ?? null,
        collectedBy: actor.id,
        visitType,
        amount,
        status: paymentStatus,
        paymentMethod: cashCollected ? "cash" : null,
        shiftDate,
      });

      return this.serialize(patient);
    });
  }

  static async bulkCheckInPatients(clinicId: string, patientIds: string[], visitType: string) {
    return db.transaction(async (tx: any) => {
      const selectedPatients = await tx
        .select({ id: patientsTable.id, status: patientsTable.status })
        .from(patientsTable)
        .where(and(eq(patientsTable.clinicId, clinicId), inArray(patientsTable.id, patientIds)));

      type SelectedPatient = { id: string; status: string };
      const selectedById = new Map(selectedPatients.map((patient: SelectedPatient) => [patient.id, patient]));
      const missingIds = patientIds.filter((patientId) => !selectedById.has(patientId));
      const skippedInProgressIds = selectedPatients
        .filter((patient: SelectedPatient) => patient.status === "waiting" || patient.status === "in-progress")
        .map((patient: SelectedPatient) => patient.id);
      const skippedUnpaidIds = selectedPatients
        .filter((patient: SelectedPatient) => patient.status !== "paid" && patient.status !== "waiting" && patient.status !== "in-progress")
        .map((patient: SelectedPatient) => patient.id);
      const eligibleIds = selectedPatients
        .filter((patient: SelectedPatient) => patient.status === "paid")
        .map((patient: SelectedPatient) => patient.id);

      if (eligibleIds.length > 0) {
        await tx
          .update(patientsTable)
          .set({ status: "waiting", visitType })
          .where(and(eq(patientsTable.clinicId, clinicId), inArray(patientsTable.id, eligibleIds)));
      }

      return {
        updatedCount: eligibleIds.length,
        skippedCount: skippedInProgressIds.length + skippedUnpaidIds.length + missingIds.length,
        skippedInProgressCount: skippedInProgressIds.length,
        skippedInProgressIds,
        skippedUnpaidIds,
        missingIds,
      };
    });
  }

  static async updatePatient(clinicId: string, patientId: string, updates: any) {
    const [currentPatient] = await db
      .select({ status: patientsTable.status, paymentStatus: patientsTable.paymentStatus })
      .from(patientsTable)
      .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
      .limit(1);

    if (!currentPatient) throw new Error("Patient not found");
    // Queue registration no longer requires prepayment. Legacy check-in paths remain
    // available and are marked unpaid unless an existing payment state is preserved.
    if (updates.status === "paid" && !["cash", "vodafone_cash", "instapay", "card", "other"].includes(updates.paymentMethod)) {
      throw new Error("A payment method is required before marking a patient paid");
    }
    if (updates.status === "in-progress" && !["waiting", "in-progress"].includes(currentPatient.status)) {
      throw new Error("Patient must be in the waiting list before starting a session");
    }

    const dbUpdates: Record<string, any> = {};
    
    // Explicitly handle fields that might be null/undefined
    const fields = [
      'name', 'phone', 'age', 'dateOfBirth', 'bloodType', 
      'allergies', 'notes', 'visitType', 'status',
      'assignedDoctorId', 'paymentStatus', 'paymentAmount', 'paymentMethod',
      'paymentReference', 'paymentCollectedBy', 'paymentShiftDate', 'paymentReceivedAt',
      'diagnosis', 'clinicalNotes', 'chronicConditions'
    ];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        dbUpdates[field] = updates[field] ?? null;
      }
    }

    if (updates.status === "waiting" && updates.paymentStatus === undefined) {
      dbUpdates.paymentStatus = currentPatient.paymentStatus ?? "unpaid";
    }

    if (updates.status === "paid") {
      dbUpdates.paymentStatus = "paid";
      dbUpdates.paymentReceivedAt = new Date();
    }

    if (Object.keys(dbUpdates).length > 0) {
      await db
        .update(patientsTable)
        .set(dbUpdates)
        .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
    }

    return this.getPatient(clinicId, patientId);
  }

  static async deletePatient(clinicId: string, patientId: string) {
    await db
      .delete(patientsTable)
      .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  }

  private static async nextPatientCode(clinicId: string, tx: any = db) {
    const [lastPatient] = await tx
      .select({ code: patientsTable.code })
      .from(patientsTable)
      .where(eq(patientsTable.clinicId, clinicId))
      .orderBy(sql`${patientsTable.code} DESC`)
      .limit(1);

    if (!lastPatient?.code) return "PT-0001";
    
    const match = lastPatient.code.match(/PT-(\d+)/);
    const num = match ? parseInt(match[1]) : 0;
    return `PT-${(num + 1).toString().padStart(4, "0")}`;
  }

  private static serialize(p: Patient) {
    return {
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
