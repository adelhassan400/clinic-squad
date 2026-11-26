import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import clinicsRouter from "./clinics.js";
import patientsRouter from "./patients.js";
import labResultsRouter from "./lab-results.js";
import appointmentsRouter from "./appointments.js";
import financesRouter from "./finances.js";
import cashTransactionsRouter from "./cash-transactions.js";
import prescriptionsRouter from "./prescriptions.js";
import visitRecordsRouter from "./visit-records.js";
import prescriptionTemplatesRouter from "./prescription-templates.js";
import adminRouter from "./admin.js";
import teamRouter from "./team.js";
import invitationsRouter from "./invitations.js";
import adminToolsRouter from "./admin-tools.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/invitations", invitationsRouter);
router.use("/clinics/:clinicId/team", teamRouter);
router.use("/clinics", clinicsRouter);
router.use("/clinics/:clinicId/patients/:patientId/lab-results", labResultsRouter);
router.use("/clinics/:clinicId/patients", patientsRouter);
router.use("/clinics/:clinicId/appointments", appointmentsRouter);
router.use("/clinics/:clinicId/finances", financesRouter);
router.use("/clinics/:clinicId/cash-transactions", cashTransactionsRouter);
router.use("/clinics/:clinicId/prescriptions", prescriptionsRouter);
router.use("/clinics/:clinicId/visit-records", visitRecordsRouter);
router.use("/clinics/:clinicId/prescription-templates", prescriptionTemplatesRouter);
router.use("/admin", adminRouter);
router.use("/platform", adminToolsRouter);

export default router;
