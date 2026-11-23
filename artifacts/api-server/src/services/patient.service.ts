import { eq, and, or, ilike, count, sql, SQL, inArray } from "drizzle-orm";
import {
  db,
  patientsTable,
  appointmentsTable,
  cashTransactionsTable,
  usersTable,
  Patient,
} from "@workspace/db";
import { randomUUID } from "crypto";

function formatEgyptDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatEgyptTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
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
          ilike(patientsTable.code, s),
        )!,
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
      .where(
        and(
          eq(patientsTable.id, patientId),
          eq(patientsTable.clinicId, clinicId),
        ),
      )
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

  /** One transaction for every arrival, including scheduled and legacy check-ins. */
  static async registerAndQueuePatient(
    clinicId: string,
    actor: { id: string; role: string },
    data: any,
    transaction?: any,
  ): Promise<any> {
    const run = async (tx: any) => {
      // Serialize patient-code allocation as well as repeated arrivals in this clinic.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${clinicId}))`,
      );
      let patient: any;
      if (data.patientId) {
        [patient] = await tx
          .select()
          .from(patientsTable)
          .where(
            and(
              eq(patientsTable.id, data.patientId),
              eq(patientsTable.clinicId, clinicId),
            ),
          )
          .limit(1)
          .for("update");
        if (!patient) throw new Error("Patient not found");
        if (["waiting", "in-progress"].includes(patient.status))
          throw new Error("Patient is already in the queue");
      } else {
        const code = await this.nextPatientCode(clinicId, tx);
        [patient] = await tx
          .insert(patientsTable)
          .values({
            id: randomUUID(),
            clinicId,
            code,
            name: data.name,
            phone: data.phone,
            age: data.age,
            bloodType: data.bloodType ?? null,
            allergies: data.allergies ?? null,
            notes: data.notes ?? null,
          })
          .returning();
      }
      let appointment: any;
      if (data.appointmentId) {
        [appointment] = await tx
          .select()
          .from(appointmentsTable)
          .where(
            and(
              eq(appointmentsTable.id, data.appointmentId),
              eq(appointmentsTable.clinicId, clinicId),
              eq(appointmentsTable.patientId, patient.id),
            ),
          )
          .limit(1)
          .for("update");
        if (!appointment) throw new Error("Appointment not found");
        if (appointment.status !== "scheduled")
          throw new Error("Appointment is not scheduled");
        if (appointment.date !== formatEgyptDate())
          throw new Error("Only today's appointments can be checked in");
      }
      const doctorId = data.doctorId ?? patient.assignedDoctorId ?? null;
      if (doctorId) {
        const [doctor] = await tx
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.id, doctorId),
              eq(usersTable.clinicId, clinicId),
              inArray(usersTable.role, ["admin", "doctor"]),
              eq(usersTable.isBlocked, false),
            ),
          )
          .limit(1);
        if (!doctor) throw new Error("Invalid assigned doctor");
      }
      const explicitPayment = data.cashCollected !== undefined;
      const cashCollected = data.cashCollected === true;
      if (
        explicitPayment &&
        !cashCollected &&
        !["admin", "doctor", "superadmin"].includes(actor.role)
      ) {
        throw new Error(
          "Only a reception supervisor or administrator can register an unpaid visit",
        );
      }
      if (
        cashCollected &&
        (!Number.isFinite(data.collectedAmount) || data.collectedAmount < 0)
      ) {
        throw new Error(
          "A valid collected amount is required when cash is collected",
        );
      }
      // Only a patient currently marked paid represents advance payment. Never
      // carry an old completed visit's payment into a new visit.
      const prepaid =
        !explicitPayment &&
        patient.status === "paid" &&
        patient.paymentStatus === "paid";
      const paymentStatus =
        cashCollected || prepaid
          ? "paid"
          : explicitPayment && data.paymentStatus === "free"
            ? "free"
            : "unpaid";
      const amount = Number(
        paymentStatus === "free"
          ? 0
          : cashCollected
            ? data.collectedAmount
            : prepaid
              ? (patient.paymentAmount ?? 0)
              : (appointment?.fee ?? 0),
      ).toFixed(2);
      const visitType =
        data.visitType ??
        appointment?.type ??
        patient.visitType ??
        "New Consultation";
      const now = new Date();
      const shiftDate = formatEgyptDate(now);
      const appointmentId = appointment?.id ?? randomUUID();
      const paymentMethod = cashCollected
        ? "cash"
        : prepaid
          ? patient.paymentMethod
          : null;
      const [updated] = await tx
        .update(patientsTable)
        .set({
          status: "waiting",
          checkedInAt: now,
          activeAppointmentId: appointmentId,
          visitType,
          assignedDoctorId: doctorId,
          paymentStatus,
          paymentAmount: amount,
          paymentMethod,
          paymentReference:
            data.paymentReference ??
            (prepaid ? patient.paymentReference : null),
          paymentCollectedBy: cashCollected
            ? actor.id
            : prepaid
              ? patient.paymentCollectedBy
              : null,
          paymentShiftDate: shiftDate,
          paymentReceivedAt: cashCollected
            ? now
            : prepaid
              ? patient.paymentReceivedAt
              : null,
        })
        .where(eq(patientsTable.id, patient.id))
        .returning();
      if (appointment) {
        await tx
          .update(appointmentsTable)
          .set({ status: "waiting", type: visitType, fee: amount })
          .where(eq(appointmentsTable.id, appointmentId));
      } else {
        await tx
          .insert(appointmentsTable)
          .values({
            id: appointmentId,
            clinicId,
            patientId: patient.id,
            patientName: patient.name,
            date: shiftDate,
            time: formatEgyptTime(now),
            status: "waiting",
            type: visitType,
            fee: amount,
          });
      }
      await tx
        .insert(cashTransactionsTable)
        .values({
          id: randomUUID(),
          clinicId,
          patientId: patient.id,
          doctorId,
          collectedBy: actor.id,
          visitType,
          amount,
          status: paymentStatus,
          paymentMethod,
          shiftDate,
        });
      return this.serialize(updated);
    };
    return transaction ? run(transaction) : db.transaction(run);
  }

  static async listQueue(clinicId: string, doctorId?: string) {
    const conditions = [
      eq(patientsTable.clinicId, clinicId),
      inArray(patientsTable.status, ["waiting", "in-progress"]),
    ];
    if (doctorId) conditions.push(eq(patientsTable.assignedDoctorId, doctorId));
    const rows = await db
      .select()
      .from(patientsTable)
      .where(and(...conditions))
      .orderBy(
        sql`case when ${patientsTable.status} = 'in-progress' then 0 else 1 end`,
        sql`${patientsTable.checkedInAt} ASC NULLS LAST`,
        patientsTable.id,
      );
    return { data: rows.map(this.serialize) };
  }

  static async bulkCheckInPatients(
    clinicId: string,
    patientIds: string[],
    visitType: string,
    actor: { id: string; role: string },
  ) {
    return db.transaction(async (tx: any) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${clinicId}))`,
      );
      const selected = await tx
        .select()
        .from(patientsTable)
        .where(
          and(
            eq(patientsTable.clinicId, clinicId),
            inArray(patientsTable.id, patientIds),
          ),
        )
        .for("update");
      const missingIds = patientIds.filter(
        (id) => !selected.some((p: any) => p.id === id),
      );
      const skippedInProgressIds = selected
        .filter((p: any) => ["waiting", "in-progress"].includes(p.status))
        .map((p: any) => p.id);
      const skippedUnpaidIds = selected
        .filter(
          (p: any) => !["paid", "waiting", "in-progress"].includes(p.status),
        )
        .map((p: any) => p.id);
      const eligible = selected.filter((p: any) => p.status === "paid");
      for (const p of eligible)
        await this.registerAndQueuePatient(
          clinicId,
          actor,
          { patientId: p.id, visitType },
          tx,
        );
      return {
        updatedCount: eligible.length,
        skippedCount:
          missingIds.length +
          skippedInProgressIds.length +
          skippedUnpaidIds.length,
        skippedInProgressCount: skippedInProgressIds.length,
        skippedInProgressIds,
        skippedUnpaidIds,
        missingIds,
      };
    });
  }

  static async updatePatient(
    clinicId: string,
    patientId: string,
    updates: any,
    actor?: { id: string; role: string },
  ) {
    if (updates.status === "waiting") {
      if (!actor) throw new Error("Check-in requires an authenticated actor");
      return this.registerAndQueuePatient(clinicId, actor, {
        patientId,
        visitType: updates.visitType,
      });
    }
    const [currentPatient] = await db
      .select({
        status: patientsTable.status,
        paymentStatus: patientsTable.paymentStatus,
      })
      .from(patientsTable)
      .where(
        and(
          eq(patientsTable.id, patientId),
          eq(patientsTable.clinicId, clinicId),
        ),
      )
      .limit(1);

    if (!currentPatient) throw new Error("Patient not found");
    // Queue registration no longer requires prepayment. Legacy check-in paths remain
    // available and are marked unpaid unless an existing payment state is preserved.
    if (
      updates.status === "paid" &&
      !["cash", "vodafone_cash", "instapay", "card", "other"].includes(
        updates.paymentMethod,
      )
    ) {
      throw new Error(
        "A payment method is required before marking a patient paid",
      );
    }
    if (
      updates.status === "in-progress" &&
      !["waiting", "in-progress"].includes(currentPatient.status)
    ) {
      throw new Error(
        "Patient must be in the waiting list before starting a session",
      );
    }

    const dbUpdates: Record<string, any> = {};

    // Explicitly handle fields that might be null/undefined
    const fields = [
      "name",
      "phone",
      "age",
      "dateOfBirth",
      "bloodType",
      "allergies",
      "notes",
      "visitType",
      "status",
      "assignedDoctorId",
      "paymentStatus",
      "paymentAmount",
      "paymentMethod",
      "paymentReference",
      "paymentCollectedBy",
      "paymentShiftDate",
      "paymentReceivedAt",
      "diagnosis",
      "clinicalNotes",
      "chronicConditions",
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
      await db.transaction(async (tx) => {
        await tx
          .update(patientsTable)
          .set(dbUpdates)
          .where(
            and(
              eq(patientsTable.id, patientId),
              eq(patientsTable.clinicId, clinicId),
            ),
          );
        if (["in-progress", "completed"].includes(updates.status)) {
          const [p] = await tx
            .select()
            .from(patientsTable)
            .where(eq(patientsTable.id, patientId))
            .limit(1);
          if (p.activeAppointmentId)
            await tx
              .update(appointmentsTable)
              .set({ status: updates.status })
              .where(
                and(
                  eq(appointmentsTable.id, p.activeAppointmentId),
                  eq(appointmentsTable.clinicId, clinicId),
                ),
              );
        }
      });
    }

    return this.getPatient(clinicId, patientId);
  }

  static async deletePatient(clinicId: string, patientId: string) {
    await db
      .delete(patientsTable)
      .where(
        and(
          eq(patientsTable.id, patientId),
          eq(patientsTable.clinicId, clinicId),
        ),
      );
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
      checkedInAt: p.checkedInAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
             }
