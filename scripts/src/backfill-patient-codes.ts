import { db, patientsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

async function main() {
  const all = await db.select().from(patientsTable).orderBy(asc(patientsTable.createdAt));
  const byClinic = new Map<string, typeof all>();
  for (const p of all) {
    if (!byClinic.has(p.clinicId)) byClinic.set(p.clinicId, []);
    byClinic.get(p.clinicId)!.push(p);
  }

  let updated = 0;
  for (const [clinicId, list] of byClinic) {
    let max = 0;
    for (const p of list) {
      const m = p.code?.match(/^PT-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    for (const p of list) {
      if (p.code) continue;
      max += 1;
      const code = `PT-${String(max).padStart(4, "0")}`;
      await db.update(patientsTable).set({ code }).where(eq(patientsTable.id, p.id));
      updated += 1;
      console.log(`  ${clinicId}  ${p.id.slice(0, 8)}…  ${p.name}  →  ${code}`);
    }
  }
  console.log(`\nBackfilled ${updated} patient code(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
