import { Router } from "express";
import { rawMaterialTypeController } from "./raw-material-type.controller";
import { authenticateToken } from "@shared/middleware";
import {
  rawMaterialTypeCreateSchema,
  rawMaterialTypeIdParamSchema,
  rawMaterialTypeListQuerySchema,
  rawMaterialTypeUpdateSchema
} from "./raw-material-type.validators";
import { validate } from "@shared/middleware/validate";

const router = Router();

router.use(authenticateToken);

router.get(
  "/",
  validate(rawMaterialTypeListQuerySchema, "query"),
  rawMaterialTypeController.list.bind(rawMaterialTypeController)
);

router.get(
  "/:id",
  validate(rawMaterialTypeIdParamSchema, "params"),
  rawMaterialTypeController.getById.bind(rawMaterialTypeController)
);

router.post(
  "/",
  validate(rawMaterialTypeCreateSchema),
  rawMaterialTypeController.create.bind(rawMaterialTypeController)
);

router.put(
  "/:id",
  validate(rawMaterialTypeIdParamSchema, "params"),
  validate(rawMaterialTypeUpdateSchema),
  rawMaterialTypeController.update.bind(rawMaterialTypeController)
);

router.delete(
  "/:id",
  validate(rawMaterialTypeIdParamSchema, "params"),
  rawMaterialTypeController.remove.bind(rawMaterialTypeController)
);

export default router;
