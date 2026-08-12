import { Router } from "express";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { requireClinicAccess } from "../middlewares/auth";
import { AppointmentService } from "../services/appointment.service";

const router = Router({ mergeParams: true });
router.use(requireClinicAccess);

router.get("/", async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    const filters = {
      date: req.query.date as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await AppointmentService.listAppointments(clinicId, filters);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: any, res) => {
  const { clinicId } = req.params;
  const parsed = CreateAppointmentBody.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ 
      error: "Invalid input", 
      details: parsed.error.issues 
    });
  }

  try {
    const appointment = await AppointmentService.createAppointment(clinicId, parsed.data as any);
    return res.status(201).json(appointment);
  } catch (error: any) {
    if (error.message === "Patient not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.put("/:appointmentId", async (req: any, res) => {
  const { clinicId, appointmentId } = req.params;
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const appointment = await AppointmentService.updateAppointment(clinicId, appointmentId, parsed.data as any);
    return res.json(appointment);
  } catch (error: any) {
    if (error.message === "Appointment not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/:appointmentId", async (req: any, res) => {
  try {
    const { clinicId, appointmentId } = req.params;
    await AppointmentService.deleteAppointment(clinicId, appointmentId);
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
