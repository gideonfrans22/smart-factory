import { Router } from "express";
import { gridLayoutController } from "./grid-layout.controller";
import { authenticateToken } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import {
  gridLayoutListQuerySchema,
  gridLayoutCreateSchema,
  gridLayoutUpdateSchema,
  gridLayoutIdParamSchema,
  deviceIdParamSchema,
  bulkDeviceUpdateSchema,
  devicePositionUpdateSchema
} from "./grid-layout.validators";

const router = Router();

router.use(authenticateToken);

router.get(
  "/",
  validate(gridLayoutListQuerySchema, "query"),
  gridLayoutController.list
);

router.get(
  "/:id",
  validate(gridLayoutIdParamSchema, "params"),
  gridLayoutController.getById
);

router.post(
  "/",
  validate(gridLayoutCreateSchema),
  gridLayoutController.create
);

router.patch(
  "/:id",
  validate(gridLayoutIdParamSchema, "params"),
  validate(gridLayoutUpdateSchema),
  gridLayoutController.update
);

router.patch(
  "/:id/devices/:deviceId",
  validate(deviceIdParamSchema, "params"),
  validate(devicePositionUpdateSchema),
  gridLayoutController.updateDevicePosition
);

router.patch(
  "/:id/devices",
  validate(gridLayoutIdParamSchema, "params"),
  validate(bulkDeviceUpdateSchema),
  gridLayoutController.bulkUpdateDevicePositions
);

router.delete(
  "/:id",
  validate(gridLayoutIdParamSchema, "params"),
  gridLayoutController.remove
);

export default router;
