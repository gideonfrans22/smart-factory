import { Router } from "express";
import { deviceController } from "./device.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";

const router = Router();

router.get("/", deviceController.list);

router.get("/statistics", authenticateToken, requireAdmin, deviceController.getStatistics);

router.get("/by-task", authenticateToken, requireAdmin, deviceController.getDevicesByTask);

router.get("/:id", authenticateToken, deviceController.getById);

router.post("/register", authenticateToken, requireAdmin, deviceController.create);

router.put("/:id", authenticateToken, deviceController.update);

router.delete("/:id", authenticateToken, requireAdmin, deviceController.remove);

router.get("/monitor-layout/:id", authenticateToken, deviceController.getMonitorData);

router.post("/:id/worker-login", authenticateToken, deviceController.workerLogin);

router.post("/:id/worker-logout", authenticateToken, deviceController.workerLogout);

router.get("/:id/availability", deviceController.checkAvailability);

export default router;
