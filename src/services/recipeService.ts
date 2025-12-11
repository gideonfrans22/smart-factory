import {
  IRawMaterialReference,
  IRecipe,
  IRecipeStep,
  Recipe
} from "../models/Recipe";
import { IProductRecipe, Product } from "../models/Product";
import mongoose from "mongoose";
import { ProductService } from "./productService";

/**
 * Service for recipe-related operations
 */
export class RecipeService {
  /**
   * Generate recipeNumber with format: {Product.designNumber}-{count}
   * Where count is the nth recipe for that product (1-indexed)
   *
   * @param productId - The product ID to generate recipe number for
   * @returns Generated recipe number or null if product not found
   */
  static async generateRecipeNumber(
    productId: mongoose.Types.ObjectId | string
  ): Promise<string | null> {
    try {
      // Get the product to access its designNumber
      const product = await Product.findById(productId);
      if (!product) {
        return null;
      }

      // Count existing recipes for this product (excluding soft-deleted ones)
      const recipeCount = await Recipe.countDocuments({
        product: productId,
        deletedAt: null
      });

      // Generate format: {designNumber}-{count+1}
      // count+1 because we're generating for the next recipe
      const recipeNumber = `${product.designNumber}-${recipeCount + 1}`;
      return recipeNumber;
    } catch (error) {
      console.error("Error generating recipe number:", error);
      return null;
    }
  }

  /**
   * Generate the next version number
   * For new recipes, returns 1
   * For updated recipes, returns current version + 1
   *
   * @param currentVersion - Current version (undefined for new recipes)
   * @returns Next version number
   */
  static getNextVersion(currentVersion?: number): number {
    if (!currentVersion || currentVersion < 1) {
      return 1; // Default for new recipes
    }
    return currentVersion + 1;
  }

  /**
   * Prepare recipe for save (applies version and recipeNumber logic)
   * Should be called before saving a recipe
   *
   * @param recipe - Recipe document to prepare
   * @param isNew - Whether this is a new recipe (true) or update (false)
   */
  static async prepareRecipeForSave(
    recipe: any,
    isNew: boolean = false
  ): Promise<void> {
    // Set version
    if (isNew) {
      recipe.version = 1; // New recipes start at version 1
    } else {
      // Existing recipes: increment version
      recipe.version = this.getNextVersion(recipe.version);
    }

    // Generate recipeNumber if not already set and product is linked
    if (isNew && recipe.product && !recipe.recipeNumber) {
      const generatedNumber = await this.generateRecipeNumber(recipe.product);
      if (generatedNumber) {
        recipe.recipeNumber = generatedNumber;
      }
    }
  }

  static async duplicateRecipesForProduct(
    originalProductId: mongoose.Types.ObjectId | string,
    duplicatedProductId: mongoose.Types.ObjectId | string
  ): Promise<IProductRecipe[]> {
    try {
      const originalProduct = await ProductService.getProductByIdMinimal(
        originalProductId
      );
      if (!originalProduct) {
        throw new Error("Original product not found");
      }

      const newRecipes: IProductRecipe[] = [];

      originalProduct.recipes.forEach(async (recipe: IProductRecipe) => {
        const originalRecipe = recipe.recipeId as unknown as IRecipe;
        const steps = originalRecipe.steps.map((step: IRecipeStep) => {
          return {
            deviceTypeId: step.deviceTypeId,
            qualityChecks: step.qualityChecks,
            dependsOn: step.dependsOn,
            mediaIds: step.mediaIds,
            order: step.order,
            name: step.name,
            description: step.description,
            estimatedDuration: step.estimatedDuration
          };
        });
        const rawMaterials = originalRecipe.rawMaterials.map(
          (rawMaterial: IRawMaterialReference) => {
            return {
              ...rawMaterial,
              materialId: new mongoose.Types.ObjectId(),
              quantityRequired: rawMaterial.quantityRequired
            };
          }
        );
        const newRecipe = new Recipe({
          ...originalRecipe,
          product: duplicatedProductId,
          version: 1,
          name: originalRecipe.name,
          description: originalRecipe.description,
          rawMaterials: rawMaterials,
          estimatedDuration: originalRecipe.estimatedDuration,
          steps: steps
        });
        await this.prepareRecipeForSave(newRecipe, true);

        await newRecipe.save();

        newRecipes.push({
          recipeId: newRecipe._id as mongoose.Types.ObjectId,
          quantity: recipe.quantity
        });
      });
      return newRecipes;
    } catch (error) {
      console.error("Error duplicating recipes for product:", error);
      throw error;
    }
  }
}
