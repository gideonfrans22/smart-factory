import { Router } from "express";
import { deviceTypeController } from "./device-type.controller";
import { authenticateToken } from "@shared/middleware";
import {
  deviceTypeCreateSchema,
  deviceTypeIdParamSchema,
  deviceTypeUpdateSchema
} from "./device-type.validators";
import { validate } from "@shared/middleware/validate";

const router = Router();

router.use(authenticateToken);

router.get("/", deviceTypeController.list);

router.get(
  "/:id",
  validate(deviceTypeIdParamSchema, "params"),
  deviceTypeController.getById
);

router.get(
  "/:id/devices",
  validate(deviceTypeIdParamSchema, "params"),
  deviceTypeController.getDevicesByType
);

router.get(
  "/:id/devices/available",
  validate(deviceTypeIdParamSchema, "params"),
  deviceTypeController.getAvailableDevicesByType
);

router.post(
  "/",
  validate(deviceTypeCreateSchema),
  deviceTypeController.create
);

router.put(
  "/:id",
  validate(deviceTypeIdParamSchema, "params"),
  validate(deviceTypeUpdateSchema),
  deviceTypeController.update
);

router.delete(
  "/:id",
  validate(deviceTypeIdParamSchema, "params"),
  deviceTypeController.remove
);

export default router;

