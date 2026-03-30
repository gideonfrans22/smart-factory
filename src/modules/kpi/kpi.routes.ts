import { Router } from "express";
import { authenticateToken } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import { kpiController } from "./kpi.controller";
import { kpiCreateSchema } from "./kpi.validators";

const router = Router();

router.get("/realtime", authenticateToken, (req, res) =>
  kpiController.getRealtime(req, res)
);

router.post(
  "/",
  authenticateToken,
  validate(kpiCreateSchema),
  (req, res) => kpiController.create(req, res)
);

export default router;
