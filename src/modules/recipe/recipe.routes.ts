import { Router } from "express";
import { recipeController } from "./recipe.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", recipeController.list);
router.get("/:id", recipeController.getById);
router.post("/", recipeController.create);
router.put("/:id", recipeController.update);
router.delete("/:id", recipeController.remove);
export default router;
/**
 * Mount in app:
 *   import recipeRoutes from "./modules/recipe/recipe.routes";
 *   app.use("/api/recipe", recipeRoutes);
 */
