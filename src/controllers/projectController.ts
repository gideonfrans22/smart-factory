import { Request, Response } from "express";
import { Project } from "../models/Project";
import { Recipe } from "../models/Recipe";
import { Product } from "../models/Product";
import { Task } from "../models/Task";
import { APIResponse, AuthenticatedRequest } from "../types";

/**
 * Get all projects with optional filtering and pagination
 * GET /api/projects?status=ACTIVE&page=1&limit=10
 */
export const getProjects = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Project.countDocuments(query);

    // Get projects (snapshots contain all data, no need to populate products/recipes)
    const projects = await Project.find(query)
      .populate("createdBy", "name email username")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Projects retrieved successfully",
      data: {
        items: projects,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get projects error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get project by ID
 * GET /api/projects/:id
 */
export const getProjectById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id).populate(
      "createdBy",
      "name email username"
    );

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Project retrieved successfully",
      data: project
    };

    res.json(response);
  } catch (error) {
    console.error("Get project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Create new project with product and recipe snapshots
 * POST /api/projects
 * Body: {
 *   name, description, status, priority, startDate, endDate, deadline,
 *   products: [{ productId, targetQuantity }],
 *   recipes: [{ recipeId, targetQuantity }]
 * }
 */
export const createProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      description,
      products,
      recipes,
      status,
      priority,
      startDate,
      endDate,
      deadline,
      createdBy
    } = req.body;

    // Validation
    if (!name) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Project name is required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate createdBy
    if (!createdBy) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "CreatedBy is required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate at least one product or recipe
    if (
      (!products || products.length === 0) &&
      (!recipes || recipes.length === 0)
    ) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Project must have at least one product or one recipe"
      };
      res.status(400).json(response);
      return;
    }

    // Process products with snapshots
    const processedProducts = [];
    if (products && products.length > 0) {
      for (const item of products) {
        if (
          !item.productId ||
          !item.targetQuantity ||
          item.targetQuantity < 1
        ) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: "Each product must have productId and targetQuantity >= 1"
          };
          res.status(400).json(response);
          return;
        }

        // Validate product exists and fetch for snapshot
        const product = await Product.findById(item.productId);
        if (!product) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Product not found: ${item.productId}`
          };
          res.status(404).json(response);
          return;
        }

        // Fetch recipe details for snapshot
        const recipeSnapshots = [];
        if (product.recipes && product.recipes.length > 0) {
          for (const productRecipe of product.recipes) {
            const recipe = await Recipe.findById(
              productRecipe.recipeId
            ).populate("rawMaterials.materialId");
            if (recipe) {
              // Process raw materials with snapshots
              const rawMaterialsWithSnapshots = [];
              if (recipe.rawMaterials && recipe.rawMaterials.length > 0) {
                for (const rawMat of recipe.rawMaterials) {
                  const material = rawMat.materialId as any;
                  if (material) {
                    rawMaterialsWithSnapshots.push({
                      materialId: material._id,
                      snapshot: {
                        materialCode: material.materialCode,
                        name: material.name,
                        specifications: material.specifications,
                        supplier: material.supplier,
                        unit: material.unit
                      },
                      quantityRequired: rawMat.quantityRequired,
                      specification: rawMat.specification
                    });
                  }
                }
              }

              recipeSnapshots.push({
                recipeId: recipe._id,
                recipeNumber: recipe.recipeNumber,
                version: recipe.version,
                name: recipe.name,
                description: recipe.description,
                rawMaterials: rawMaterialsWithSnapshots,
                steps: recipe.steps,
                estimatedDuration: recipe.estimatedDuration,
                quantity: productRecipe.quantity
              });
            }
          }
        }

        // Create snapshot
        processedProducts.push({
          productId: product._id,
          snapshot: {
            designNumber: product.designNumber,
            productName: product.productName,
            customerName: product.customerName,
            quantityUnit: product.quantityUnit,
            recipes: recipeSnapshots
          },
          targetQuantity: item.targetQuantity,
          producedQuantity: 0
        });
      }
    }

    // Process recipes with snapshots
    const processedRecipes = [];
    if (recipes && recipes.length > 0) {
      for (const item of recipes) {
        if (!item.recipeId || !item.targetQuantity || item.targetQuantity < 1) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: "Each recipe must have recipeId and targetQuantity >= 1"
          };
          res.status(400).json(response);
          return;
        }

        // Validate recipe exists and fetch for snapshot
        const recipe = await Recipe.findById(item.recipeId).populate(
          "rawMaterials.materialId"
        );
        if (!recipe) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Recipe not found: ${item.recipeId}`
          };
          res.status(404).json(response);
          return;
        }

        // Process raw materials with snapshots
        const rawMaterialsWithSnapshots = [];
        if (recipe.rawMaterials && recipe.rawMaterials.length > 0) {
          for (const rawMat of recipe.rawMaterials) {
            const material = rawMat.materialId as any;
            if (material) {
              rawMaterialsWithSnapshots.push({
                materialId: material._id,
                snapshot: {
                  materialCode: material.materialCode,
                  name: material.name,
                  specifications: material.specifications,
                  supplier: material.supplier,
                  unit: material.unit
                },
                quantityRequired: rawMat.quantityRequired,
                specification: rawMat.specification
              });
            }
          }
        }

        // Create snapshot
        processedRecipes.push({
          recipeId: recipe._id,
          snapshot: {
            recipeNumber: recipe.recipeNumber,
            version: recipe.version,
            name: recipe.name,
            description: recipe.description,
            rawMaterials: rawMaterialsWithSnapshots,
            steps: recipe.steps,
            estimatedDuration: recipe.estimatedDuration
          },
          targetQuantity: item.targetQuantity,
          producedQuantity: 0
        });
      }
    }

    // Create project with snapshots
    const project = new Project({
      name,
      description,
      products: processedProducts,
      recipes: processedRecipes,
      status: status || "PLANNING",
      priority: priority || "MEDIUM",
      startDate,
      endDate,
      deadline,
      progress: 0, // Will be calculated by pre-save hook
      createdBy: createdBy
    });

    await project.save();
    await project.populate("createdBy", "name email username");

    const response: APIResponse = {
      success: true,
      message: "Project created successfully",
      data: project
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update project
 * PUT /api/projects/:id
 * Note: Products/recipes snapshots cannot be changed once created (immutable)
 * Only quantities can be updated
 */
export const updateProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      deadline,
      products,
      recipes
    } = req.body;

    const project = await Project.findById(id);

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    // Track if status is changing to ACTIVE
    const oldStatus = project.status;
    const isActivating = status === "ACTIVE" && oldStatus !== "ACTIVE";

    // Update basic fields
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (priority !== undefined) project.priority = priority;
    if (startDate !== undefined) project.startDate = new Date(startDate);
    if (endDate !== undefined) project.endDate = new Date(endDate);
    if (deadline !== undefined)
      project.deadline = deadline ? new Date(deadline) : undefined;

    // Auto-set startDate when activating project
    if (isActivating && !project.startDate) {
      project.startDate = new Date();
    }

    // Update product quantities (snapshots remain immutable)
    if (products && Array.isArray(products)) {
      for (const updatedProduct of products) {
        const existingProduct = project.products.find(
          (p) => p.productId.toString() === updatedProduct.productId
        );

        if (existingProduct) {
          if (updatedProduct.targetQuantity !== undefined) {
            if (updatedProduct.targetQuantity < 1) {
              const response: APIResponse = {
                success: false,
                error: "VALIDATION_ERROR",
                message: "Target quantity must be at least 1"
              };
              res.status(400).json(response);
              return;
            }
            existingProduct.targetQuantity = updatedProduct.targetQuantity;
          }
          if (updatedProduct.producedQuantity !== undefined) {
            existingProduct.producedQuantity = updatedProduct.producedQuantity;
          }
        }
      }
    }

    // Update recipe quantities (snapshots remain immutable)
    if (recipes && Array.isArray(recipes)) {
      for (const updatedRecipe of recipes) {
        const existingRecipe = project.recipes.find(
          (r) => r.recipeId.toString() === updatedRecipe.recipeId
        );

        if (existingRecipe) {
          if (updatedRecipe.targetQuantity !== undefined) {
            if (updatedRecipe.targetQuantity < 1) {
              const response: APIResponse = {
                success: false,
                error: "VALIDATION_ERROR",
                message: "Target quantity must be at least 1"
              };
              res.status(400).json(response);
              return;
            }
            existingRecipe.targetQuantity = updatedRecipe.targetQuantity;
          }
          if (updatedRecipe.producedQuantity !== undefined) {
            existingRecipe.producedQuantity = updatedRecipe.producedQuantity;
          }
        }
      }
    }

    await project.save(); // Progress will be recalculated by pre-save hook

    // Auto-create initial tasks when project becomes ACTIVE
    const createdTasks = [];
    if (isActivating) {
      // Create initial tasks for each product's recipes
      if (project.products && project.products.length > 0) {
        for (const projectProduct of project.products) {
          const productSnapshot = projectProduct.snapshot;

          // Iterate through each recipe in the product snapshot
          if (productSnapshot.recipes && productSnapshot.recipes.length > 0) {
            for (const productRecipe of productSnapshot.recipes) {
              // Use snapshot data instead of fetching live Recipe
              if (productRecipe.steps && productRecipe.steps.length > 0) {
                // Find the first step (order = 1) from snapshot
                const firstStep = productRecipe.steps.find(
                  (step: any) => step.order === 1
                );

                if (firstStep) {
                  // Validate deviceTypeId exists
                  if (!firstStep.deviceTypeId) {
                    const response: APIResponse = {
                      success: false,
                      error: "VALIDATION_ERROR",
                      message: `First step of recipe in product "${productSnapshot.productName}" does not have a deviceTypeId`
                    };
                    res.status(400).json(response);
                    return;
                  }

                  // Create task for the first step using snapshot data
                  const newTask = new Task({
                    title: `${firstStep.name} - ${productSnapshot.productName} - ${project.name}`,
                    description: firstStep.description,
                    projectId: project._id,
                    productId: projectProduct.productId,
                    recipeId: productRecipe.recipeId,
                    recipeStepId: firstStep._id,
                    deviceTypeId: firstStep.deviceTypeId,
                    status: "PENDING",
                    priority: project.priority,
                    estimatedDuration: firstStep.estimatedDuration,
                    progress: 0,
                    pausedDuration: 0
                  });

                  await newTask.save();
                  createdTasks.push(newTask);
                }
              }
            }
          }
        }
      }

      // Create initial tasks for each standalone recipe's first step
      for (const projectRecipe of project.recipes) {
        const recipeSnapshot = projectRecipe.snapshot;

        // Find the first step (order = 1)
        const firstStep = recipeSnapshot.steps.find(
          (step: any) => step.order === 1
        );

        if (firstStep) {
          // Validate deviceTypeId exists
          if (!firstStep.deviceTypeId) {
            const response: APIResponse = {
              success: false,
              error: "VALIDATION_ERROR",
              message: `First step of recipe "${recipeSnapshot.name}" does not have a deviceTypeId`
            };
            res.status(400).json(response);
            return;
          }

          // Create task for the first step
          const newTask = new Task({
            title: `${firstStep.name} - ${project.name}`,
            description: firstStep.description,
            projectId: project._id,
            recipeId: projectRecipe.recipeId,
            recipeStepId: firstStep._id,
            deviceTypeId: firstStep.deviceTypeId,
            status: "PENDING",
            priority: project.priority,
            estimatedDuration: firstStep.estimatedDuration,
            progress: 0,
            pausedDuration: 0
          });

          await newTask.save();
          createdTasks.push(newTask);
        }
      }
    }

    await project.populate("createdBy", "name email username");

    const response: APIResponse = {
      success: true,
      message: isActivating
        ? `Project activated successfully. ${createdTasks.length} initial task(s) created.`
        : "Project updated successfully",
      data: {
        project,
        ...(isActivating && { createdTasks })
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete project
 * DELETE /api/projects/:id
 */
export const deleteProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    await Project.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Project deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
