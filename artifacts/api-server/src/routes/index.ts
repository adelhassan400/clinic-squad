import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clinicsRouter from "./clinics";
import patientsRouter from "./patients";
import labResultsRouter from "./lab-results";
import appointmentsRouter from "./appointments";
import financesRouter from "./finances";
import prescriptionsRouter from "./prescriptions";
import adminRouter from "./admin";
import teamRouter from "./team";
import invitationsRouter from "./invitations";

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
router.use("/clinics/:clinicId/prescriptions", prescriptionsRouter);
router.use("/admin", adminRouter);

export default router;
