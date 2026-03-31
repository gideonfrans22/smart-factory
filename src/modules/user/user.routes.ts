import { authenticateToken, requireAdmin, validate } from "@shared/middleware";
import { Router } from "express";
import { userController } from "./user.controller";
import { userCreateSchema, userUpdateSchema } from "./user.validators";

const router = Router();

router.get(
  "/statistics",
  authenticateToken,
  requireAdmin,
  userController.getStatistics
);

router.get("/", authenticateToken, requireAdmin, userController.list);
// Temporarily remove authentication for workers list
router.get("/workers", userController.listWorkers);

router.get("/:id", authenticateToken, requireAdmin, userController.getById);

router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validate(userCreateSchema),
  userController.create
);

router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(userUpdateSchema),
  userController.update
);

router.delete("/:id", authenticateToken, requireAdmin, userController.remove);

export default router;
