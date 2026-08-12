import { Router } from "express";
import { CreatePatientBody, PatchPatientBody } from "@workspace/api-zod";
import { requireClinicAccess } from "../middlewares/auth";
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

router.get("/:patientId", async (req: any, res) => {
  try {
    const { clinicId, patientId } = req.params;
    const patient = await PatientService.getPatient(clinicId, patientId);
    return res.json(patient);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.put("/:patientId", async (req: any, res) => {
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
