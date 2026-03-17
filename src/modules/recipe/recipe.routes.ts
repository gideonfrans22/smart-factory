import { Router } from "express";
  import { recipeController } from "./recipe.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => recipeController.list(req, res, next));
  router.get("/:id", (req, res, next) => recipeController.getById(req, res, next));
  router.post("/", (req, res, next) => recipeController.create(req, res, next));
  router.put("/:id", (req, res, next) => recipeController.update(req, res, next));
  router.delete("/:id", (req, res, next) => recipeController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import recipeRoutes from "./modules/recipe/recipe.routes";
   *   app.use("/api/recipe", recipeRoutes);
   */
  