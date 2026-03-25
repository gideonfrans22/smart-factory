import { Router } from "express";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  startTask,
  resumeTask,
  pauseTask,
  failTask,
  completeTask,
  getStandaloneTasks,
  getTaskStatistics,
  getGroupedTasks,
  getWorkerTasks,
  getDeviceTasks,
  batchUpdateTasks
} from "./task.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";

const router = Router();

router.get("/", authenticateToken, getTasks);
router.get("/statistics", authenticateToken, getTaskStatistics);
router.get("/grouped", authenticateToken, getGroupedTasks);
router.get("/standalone", authenticateToken, getStandaloneTasks);
router.get("/:id", authenticateToken, getTaskById);

router.post("/", authenticateToken, requireAdmin, createTask);
router.post("/:id/start", authenticateToken, startTask);
router.post("/:id/resume", authenticateToken, resumeTask);
router.post("/:id/pause", authenticateToken, pauseTask);
router.post("/:id/complete", authenticateToken, completeTask);
router.post("/:id/fail", authenticateToken, failTask);
router.post("/:id/status", authenticateToken, updateTaskStatus);

router.patch("/batch", authenticateToken, batchUpdateTasks);
router.patch("/:id", authenticateToken, updateTask);

router.delete("/:id", authenticateToken, requireAdmin, deleteTask);

router.get("/device/:deviceId", getDeviceTasks);
router.get("/worker/:workerId", getWorkerTasks);

export default router;
