import { Router } from "express";
import {
  getRecipes,
  getRecipeById,
  getRecipeByRecipeNumber,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  createRecipeVersion,
  getRecipeDependencyGraph
} from "../controllers/recipeController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// All recipe routes require authentication
router.use(authenticateToken);

// Get all recipes (paginated)
router.get("/", getRecipes);

// Get recipe by recipe number (latest or specific version)
router.get("/number/:recipeNumber", getRecipeByRecipeNumber);

// Get recipe by ID
router.get("/:id", getRecipeById);

// Get recipe dependency graph
router.get("/:id/dependency-graph", getRecipeDependencyGraph);

// Create new recipe
router.post("/", createRecipe);

// Update recipe
router.put("/:id", updateRecipe);

// Delete recipe
router.delete("/:id", deleteRecipe);

// Create new version of recipe
router.post("/:id/version", createRecipeVersion);

export default router;
