import { Router } from "express";
import { getRealtimeKPI, createKPIData } from "../controllers/kpiController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/kpi/realtime
 * @desc Get real-time KPI data
 * @access Authenticated users
 */
router.get("/realtime", authenticateToken, getRealtimeKPI);

/**
 * @route POST /api/kpi
 * @desc Create KPI data point
 * @access Authenticated users
 */
router.post("/", authenticateToken, createKPIData);

export default router;
