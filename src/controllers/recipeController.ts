import { Request, Response } from "express";
import { Recipe } from "../models";
import { APIResponse } from "../types";

/**
 * Get all recipes with pagination and filtering
 */
export const getRecipes = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, productCode, search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    if (productCode) {
      query.productCode = productCode;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { productCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const [recipes, total] = await Promise.all([
      Recipe.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Recipe.countDocuments(query)
    ]);

    const response: APIResponse = {
      success: true,
      message: "Recipes retrieved successfully",
      data: {
        items: recipes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error("Get recipes error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Get recipe by ID
 */
export const getRecipeById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findById(id);

    if (!recipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Recipe retrieved successfully",
      data: recipe
    };
    res.json(response);
  } catch (error: any) {
    console.error("Get recipe error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Get recipe by product code and version
 */
export const getRecipeByProductCode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productCode } = req.params;
    const { version } = req.query;

    const query: any = { productCode: productCode.toUpperCase() };
    if (version) {
      query.version = parseInt(version as string);
    }

    // If version not specified, get the latest version
    const recipe = await Recipe.findOne(query).sort({ version: -1 });

    if (!recipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Recipe retrieved successfully",
      data: recipe
    };
    res.json(response);
  } catch (error: any) {
    console.error("Get recipe by product code error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Create new recipe
 */
export const createRecipe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productCode, version, name, description, steps } = req.body;

    // Validate required fields
    if (!productCode || !name || !steps || steps.length === 0) {
      const errorResponse: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Product code, name, and at least one step are required"
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Check for duplicate product code and version
    const existingRecipe = await Recipe.findOne({
      productCode: productCode.toUpperCase(),
      version: version || 1
    });

    if (existingRecipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: "Recipe with this product code and version already exists"
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Validate and assign stepIds if not provided
    const processedSteps = steps.map((step: any, index: number) => ({
      stepId: step.stepId || `STEP_${index + 1}`,
      order: step.order || index + 1,
      name: step.name,
      description: step.description,
      estimatedDuration: step.estimatedDuration,
      requiredDevices: step.requiredDevices || [],
      qualityChecks: step.qualityChecks || [],
      dependsOn: step.dependsOn || [],
      media: step.media || []
    }));

    const recipe = new Recipe({
      productCode: productCode.toUpperCase(),
      version: version || 1,
      name,
      description,
      steps: processedSteps,
      estimatedDuration: 0 // Will be calculated by pre-save hook
    });

    await recipe.save();

    const response: APIResponse = {
      success: true,
      message: "Recipe created successfully",
      data: recipe
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create recipe error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Update recipe
 */
export const updateRecipe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, steps } = req.body;

    const recipe = await Recipe.findById(id);

    if (!recipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Update fields
    if (name) recipe.name = name;
    if (description !== undefined) recipe.description = description;
    if (steps && steps.length > 0) {
      recipe.steps = steps;
    }

    await recipe.save();

    const response: APIResponse = {
      success: true,
      message: "Recipe updated successfully",
      data: recipe
    };
    res.json(response);
  } catch (error: any) {
    console.error("Update recipe error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Delete recipe
 */
export const deleteRecipe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findByIdAndDelete(id);

    if (!recipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Recipe deleted successfully",
      data: null
    };
    res.json(response);
  } catch (error: any) {
    console.error("Delete recipe error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Create new version of recipe
 */
export const createRecipeVersion = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, steps } = req.body;

    const existingRecipe = await Recipe.findById(id);

    if (!existingRecipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Get the highest version for this product code
    const highestVersion = await Recipe.findOne({
      productCode: existingRecipe.productCode
    }).sort({ version: -1 });

    const newVersion = (highestVersion?.version || 0) + 1;

    const newRecipe = new Recipe({
      productCode: existingRecipe.productCode,
      version: newVersion,
      name: name || existingRecipe.name,
      description: description || existingRecipe.description,
      steps: steps || existingRecipe.steps,
      estimatedDuration: 0 // Will be calculated by pre-save hook
    });

    await newRecipe.save();

    const response: APIResponse = {
      success: true,
      message: "New recipe version created successfully",
      data: newRecipe
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create recipe version error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Get dependency graph for a recipe
 * Returns topological order of steps based on dependencies
 */
export const getRecipeDependencyGraph = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findById(id);

    if (!recipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found"
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Build dependency graph
    const graph: any = {};
    const inDegree: any = {};
    const stepMap: any = {};

    // Initialize
    recipe.steps.forEach((step) => {
      graph[step.stepId] = step.dependsOn || [];
      inDegree[step.stepId] = 0;
      stepMap[step.stepId] = step;
    });

    // Calculate in-degrees
    recipe.steps.forEach((step) => {
      (step.dependsOn || []).forEach(() => {
        inDegree[step.stepId]++;
      });
    });

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const topologicalOrder: any[] = [];

    // Add all nodes with in-degree 0
    Object.keys(inDegree).forEach((stepId) => {
      if (inDegree[stepId] === 0) {
        queue.push(stepId);
      }
    });

    while (queue.length > 0) {
      const stepId = queue.shift()!;
      const step = stepMap[stepId];
      topologicalOrder.push({
        stepId: step.stepId,
        name: step.name,
        order: step.order,
        dependsOn: step.dependsOn || [],
        level: topologicalOrder.length
      });

      // Find all steps that depend on this step
      recipe.steps.forEach((s) => {
        if ((s.dependsOn || []).includes(stepId)) {
          inDegree[s.stepId]--;
          if (inDegree[s.stepId] === 0) {
            queue.push(s.stepId);
          }
        }
      });
    }

    // Check if all steps are in topological order (no cycles)
    if (topologicalOrder.length !== recipe.steps.length) {
      const errorResponse: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Circular dependencies detected in recipe steps"
      };
      res.status(400).json(errorResponse);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Dependency graph retrieved successfully",
      data: {
        recipeId: recipe._id,
        productCode: recipe.productCode,
        version: recipe.version,
        topologicalOrder,
        dependencyGraph: graph
      }
    };
    res.json(response);
  } catch (error: any) {
    console.error("Get dependency graph error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};
