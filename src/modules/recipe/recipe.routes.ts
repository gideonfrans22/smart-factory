import { Router } from "express";
import { authenticateToken } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import { recipeController } from "./recipe.controller";
import {
  recipeByNumberQuerySchema,
  recipeCreateSchema,
  recipeCreateVersionSchema,
  recipeIdParamSchema,
  recipeListQuerySchema,
  recipeNumberParamSchema,
  recipeUpdateSchema
} from "./recipe.validators";

const router = Router();

router.use(authenticateToken);

router.get("/", validate(recipeListQuerySchema, "query"), recipeController.list);

router.get(
  "/number/:recipeNumber",
  validate(recipeNumberParamSchema, "params"),
  validate(recipeByNumberQuerySchema, "query"),
  recipeController.getByRecipeNumber
);

router.get(
  "/:id/dependency-graph",
  validate(recipeIdParamSchema, "params"),
  recipeController.getDependencyGraph
);

router.get(
  "/:id",
  validate(recipeIdParamSchema, "params"),
  recipeController.getById
);

router.post("/", validate(recipeCreateSchema), recipeController.create);

router.put(
  "/:id",
  validate(recipeIdParamSchema, "params"),
  validate(recipeUpdateSchema),
  recipeController.update
);

router.delete(
  "/:id",
  validate(recipeIdParamSchema, "params"),
  recipeController.remove
);

router.post(
  "/:id/version",
  validate(recipeIdParamSchema, "params"),
  validate(recipeCreateVersionSchema),
  recipeController.createVersion
);

export default router;
