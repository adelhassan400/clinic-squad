import { eq, and, sql, count } from "drizzle-orm";
import { db, appointmentsTable, patientsTable, Appointment } from "@workspace/db";
import { randomUUID } from "crypto";

export interface AppointmentFilters {
  date?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class AppointmentService {
  static async listAppointments(clinicId: string, filters: AppointmentFilters) {
    const { date, status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions = [eq(appointmentsTable.clinicId, clinicId)];
    if (date) conditions.push(eq(appointmentsTable.date, date));
    if (status) conditions.push(eq(appointmentsTable.status, status));

    const whereClause = and(...conditions)!;

    // 1. Get total count for pagination
    const [countResult] = await db
      .select({ value: count() })
      .from(appointmentsTable)
      .where(whereClause);
    
    const total = countResult.value;

    // 2. Optimized join to get appointments and patient visit types in one query
    const data = await db
      .select({
        appointment: appointmentsTable,
        patientVisitType: patientsTable.visitType,
      })
      .from(appointmentsTable)
      .leftJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${appointmentsTable.date} DESC, ${appointmentsTable.time} DESC`);

    return {
      data: data.map(({ appointment, patientVisitType }: { appointment: Appointment; patientVisitType: string | null }) => 
        this.serialize(appointment, patientVisitType)
      ),
      total,
      page,
      limit,
    };
  }

  static async createAppointment(clinicId: string, data: {
    patientId: string;
    date: Date | string;
    time: string;
    type: string;
    notes?: string | null;
    fee?: number | null;
  }) {
    return await db.transaction(async (tx: any) => {
      // Get patient details within transaction
      const [patient] = await tx
        .select()
        .from(patientsTable)
        .where(and(eq(patientsTable.id, data.patientId), eq(patientsTable.clinicId, clinicId)))
        .limit(1);

      if (!patient) throw new Error("Patient not found");

      const id = randomUUID();
      const dateStr = data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date;

      await tx.insert(appointmentsTable).values({
        id,
        clinicId,
        patientId: data.patientId,
        patientName: patient.name,
        date: dateStr,
        time: data.time,
        type: data.type,
        notes: data.notes ?? null,
        fee: data.fee?.toString() ?? null,
        status: "scheduled",
      });

      const [newAppt] = await tx
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, id))
        .limit(1);

      return this.serialize(newAppt, patient.visitType ?? null);
    });
  }

  static async updateAppointment(clinicId: string, appointmentId: string, updates: Partial<{
    status: string;
    date: Date | string;
    time: string;
    notes: string | null;
    fee: number | null;
  }>) {
    return await db.transaction(async (tx: any) => {
      const dbUpdates: Record<string, any> = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.date !== undefined) {
        dbUpdates.date = updates.date instanceof Date ? updates.date.toISOString().split('T')[0] : updates.date;
      }
      if (updates.time !== undefined) dbUpdates.time = updates.time;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.fee !== undefined) dbUpdates.fee = updates.fee?.toString() ?? null;

      await tx
        .update(appointmentsTable)
        .set(dbUpdates)
        .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId)));

      const [appt] = await tx
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, appointmentId))
        .limit(1);

      if (!appt) throw new Error("Appointment not found");

      const [patient] = await tx
        .select({ visitType: patientsTable.visitType })
        .from(patientsTable)
        .where(eq(patientsTable.id, appt.patientId))
        .limit(1);

      return this.serialize(appt, patient?.visitType ?? null);
    });
  }

  static async deleteAppointment(clinicId: string, appointmentId: string) {
    await db
      .delete(appointmentsTable)
      .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId)));
  }

  private static serialize(a: Appointment, patientVisitType: string | null) {
    return {
      id: a.id,
      clinicId: a.clinicId,
      patientId: a.patientId,
      patientName: a.patientName,
      patientVisitType,
      date: a.date,
      time: a.time,
      status: a.status,
      type: a.type,
      notes: a.notes,
      fee: a.fee ? parseFloat(a.fee) : null,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
