import mongoose from "mongoose";
import RecipeSnapshot, {
  IRecipeSnapshot,
  IRecipeStepSnapshot,
  IRawMaterialSnapshotReference
} from "../models/RecipeSnapshot";
import ProductSnapshot, {
  IProductSnapshot,
  IProductRecipeSnapshotReference
} from "../models/ProductSnapshot";
import { Recipe } from "../models/Recipe";
import { Product } from "../models/Product";

/**
 * SnapshotService
 *
 * Handles creation and retrieval of Recipe and Product snapshots with smart caching.
 * Snapshots are immutable copies of recipes/products captured at a specific point in time.
 * Smart caching compares timestamps to avoid redundant snapshot creation.
 */
export class SnapshotService {
  /**
   * Get or create a Recipe snapshot with smart caching
   *
   * @param recipeId - The ID of the live Recipe document
   * @returns RecipeSnapshot document (existing or newly created)
   *
   * Smart Caching Logic:
   * 1. Find the latest snapshot for this recipe
   * 2. If no snapshot exists, create version 1
   * 3. If snapshot exists but recipe hasn't been updated since snapshot creation, reuse existing
   * 4. If recipe has been updated, create new version with incremented version number
   */
  static async getOrCreateRecipeSnapshot(
    recipeId: mongoose.Types.ObjectId
  ): Promise<IRecipeSnapshot> {
    // Fetch the live Recipe with all populated data
    const recipe = await Recipe.findById(recipeId)
      .populate("rawMaterials.materialId")
      .populate("steps.deviceTypeId")
      .lean();

    if (!recipe) {
      throw new Error(`Recipe with ID ${recipeId} not found`);
    }

    // Transform recipe steps to snapshot format
    const stepSnapshots: IRecipeStepSnapshot[] = recipe.steps.map((step) => ({
      _id: new mongoose.Types.ObjectId(step._id),
      order: step.order,
      name: step.name,
      description: step.description || "",
      deviceTypeId: step.deviceTypeId,
      estimatedDuration: step.estimatedDuration,
      dependsOn: step.dependsOn || [],
      instructions: (step as any).instructions,
      qualityChecks: step.qualityChecks || []
    }));

    // Transform raw materials to snapshot format
    const rawMaterialSnapshots: IRawMaterialSnapshotReference[] =
      recipe.rawMaterials.map((rm) => {
        const material = rm.materialId as any; // Populated document
        return {
          rawMaterialId: material._id,
          rawMaterialNumber: material.materialCode || "",
          name: material.name,
          unit: material.unit,
          unitPrice: material.unitPrice || 0,
          description: material.description,
          quantity: rm.quantityRequired
        };
      });

    // Prepare snapshot data
    const snapshotData = {
      recipeNumber: recipe.recipeNumber,
      name: recipe.name,
      description: recipe.description,
      specification: (recipe as any).specification,
      steps: stepSnapshots,
      rawMaterials: rawMaterialSnapshots,
      estimatedDuration: recipe.estimatedDuration,
      mediaIds: (recipe as any).mediaIds || [],
      updatedAt: recipe.updatedAt
    };

    // Use the model's static method for smart caching
    return RecipeSnapshot.getOrCreateSnapshot(recipeId, snapshotData);
  }

  /**
   * Get or create a Product snapshot with smart caching
   *
   * @param productId - The ID of the live Product document
   * @returns ProductSnapshot document (existing or newly created)
   *
   * Smart Caching Logic:
   * 1. For each recipe in the product, create/get recipe snapshots first
   * 2. Find the latest product snapshot
   * 3. If no snapshot exists, create version 1 with recipe snapshot references
   * 4. If snapshot exists but product hasn't been updated since creation, reuse existing
   * 5. If product has been updated, create new version with incremented version number
   */
  static async getOrCreateProductSnapshot(
    productId: mongoose.Types.ObjectId
  ): Promise<IProductSnapshot> {
    // Fetch the live Product with populated recipes
    const product = await Product.findById(productId).lean();

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Create/get snapshots for all recipes in this product
    const recipeSnapshotRefs: IProductRecipeSnapshotReference[] =
      await Promise.all(
        product.recipes.map(async (recipe) => {
          const recipeSnapshot = await this.getOrCreateRecipeSnapshot(
            recipe.recipeId
          );
          return {
            recipeSnapshotId: recipeSnapshot._id,
            quantity: recipe.quantity
          };
        })
      );

    // Prepare snapshot data
    const snapshotData = {
      productNumber: product.designNumber,
      name: product.productName,
      description: product.customerName,
      recipes: recipeSnapshotRefs,
      updatedAt: product.updatedAt
    };

    // Use the model's static method for smart caching
    return ProductSnapshot.getOrCreateSnapshot(productId, snapshotData);
  }

  /**
   * Get the latest snapshot for a recipe (if exists)
   *
   * @param recipeId - The ID of the live Recipe document
   * @returns Latest RecipeSnapshot or null if none exists
   */
  static async getLatestRecipeSnapshot(
    recipeId: mongoose.Types.ObjectId
  ): Promise<IRecipeSnapshot | null> {
    return RecipeSnapshot.getLatestSnapshot(recipeId);
  }

  /**
   * Get the latest snapshot for a product (if exists)
   *
   * @param productId - The ID of the live Product document
   * @returns Latest ProductSnapshot or null if none exists
   */
  static async getLatestProductSnapshot(
    productId: mongoose.Types.ObjectId
  ): Promise<IProductSnapshot | null> {
    return ProductSnapshot.getLatestSnapshot(productId);
  }

  /**
   * Batch create snapshots for multiple recipes
   *
   * @param recipeIds - Array of recipe IDs
   * @returns Array of RecipeSnapshot documents
   */
  static async batchCreateRecipeSnapshots(
    recipeIds: mongoose.Types.ObjectId[]
  ): Promise<IRecipeSnapshot[]> {
    return Promise.all(
      recipeIds.map((id) => this.getOrCreateRecipeSnapshot(id))
    );
  }

  /**
   * Batch create snapshots for multiple products
   *
   * @param productIds - Array of product IDs
   * @returns Array of ProductSnapshot documents
   */
  static async batchCreateProductSnapshots(
    productIds: mongoose.Types.ObjectId[]
  ): Promise<IProductSnapshot[]> {
    return Promise.all(
      productIds.map((id) => this.getOrCreateProductSnapshot(id))
    );
  }
}
