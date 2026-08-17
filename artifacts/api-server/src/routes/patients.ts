import { Router } from "express";
import { z } from "zod";
import { CreatePatientBody, PatchPatientBody } from "@workspace/api-zod";
import { requireClinicAccess, requireRole } from "../middlewares/auth";
import { PatientService } from "../services/patient.service";

const router = Router({ mergeParams: true });
router.use(requireClinicAccess);

router.get("/", async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    const filters = {
      search: req.query.search as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await PatientService.listPatients(clinicId, filters);
    const isAssistant = ["assistant", "secretary", "nurse"].includes(req.authUser?.role);
    if (isAssistant) {
      result.data = result.data.map((patient: any) => ({
        ...patient,
        diagnosis: null,
        clinicalNotes: null,
        chronicConditions: null,
      }));
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: any, res) => {
  const { clinicId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    });
  }

  try {
    const patient = await PatientService.createPatient(clinicId, parsed.data);
    return res.status(201).json(patient);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

const RegisterAndQueueBody = z.object({
  patientId: z.string().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  age: z.number().int().min(0).max(149).optional(),
  bloodType: z.string().nullish(),
  allergies: z.string().nullish(),
  notes: z.string().nullish(),
  visitType: z.enum(["New Consultation", "Follow-up", "Re-exam", "Emergency"]),
  doctorId: z.string().nullish(),
  cashCollected: z.boolean().default(true),
  collectedAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(["free", "unpaid"]).optional(),
  paymentReference: z.string().max(120).nullish(),
});

router.post("/register-and-queue", async (req: any, res) => {
  const parsed = RegisterAndQueueBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid queue registration", details: parsed.error.issues });
  }
  if (!parsed.data.patientId && (!parsed.data.name || !parsed.data.phone || parsed.data.age === undefined)) {
    return res.status(400).json({ error: "Name, phone, and age are required for a new patient" });
  }

  try {
    const patient = await PatientService.registerAndQueuePatient(req.params.clinicId, {
      id: req.authUser?.id,
      role: req.authUser?.role,
    }, parsed.data);
    return res.status(201).json(patient);
  } catch (error: any) {
    if (error.message === "Only a reception supervisor or administrator can register an unpaid visit") {
      return res.status(403).json({ error: error.message });
    }
    if (["Patient not found", "Patient is already in the queue"].includes(error.message)) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

const BulkCheckInBody = z.object({
  patientIds: z.array(z.string().min(1)).min(1).max(100),
  visitType: z.enum(["New Consultation", "Follow-up", "Re-exam", "Emergency"]),
});

router.post("/bulk-check-in", async (req: any, res) => {
  const parsed = BulkCheckInBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid bulk check-in request", details: parsed.error.issues });
  }

  const patientIds: string[] = Array.from(new Set(parsed.data.patientIds));
  try {
    const result = await PatientService.bulkCheckInPatients(req.params.clinicId, patientIds, parsed.data.visitType);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/:patientId", async (req: any, res) => {
  try {
    const { clinicId, patientId } = req.params;
    const patient = await PatientService.getPatient(clinicId, patientId);
    const isAssistant = ["assistant", "secretary", "nurse"].includes(req.authUser?.role);
    return res.json(isAssistant
      ? { ...patient, diagnosis: null, clinicalNotes: null, chronicConditions: null }
      : patient);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.put("/:patientId", requireRole("admin", "doctor", "superadmin"), async (req: any, res) => {
  const { clinicId, patientId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const patient = await PatientService.updatePatient(clinicId, patientId, parsed.data);
    return res.json(patient);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/:patientId", async (req: any, res) => {
  const { clinicId, patientId } = req.params;
  const parsed = PatchPatientBody.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    });
  }

  const isAssistant = ["assistant", "secretary", "nurse"].includes(req.authUser?.role);
  if (parsed.data.status === "paid" && !parsed.data.paymentMethod) {
    return res.status(400).json({ error: "Payment method is required before marking a patient paid" });
  }
  const clinicalFields = ["diagnosis", "clinicalNotes", "chronicConditions"];
  if (isAssistant && Object.keys(parsed.data).some((field) =>
    clinicalFields.includes(field) || ["in-progress", "completed"].includes((parsed.data as any).status)
  )) {
    return res.status(403).json({ error: "Clinical updates require a Doctor" });
  }

  try {
    const patient = await PatientService.updatePatient(clinicId, patientId, parsed.data);
    return res.json(patient);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Payment is required before check-in" || error.message === "A payment method is required before marking a patient paid") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/:patientId", async (req: any, res) => {
  try {
    const { clinicId, patientId } = req.params;
    await PatientService.deletePatient(clinicId, patientId);
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
