import { Router } from "express";
import { rawMaterialController } from "./raw-material.controller";
import { authenticateToken } from "@shared/middleware";
import {
  rawMaterialCreateSchema,
  rawMaterialIdParamSchema,
  rawMaterialListQuerySchema,
  rawMaterialUpdateSchema
} from "./raw-material.validators";
import { validate } from "@shared/middleware/validate";

const router = Router();

router.use(authenticateToken);

router.get("/import/template", rawMaterialController.downloadTemplate);

router.post("/import/verify", rawMaterialController.verifyImport);

router.post("/import", rawMaterialController.import);

router.get(
  "/",
  validate(rawMaterialListQuerySchema, "query"),
  rawMaterialController.list
);

router.get(
  "/:id",
  validate(rawMaterialIdParamSchema, "params"),
  rawMaterialController.getById
);

router.post(
  "/",
  validate(rawMaterialCreateSchema),
  rawMaterialController.create
);

router.put(
  "/:id",
  validate(rawMaterialIdParamSchema, "params"),
  validate(rawMaterialUpdateSchema),
  rawMaterialController.update
);

router.delete(
  "/:id",
  validate(rawMaterialIdParamSchema, "params"),
  rawMaterialController.remove
);

export default router;
