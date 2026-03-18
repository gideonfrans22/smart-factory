import { Router } from "express";
import { alertController } from "./alert.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import {
  alertBulkIdsSchema,
  alertCreateSchema,
  alertIdParamSchema,
  alertListQuerySchema,
  alertResolveEmergencyBodySchema
} from "./alert.validators";

const router = Router();

router.use(authenticateToken);

router.get("/stats", alertController.stats);

router.get(
  "/",
  validate(alertListQuerySchema, "query"),
  alertController.list
);

router.get(
  "/:id",
  validate(alertIdParamSchema, "params"),
  alertController.getById
);

router.post("/", validate(alertCreateSchema), alertController.create);

router.post(
  "/bulk-read",
  validate(alertBulkIdsSchema),
  alertController.bulkRead
);

router.post(
  "/bulk-acknowledge",
  validate(alertBulkIdsSchema),
  alertController.bulkAcknowledge
);

router.post(
  "/bulk-resolve",
  validate(alertBulkIdsSchema),
  alertController.bulkResolve
);

router.patch(
  "/:id/read",
  validate(alertIdParamSchema, "params"),
  alertController.read
);

router.patch(
  "/:id/acknowledge",
  validate(alertIdParamSchema, "params"),
  alertController.acknowledge
);

router.patch(
  "/:id/resolve",
  validate(alertIdParamSchema, "params"),
  alertController.resolve
);

router.put(
  "/:id/resolve-emergency",
  validate(alertIdParamSchema, "params"),
  validate(alertResolveEmergencyBodySchema),
  alertController.resolveEmergency
);

router.delete(
  "/:id",
  validate(alertIdParamSchema, "params"),
  requireAdmin,
  alertController.delete
);

export default router;

