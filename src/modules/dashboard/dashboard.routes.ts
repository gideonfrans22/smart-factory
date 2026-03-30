import { Router } from "express";
import { dashboardController } from "./dashboard.controller";

const router = Router();

router.get("/monitor-overview", (req, res) =>
  dashboardController.getMonitorOverview(req, res)
);

router.get("/task-status-distribution", (req, res) =>
  dashboardController.getTaskStatusDistribution(req, res)
);

router.get("/monitor-tasks", (req, res) =>
  dashboardController.getMonitorTasks(req, res)
);

export default router;
