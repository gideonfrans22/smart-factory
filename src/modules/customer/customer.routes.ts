import { Router } from "express";
import { customerController } from "./customer.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import {
  customerCreateSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  customerUpdateSchema
} from "./customer.validators";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get(
  "/",
  validate(customerListQuerySchema, "query"),
  customerController.list
);

router.get(
  "/:id",
  validate(customerIdParamSchema, "params"),
  customerController.getById
);

router.post(
  "/",
  validate(customerCreateSchema),
  customerController.create
);

router.put(
  "/:id",
  validate(customerIdParamSchema, "params"),
  validate(customerUpdateSchema),
  customerController.update
);

router.delete(
  "/:id",
  validate(customerIdParamSchema, "params"),
  customerController.remove
);

export default router;

