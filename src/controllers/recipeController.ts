import { Request, Response } from "express";
import { Recipe } from "../models";
import { RawMaterial } from "../models/RawMaterial";
import { DeviceType } from "../models/DeviceType";
import { Project } from "../models/Project";
import { APIResponse } from "../types";

/**
 * Get all recipes with pagination and filtering
 */
export const getRecipes = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, recipeNumber, search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    if (recipeNumber) {
      query.recipeNumber = recipeNumber;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { recipeNumber: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .populate(
          "rawMaterials.materialId",
          "materialCode name specifications supplier unit"
        )
        .populate(
          "steps.mediaIds",
          "filename originalName mimeType fileSize filePath"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
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
      error: "INTERNAL_SERVER_ERROR",
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

    const recipe = await Recipe.findById(id)
      .populate(
        "rawMaterials.materialId",
        "materialCode name specifications supplier unit"
      )
      .populate(
        "steps.mediaIds",
        "filename originalName mimeType fileSize filePath"
      );

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
      error: "INTERNAL_SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};

/**
 * Get recipe by recipe number and version
 */
export const getRecipeByRecipeNumber = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { recipeNumber } = req.params;
    const { version } = req.query;

    const query: any = { recipeNumber };
    if (version) {
      query.version = parseInt(version as string);
    }

    // If version not specified, get the latest version
    const recipe = await Recipe.findOne(query)
      .populate(
        "rawMaterials.materialId",
        "materialCode name specifications supplier unit"
      )
      .populate(
        "steps.mediaIds",
        "filename originalName mimeType fileSize filePath"
      )
      .sort({ version: -1 });

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
    console.error("Get recipe by recipe number error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
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
    const { recipeNumber, version, name, description, rawMaterials, steps } =
      req.body;

    // Validate required fields
    if (!name || !steps || steps.length === 0) {
      const errorResponse: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name and at least one step are required"
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Validate raw materials if provided
    const processedRawMaterials = [];
    if (rawMaterials && rawMaterials.length > 0) {
      for (const rawMat of rawMaterials) {
        if (
          !rawMat.materialId ||
          !rawMat.quantityRequired ||
          rawMat.quantityRequired < 0
        ) {
          const errorResponse: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message:
              "Each raw material must have materialId and quantityRequired >= 0"
          };
          res.status(400).json(errorResponse);
          return;
        }

        // Validate that raw material exists
        const material = await RawMaterial.findById(rawMat.materialId);
        if (!material) {
          const errorResponse: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Raw material not found: ${rawMat.materialId}`
          };
          res.status(404).json(errorResponse);
          return;
        }

        processedRawMaterials.push({
          materialId: rawMat.materialId,
          quantityRequired: rawMat.quantityRequired,
          specification: rawMat.specification
        });
      }
    }

    // Validate and process steps
    const processedSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Validate required fields
      if (!step.name || !step.estimatedDuration || !step.deviceTypeId) {
        const errorResponse: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Step ${
            i + 1
          }: name, estimatedDuration, and deviceTypeId are required`
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Validate deviceTypeId exists
      const deviceType = await DeviceType.findById(step.deviceTypeId);
      if (!deviceType) {
        const errorResponse: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Step ${i + 1}: Device type not found: ${step.deviceTypeId}`
        };
        res.status(404).json(errorResponse);
        return;
      }

      processedSteps.push({
        order: step.order || i + 1,
        name: step.name,
        description: step.description,
        estimatedDuration: step.estimatedDuration,
        deviceTypeId: step.deviceTypeId,
        qualityChecks: step.qualityChecks || [],
        dependsOn: step.dependsOn || [], // Array of step _ids (ObjectIds)
        mediaIds: step.mediaIds || [] // MongoDB will auto-generate _id for each media
      });
    }

    const recipe = new Recipe({
      recipeNumber,
      version: version || 1,
      name,
      description,
      rawMaterials: processedRawMaterials,
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
      error: "INTERNAL_SERVER_ERROR",
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
    const { name, description, rawMaterials, steps } = req.body;

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

    // Update raw materials if provided
    if (rawMaterials !== undefined) {
      if (rawMaterials.length > 0) {
        // Validate raw materials
        const processedRawMaterials = [];
        for (const rawMat of rawMaterials) {
          if (
            !rawMat.materialId ||
            !rawMat.quantityRequired ||
            rawMat.quantityRequired < 0
          ) {
            const errorResponse: APIResponse = {
              success: false,
              error: "VALIDATION_ERROR",
              message:
                "Each raw material must have materialId and quantityRequired >= 0"
            };
            res.status(400).json(errorResponse);
            return;
          }

          // Validate that raw material exists
          const material = await RawMaterial.findById(rawMat.materialId);
          if (!material) {
            const errorResponse: APIResponse = {
              success: false,
              error: "NOT_FOUND",
              message: `Raw material not found: ${rawMat.materialId}`
            };
            res.status(404).json(errorResponse);
            return;
          }

          processedRawMaterials.push({
            materialId: rawMat.materialId,
            quantityRequired: rawMat.quantityRequired,
            specification: rawMat.specification
          });
        }
        recipe.rawMaterials = processedRawMaterials;
      } else {
        recipe.rawMaterials = [];
      }
    }

    if (steps && steps.length > 0) {
      // Validate and process steps
      const processedSteps = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Validate required fields
        if (!step.name || !step.estimatedDuration || !step.deviceTypeId) {
          const errorResponse: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: `Step ${
              i + 1
            }: name, estimatedDuration, and deviceTypeId are required`
          };
          res.status(400).json(errorResponse);
          return;
        }

        // Validate deviceTypeId exists
        const deviceType = await DeviceType.findById(step.deviceTypeId);
        if (!deviceType) {
          const errorResponse: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Step ${i + 1}: Device type not found: ${
              step.deviceTypeId
            }`
          };
          res.status(404).json(errorResponse);
          return;
        }

        processedSteps.push(step);
      }

      recipe.steps = processedSteps;
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
      error: "INTERNAL_SERVER_ERROR",
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

    // Check if recipe is used in any project
    const projectsUsingRecipe = await Project.findOne({
      "recipes.recipeId": id
    });

    if (projectsUsingRecipe) {
      const errorResponse: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Cannot delete recipe. It is being used in one or more projects."
      };
      res.status(400).json(errorResponse);
      return;
    }

    await Recipe.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Recipe deleted successfully"
    };
    res.json(response);
  } catch (error: any) {
    console.error("Delete recipe error:", error);
    const errorResponse: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
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

    // Get the highest version for this recipe number
    const highestVersion = existingRecipe.recipeNumber
      ? await Recipe.findOne({
          recipeNumber: existingRecipe.recipeNumber
        }).sort({ version: -1 })
      : null;

    const newVersion = (highestVersion?.version || existingRecipe.version) + 1;

    const newRecipe = new Recipe({
      recipeNumber: existingRecipe.recipeNumber,
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
      error: "INTERNAL_SERVER_ERROR",
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

    const recipe = await Recipe.findById(id)
      .populate(
        "rawMaterials.materialId",
        "materialCode name specifications supplier unit"
      )
      .populate(
        "steps.mediaIds",
        "filename originalName mimeType fileSize filePath"
      );

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
      const stepIdStr = step._id.toString();
      graph[stepIdStr] = (step.dependsOn || []).map((id) => id.toString());
      inDegree[stepIdStr] = 0;
      stepMap[stepIdStr] = step;
    });

    // Calculate in-degrees
    recipe.steps.forEach((step) => {
      (step.dependsOn || []).forEach(() => {
        inDegree[step._id.toString()]++;
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
        stepId: step._id,
        name: step.name,
        order: step.order,
        dependsOn: step.dependsOn || [],
        level: topologicalOrder.length
      });

      // Find all steps that depend on this step
      recipe.steps.forEach((s) => {
        const dependsOnStr = (s.dependsOn || []).map((id) => id.toString());
        if (dependsOnStr.includes(stepId)) {
          const sIdStr = s._id.toString();
          inDegree[sIdStr]--;
          if (inDegree[sIdStr] === 0) {
            queue.push(sIdStr);
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
        recipeNumber: recipe.recipeNumber,
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
      error: "INTERNAL_SERVER_ERROR",
      message: error.message
    };
    res.status(500).json(errorResponse);
  }
};
