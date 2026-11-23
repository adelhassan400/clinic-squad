import { Router } from "express";

const router = Router();
const unavailable = (_req: import("express").Request, res: import("express").Response) =>
  res.status(503).json({
    error: "Staff invitation acceptance is temporarily paused until email verification is available. No account has been created.",
    code: "INVITATION_ACCEPTANCE_PAUSED",
  });

// Do not consume invitations, create users or issue sessions while delivery is unavailable.
router.get("/:token", unavailable);
router.post("/:token/accept", unavailable);

export default router;
