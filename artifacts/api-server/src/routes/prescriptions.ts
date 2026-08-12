import { Router } from "express";
import { CreatePrescriptionBody } from "@workspace/api-zod";
import { requireClinicAccess, requireRole } from "../middlewares/auth";
import { PrescriptionService } from "../services/prescription.service";

const router = Router({ mergeParams: true });
router.use(requireClinicAccess);

router.get("/", async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const filters = {
      patientId: req.query.patientId as string,
      search: req.query.search as string,
    };

    const result = await PrescriptionService.listPrescriptions(clinicId, filters);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/", requireRole("admin", "superadmin"), async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = CreatePrescriptionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    }

    const doctor = {
      id: req.authUser!.id,
      name: req.authUser!.name,
    };

    const prescription = await PrescriptionService.createPrescription(clinicId, doctor, parsed.data);
    return res.status(201).json(prescription);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get("/:prescriptionId", async (req: any, res) => {
  try {
    const { clinicId, prescriptionId } = req.params;
    if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const prescription = await PrescriptionService.getPrescription(clinicId, prescriptionId);
    return res.json(prescription);
  } catch (error: any) {
    if (error.message === "Prescription not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/:prescriptionId", requireRole("admin", "superadmin"), async (req: any, res) => {
  try {
    const { clinicId, prescriptionId } = req.params;
    if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await PrescriptionService.deletePrescription(clinicId, prescriptionId);
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
