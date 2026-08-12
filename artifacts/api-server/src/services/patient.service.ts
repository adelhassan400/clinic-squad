import { eq, and, or, ilike, count, sql, SQL } from "drizzle-orm";
import { db, patientsTable, Patient } from "@workspace/db";
import { randomUUID } from "crypto";

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

  static async updatePatient(clinicId: string, patientId: string, updates: any) {
    const dbUpdates: Record<string, any> = {};
    
    // Explicitly handle fields that might be null/undefined
    const fields = [
      'name', 'phone', 'age', 'dateOfBirth', 'bloodType', 
      'allergies', 'notes', 'visitType', 'status', 
      'diagnosis', 'clinicalNotes', 'chronicConditions'
    ];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        dbUpdates[field] = updates[field] ?? null;
      }
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
