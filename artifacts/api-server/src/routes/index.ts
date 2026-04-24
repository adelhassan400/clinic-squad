import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clinicsRouter from "./clinics";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import financesRouter from "./finances";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clinics", clinicsRouter);
router.use("/clinics/:clinicId/patients", patientsRouter);
router.use("/clinics/:clinicId/appointments", appointmentsRouter);
router.use("/clinics/:clinicId/finances", financesRouter);
router.use("/admin", adminRouter);

export default router;
