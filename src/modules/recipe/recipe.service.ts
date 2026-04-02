import mongoose from "mongoose";
import { DeviceType } from "@modules/device-type";
import { RawMaterial } from "@modules/raw-material";
import { Recipe, IRecipe, IRecipeStep } from "./recipe.model";
import {
  RecipeCreateDTO,
  RecipeCreateVersionDTO,
  RecipeListFilters,
  RecipeListResult,
  RecipeUpdateDTO
} from "./recipe.types";
import { Product, IProductRecipe } from "@modules/product";
import { Project } from "@modules/project";
import { projectDeviceConfigurationService } from "../project/project-device-configuration.service";
import { SnapshotService } from "@shared/services/snapshotService";

export class RecipeService {
  async list(
    filters: RecipeListFilters = {}
  ): Promise<RecipeListResult<IRecipe>> {
    const { page = 1, limit = 10, recipeNumber, search } = filters;

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

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Recipe.find(query)
        .populate("modifiedBy", "name email")
        .populate({
          path: "rawMaterials.materialId",
          select:
            "materialType description supplier unit dimensions weight color",
          populate: {
            path: "materialType",
            select: "code name"
          }
        })
        .populate(
          "steps.mediaIds",
          "filename originalName mimeType fileSize filePath"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Recipe.countDocuments(query)
    ]);

    return {
      items: items as any,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      }
    };
  }

  async getById(id: string): Promise<IRecipe | null> {
    return Recipe.findById(id)
      .populate({
        path: "rawMaterials.materialId",
        select:
          "materialType description supplier unit dimensions weight color",
        populate: {
          path: "materialType",
          select: "code name"
        }
      })
      .populate(
        "steps.mediaIds",
        "filename originalName mimeType fileSize filePath"
      )
      .populate(
        "mediaIds",
        "filename originalName mimeType fileSize filePath"
      ) as any;
  }

  async getByRecipeNumber(
    recipeNumber: string,
    version?: number
  ): Promise<IRecipe | null> {
    const query: any = { recipeNumber };
    if (version) {
      query.version = version;
    }

    return Recipe.findOne(query)
      .populate({
        path: "rawMaterials.materialId",
        select:
          "materialType description supplier unit dimensions weight color",
        populate: {
          path: "materialType",
          select: "code name"
        }
      })
      .populate(
        "steps.mediaIds",
        "filename originalName mimeType fileSize filePath"
      )
      .sort({ version: -1 }) as any;
  }

  static async generateRecipeNumber(
    productId: mongoose.Types.ObjectId | string
  ): Promise<string | null> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        return null;
      }
      return `${product.designNumber}`;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error generating recipe number:", error);
      return null;
    }
  }

  static getNextVersion(currentVersion?: number): number {
    if (!currentVersion || currentVersion < 1) {
      return 1;
    }
    return currentVersion + 1;
  }

  static async prepareRecipeForSave(
    recipe: any,
    isNew: boolean = false
  ): Promise<void> {
    if (isNew) {
      recipe.version = 1;
    } else {
      recipe.version = this.getNextVersion(recipe.version);
    }

    if (isNew && recipe.product && !recipe.recipeNumber) {
      const generatedNumber = await this.generateRecipeNumber(recipe.product);
      if (generatedNumber) {
        recipe.recipeNumber = generatedNumber;
      }
    }
  }

  async create(
    data: RecipeCreateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<IRecipe> {
    const processedRawMaterials: any[] = [];
    const rawMaterials = data.rawMaterials || [];

    for (const rawMat of rawMaterials) {
      const material = await RawMaterial.findById(rawMat.materialId);
      if (!material) {
        const error: any = new Error(
          `Raw material not found: ${rawMat.materialId}`
        );
        error.code = "RAW_MATERIAL_NOT_FOUND";
        error.status = 404;
        throw error;
      }
      processedRawMaterials.push({
        materialId: rawMat.materialId,
        quantityRequired: rawMat.quantityRequired,
        specification: rawMat.specification
      });
    }

    const processedSteps: any[] = [];
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      const deviceType = await DeviceType.findById(step.deviceTypeId);
      if (!deviceType) {
        const error: any = new Error(
          `Step ${i + 1}: Device type not found: ${step.deviceTypeId}`
        );
        error.code = "DEVICE_TYPE_NOT_FOUND";
        error.status = 404;
        throw error;
      }

      processedSteps.push({
        order: step.order || i + 1,
        name: step.name,
        description: step.description,
        estimatedDuration: step.estimatedDuration,
        deviceTypeId: step.deviceTypeId,
        qualityChecks: step.qualityChecks || [],
        dependsOn: step.dependsOn || [],
        mediaIds: step.mediaIds || []
      });
    }

    const recipe = new Recipe({
      recipeNumber: data.recipeNumber,
      version: 1,
      name: data.name,
      description: data.description,
      rawMaterials: processedRawMaterials,
      product: data.product,
      steps: processedSteps,
      estimatedDuration: 0,
      dwgNo: data.dwgNo,
      unit: data.unit || "EA",
      outsourcing: data.outsourcing,
      remarks: data.remarks,
      mediaIds: data.mediaIds || [],
      modifiedBy: userId
    });

    await RecipeService.prepareRecipeForSave(recipe, true);
    await recipe.save();

    const productDoc = await Product.findById(recipe.product);
    if (productDoc) {
      productDoc.recipes.push({
        recipeId: recipe._id as mongoose.Types.ObjectId,
        quantity: 1
      } as IProductRecipe);
      await productDoc.save();
      await SnapshotService.getOrCreateProductSnapshot(
        productDoc._id as mongoose.Types.ObjectId
      );
    }

    return recipe as any;
  }

  async update(
    id: string,
    data: RecipeUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<IRecipe | null> {
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return null;
    }

    if (data.name) recipe.name = data.name;
    if (data.description !== undefined) recipe.description = data.description;
    if (data.dwgNo !== undefined) (recipe as any).dwgNo = data.dwgNo;
    if (data.unit !== undefined) (recipe as any).unit = data.unit;
    if (data.outsourcing !== undefined)
      (recipe as any).outsourcing = data.outsourcing;
    if (data.remarks !== undefined) (recipe as any).remarks = data.remarks;
    if (data.mediaIds !== undefined) (recipe as any).mediaIds = data.mediaIds;

    if (data.rawMaterials !== undefined) {
      const processedRawMaterials: any[] = [];
      for (const rawMat of data.rawMaterials || []) {
        const material = await RawMaterial.findById(rawMat.materialId);
        if (!material) {
          const error: any = new Error(
            `Raw material not found: ${rawMat.materialId}`
          );
          error.code = "RAW_MATERIAL_NOT_FOUND";
          error.status = 404;
          throw error;
        }
        processedRawMaterials.push({
          materialId: rawMat.materialId,
          quantityRequired: rawMat.quantityRequired,
          specification: rawMat.specification
        });
      }
      (recipe as any).rawMaterials = processedRawMaterials;
    }

    if (data.steps !== undefined) {
      const processedSteps: any[] = [];
      const steps = data.steps || [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const deviceType = await DeviceType.findById(step.deviceTypeId);
        if (!deviceType) {
          const error: any = new Error(
            `Step ${i + 1}: Device type not found: ${step.deviceTypeId}`
          );
          error.code = "DEVICE_TYPE_NOT_FOUND";
          error.status = 404;
          throw error;
        }
        processedSteps.push({
          ...step,
          order: step.order || i + 1,
          qualityChecks: step.qualityChecks || [],
          dependsOn: step.dependsOn || [],
          mediaIds: step.mediaIds || []
        });
      }
      (recipe as any).steps = processedSteps as unknown as IRecipeStep[];
    }

    if (userId) {
      (recipe as any).modifiedBy = userId;
    }

    await RecipeService.prepareRecipeForSave(recipe, false);
    await recipe.save();

    await projectDeviceConfigurationService.deleteForPlanningProjectsReferencingRecipe(
      id
    );

    await SnapshotService.getOrCreateRecipeSnapshot(
      recipe._id as mongoose.Types.ObjectId
    );
    await Product.findOneAndUpdate(
      { "recipes.recipeId": recipe._id },
      {
        $set: {
          updatedAt: new Date()
        }
      }
    );
    await SnapshotService.getOrCreateProductSnapshot(
      recipe.product as mongoose.Types.ObjectId
    );

    return recipe as any;
  }

  async remove(
    id: string,
    userId?: mongoose.Types.ObjectId
  ): Promise<{ deleted: boolean; reason?: string }> {
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return { deleted: false, reason: "NOT_FOUND" };
    }

    const projectsUsingRecipe = await Project.findOne({
      "recipes.recipeId": id
    });
    if (projectsUsingRecipe) {
      return { deleted: false, reason: "IN_USE" };
    }

    const productsUsingRecipe = await Product.find({
      "recipes.recipeId": id
    });
    for (const product of productsUsingRecipe) {
      product.recipes = product.recipes.filter(
        (r: IProductRecipe) => r.recipeId?._id.toString() !== id
      );
      await product.save();
      await SnapshotService.getOrCreateProductSnapshot(
        product._id as mongoose.Types.ObjectId
      );
    }

    if (userId) {
      (recipe as any).modifiedBy = userId;
      await recipe.save();
    }

    await Recipe.findByIdAndDelete(id);
    return { deleted: true };
  }

  async createVersion(
    id: string,
    data: RecipeCreateVersionDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<IRecipe | null> {
    const existingRecipe = await Recipe.findById(id);
    if (!existingRecipe) {
      return null;
    }

    const highestVersion = existingRecipe.recipeNumber
      ? await Recipe.findOne({
          recipeNumber: existingRecipe.recipeNumber
        }).sort({ version: -1 })
      : null;

    const newVersion =
      (highestVersion?.version || (existingRecipe as any).version || 1) + 1;

    const newRecipe = new Recipe({
      recipeNumber: (existingRecipe as any).recipeNumber,
      version: newVersion,
      name: data.name || (existingRecipe as any).name,
      description: data.description || (existingRecipe as any).description,
      steps: data.steps || (existingRecipe as any).steps,
      estimatedDuration: 0,
      modifiedBy: userId
    });

    await newRecipe.save();
    return newRecipe as any;
  }
}

export const recipeService = new RecipeService();
