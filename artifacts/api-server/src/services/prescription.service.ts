import { eq, and, desc, or, ilike, SQL, sql } from "drizzle-orm";
import { db, prescriptionsTable, patientsTable, usersTable, Prescription } from "@workspace/db";
import { randomUUID } from "crypto";

export interface PrescriptionFilters {
  patientId?: string;
  search?: string;
}

export class PrescriptionService {
  static async listPrescriptions(clinicId: string, filters: PrescriptionFilters) {
    const { patientId, search } = filters;

    const conditions: SQL[] = [eq(prescriptionsTable.clinicId, clinicId)];
    if (patientId) {
      conditions.push(eq(prescriptionsTable.patientId, patientId));
    }

    const whereClause = and(...conditions)!;

    // Optimized query with joins to get patient and doctor info in one go
    const query = db
      .select({
        prescription: prescriptionsTable,
        patientName: patientsTable.name,
        patientPhone: patientsTable.phone,
        patientCode: patientsTable.code,
        doctorSpecialty: usersTable.specialty,
      })
      .from(prescriptionsTable)
      .leftJoin(patientsTable, eq(prescriptionsTable.patientId, patientsTable.id))
      .leftJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(prescriptionsTable.createdAt));

    const rows = await query;

    let data = rows.map(row => this.serialize(
      row.prescription, 
      row.patientName ?? "", 
      row.patientPhone ?? "", 
      row.patientCode ?? null, 
      row.doctorSpecialty ?? null
    ));

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.patientName.toLowerCase().includes(s) ||
          (p.diagnosis ?? "").toLowerCase().includes(s) ||
          p.items.some((i: any) => i.drug.toLowerCase().includes(s))
      );
    }

    return { data, total: data.length };
  }

  static async getPrescription(clinicId: string, prescriptionId: string) {
    const [row] = await db
      .select({
        prescription: prescriptionsTable,
        patientName: patientsTable.name,
        patientPhone: patientsTable.phone,
        patientCode: patientsTable.code,
        doctorSpecialty: usersTable.specialty,
      })
      .from(prescriptionsTable)
      .leftJoin(patientsTable, eq(prescriptionsTable.patientId, patientsTable.id))
      .leftJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
      .where(and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId)))
      .limit(1);

    if (!row) throw new Error("Prescription not found");

    return this.serialize(
      row.prescription, 
      row.patientName ?? "", 
      row.patientPhone ?? "", 
      row.patientCode ?? null, 
      row.doctorSpecialty ?? null
    );
  }

  static async createPrescription(clinicId: string, doctor: { id: string, name: string }, data: any) {
    return await db.transaction(async (tx: any) => {
      const [patient] = await tx
        .select()
        .from(patientsTable)
        .where(and(eq(patientsTable.id, data.patientId), eq(patientsTable.clinicId, clinicId)))
        .limit(1);

      if (!patient) throw new Error("Patient not found");

      const id = randomUUID();
      await tx.insert(prescriptionsTable).values({
        id,
        clinicId,
        patientId: data.patientId,
        doctorId: doctor.id,
        doctorName: doctor.name,
        date: data.date,
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ?? null,
        items: data.items.map((i: any) => ({
          drug: i.drug,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.duration,
          notes: i.notes ?? null,
        })),
      });

      return this.getPrescription(clinicId, id);
    });
  }

  static async deletePrescription(clinicId: string, prescriptionId: string) {
    await db
      .delete(prescriptionsTable)
      .where(and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId)));
  }

  private static serialize(
    row: Prescription, 
    patientName: string, 
    patientPhone: string, 
    patientCode: string | null, 
    doctorSpecialty: string | null
  ) {
    return {
      id: row.id,
      clinicId: row.clinicId,
      patientId: row.patientId,
      patientName,
      patientPhone,
      patientCode,
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      doctorSpecialty,
      date: row.date,
      diagnosis: row.diagnosis,
      notes: row.notes,
      items: row.items ?? [],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
