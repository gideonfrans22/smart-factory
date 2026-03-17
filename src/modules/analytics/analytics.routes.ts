import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";

const router = Router();

router.get("/workers", authenticateToken, requireAdmin, (req, res) =>
  analyticsController.getWorkerPerformance(req, res)
);

export default router;
