import { Response } from "express";
import { Product } from "../models/Product";
import { Recipe } from "../models/Recipe";
import { Project } from "../models/Project";
import ProductSnapshot from "../models/ProductSnapshot";
import RecipeSnapshot from "../models/RecipeSnapshot";
import {
  APIResponse,
  AuthenticatedRequest,
  ImportResult,
  VerifyResult
} from "../types";
import { SnapshotService } from "../services/snapshotService";
import mongoose from "mongoose";
import {
  generateProductImportTemplate,
  parseProductImportWorkbook
} from "../services/productImportService";
import { DeviceType } from "../models/DeviceType";
import { RawMaterial } from "../models/RawMaterial";

// Get all products with pagination and filtering
export const getProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      customerName,
      personInCharge,
      department
    } = req.query;

    const query: any = {};
    if (customerName)
      query.customerName = { $regex: customerName, $options: "i" };
    if (personInCharge) query.personInCharge = personInCharge;
    if (department) query.department = { $regex: department, $options: "i" };
    if (search) {
      query.$or = [
        { designNumber: { $regex: search, $options: "i" } },
        { productName: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Products retrieved successfully",
      data: {
        items: products,
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
    console.error("Get products error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get product by ID
export const getProductById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Product retrieved successfully",
      data: product
    };

    res.json(response);
  } catch (error) {
    console.error("Get product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get all recipes for a product
export const getProductRecipes = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Get all recipe details
    const recipeIds = product.recipes.map((r) => r.recipeId);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } });

    // Combine recipe data with quantity from product
    const recipesWithQuantity = product.recipes.map((pr) => {
      const recipeData = recipes.find((r) => r._id === pr.recipeId);
      return {
        recipe: recipeData,
        quantity: pr.quantity
      };
    });

    const response: APIResponse = {
      success: true,
      message: "Product recipes retrieved successfully",
      data: recipesWithQuantity
    };

    res.json(response);
  } catch (error) {
    console.error("Get product recipes error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Create new product
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes
    } = req.body;

    if (!designNumber || !productName) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Design number and product name are required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate design number format: 00000-00-000-00 (5 chars - 2 digits - 3 digits - 2 digits)
    // 설계번호 형식 검증: 대문자+숫자 5자리 - 숫자 2자리 - 숫자 3자리 - 숫자 2자리
    const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}-[0-9]{2}$/;
    if (!DESIGN_NUMBER_REGEX.test(designNumber)) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요 (예: LKH25-09-001-00)"
      };
      res.status(400).json(response);
      return;
    }

    // Check if design number already exists
    const existingProduct = await Product.findOne({ designNumber });
    if (existingProduct) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Default to current user if personInCharge not provided
    const assignedPersonInCharge = personInCharge || req.user?.username;

    const product = new Product({
      designNumber,
      productName,
      customerName,
      personInCharge: assignedPersonInCharge,
      department,
      quantityUnit,
      recipes: recipes || [],
      modifiedBy: req.user?.id
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id);

    const response: APIResponse = {
      success: true,
      message: "Product created successfully",
      data: populatedProduct
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Update product
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes
    } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate design number format if being updated
    // 설계번호 형식 검증: 대문자+숫자 5자리 - 숫자 2자리 - 숫자 3자리
    const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}$/;
    if (designNumber && !DESIGN_NUMBER_REGEX.test(designNumber)) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000 형식으로 입력해주세요 (예: LKH25-09-001)"
      };
      res.status(400).json(response);
      return;
    }

    // Check if design number is being changed to an existing one
    if (designNumber && designNumber !== product.designNumber) {
      const existingProduct = await Product.findOne({ designNumber });
      if (existingProduct) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DESIGN_NUMBER",
          message: "Design number already exists"
        };
        res.status(400).json(response);
        return;
      }
      product.designNumber = designNumber;

      // Update all recipes with the new design number
      await Recipe.updateMany(
        { product: product._id },
        { $set: { recipeNumber: designNumber } }
      );
    }

    if (productName) product.productName = productName;
    if (customerName !== undefined) product.customerName = customerName;
    if (personInCharge) product.personInCharge = personInCharge;
    if (department !== undefined) product.department = department;
    if (quantityUnit !== undefined) product.quantityUnit = quantityUnit;
    if (recipes !== undefined) product.recipes = recipes;

    // Track who modified the product
    product.modifiedBy = req.user?.id;

    await product.save();

    const populatedProduct = await Product.findById(product._id);

    if (populatedProduct) {
      // Create snapshot for updated product
      await SnapshotService.getOrCreateProductSnapshot(
        populatedProduct._id as mongoose.Types.ObjectId
      );
    }

    const response: APIResponse = {
      success: true,
      message: "Product updated successfully",
      data: populatedProduct
    };

    res.json(response);
  } catch (error) {
    console.error("Update product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Delete product
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if product is used in any project
    const projectsUsingProduct = await Project.findOne({
      "products.productId": id
    });

    if (projectsUsingProduct) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Cannot delete product. It is being used in one or more projects."
      };
      res.status(400).json(response);
      return;
    }

    product.modifiedBy = req.user?.id;
    await product.save();

    await Product.findOneAndDelete({
      _id: id
    });

    const response: APIResponse = {
      success: true,
      message: "Product deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Duplicate product
export const duplicateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { newDesignNumber, newProductName } = req.body;

    // Find the original product
    const originalProduct = await Product.findById(id);

    if (!originalProduct) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate new design number is provided
    if (!newDesignNumber) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "New design number is required for duplication"
      };
      res.status(400).json(response);
      return;
    }

    // Validate design number format: 00000-00-000 (5 chars - 2 digits - 3 digits)
    const DESIGN_NUMBER_REGEX_DUP = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}$/;
    if (!DESIGN_NUMBER_REGEX_DUP.test(newDesignNumber)) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000 형식으로 입력해주세요 (예: LKH25-09-001)"
      };
      res.status(400).json(response);
      return;
    }

    // Check if new design number already exists
    const existingProduct = await Product.findOne({
      designNumber: newDesignNumber
    });
    if (existingProduct) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Create the duplicate product with all recipes and properties
    const duplicatedProduct = new Product({
      designNumber: newDesignNumber,
      productName: newProductName || `${originalProduct.productName} (Copy)`,
      customerName: originalProduct.customerName,
      personInCharge: originalProduct.personInCharge,
      quantityUnit: originalProduct.quantityUnit,
      recipes: originalProduct.recipes.map((recipe) => ({
        recipeId: recipe.recipeId,
        quantity: recipe.quantity
      })),
      modifiedBy: req.user?.id
    });

    await duplicatedProduct.save();

    const populatedProduct = await Product.findById(duplicatedProduct._id);

    const response: APIResponse = {
      success: true,
      message: "Product duplicated successfully",
      data: {
        original: {
          _id: originalProduct._id,
          designNumber: originalProduct.designNumber,
          productName: originalProduct.productName
        },
        duplicate: populatedProduct
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Duplicate product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get product version history
export const getProductVersionHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify the product exists
    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get all product snapshots for this product, sorted by version descending
    const total = await ProductSnapshot.countDocuments({
      originalProductId: id
    });

    const snapshots = await ProductSnapshot.find({
      originalProductId: id
    })
      .populate("modifiedBy", "name username email")
      .sort({ version: -1 })
      .skip(skip)
      .limit(limitNum);

    // For each product snapshot, populate the recipe snapshots
    const versionsWithRecipes = await Promise.all(
      snapshots.map(async (snapshot) => {
        const recipeSnapshotIds = snapshot.recipes.map(
          (r) => r.recipeSnapshotId
        );

        const recipeSnapshots = await RecipeSnapshot.find({
          _id: { $in: recipeSnapshotIds }
        });

        // Map recipes with their quantities and full snapshot data
        const recipesWithDetails = snapshot.recipes.map((pr) => {
          const recipeSnapshot = recipeSnapshots.find(
            (rs) => rs._id.toString() === pr.recipeSnapshotId.toString()
          );

          return {
            recipeSnapshot: recipeSnapshot
              ? {
                  _id: recipeSnapshot._id,
                  originalRecipeId: recipeSnapshot.originalRecipeId,
                  version: recipeSnapshot.version,
                  recipeNumber: recipeSnapshot.recipeNumber,
                  name: recipeSnapshot.name,
                  description: recipeSnapshot.description,
                  specification: recipeSnapshot.specification,
                  estimatedDuration: recipeSnapshot.estimatedDuration,
                  dwgNo: recipeSnapshot.dwgNo,
                  unit: recipeSnapshot.unit,
                  outsourcing: recipeSnapshot.outsourcing,
                  remarks: recipeSnapshot.remarks,
                  steps: recipeSnapshot.steps,
                  rawMaterials: recipeSnapshot.rawMaterials,
                  createdAt: recipeSnapshot.createdAt
                }
              : null,
            quantity: pr.quantity
          };
        });

        return {
          _id: snapshot._id,
          version: snapshot.version,
          productNumber: snapshot.productNumber,
          name: snapshot.name,
          description: snapshot.description,
          customerName: snapshot.customerName,
          personInCharge: snapshot.personInCharge,
          recipes: recipesWithDetails,
          modifiedBy: snapshot.modifiedBy,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt
        };
      })
    );

    const response: APIResponse = {
      success: true,
      message: "Product version history retrieved successfully",
      data: {
        currentProduct: {
          _id: product._id,
          designNumber: product.designNumber,
          productName: product.productName,
          updatedAt: product.updatedAt
        },
        versions: versionsWithRecipes,
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
    console.error("Get product version history error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Restore product to a previous version
export const restoreProductVersion = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, versionId } = req.params;

    // Verify the product exists
    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Find the version snapshot to restore
    const snapshot = await ProductSnapshot.findOne({
      _id: versionId,
      originalProductId: id
    });

    if (!snapshot) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Version snapshot not found"
      };
      res.status(404).json(response);
      return;
    }

    // Create a snapshot of the current product before restoring (to preserve history)
    await SnapshotService.getOrCreateProductSnapshot(
      product._id as mongoose.Types.ObjectId
    );

    // Restore product fields from snapshot
    product.designNumber = snapshot.productNumber || product.designNumber;
    product.productName = snapshot.name;
    product.customerName = snapshot.customerName;
    product.personInCharge = snapshot.personInCharge;
    product.department = snapshot.department;

    // Restore recipe associations
    // Get the original recipe IDs from the recipe snapshots
    const recipeSnapshotIds = snapshot.recipes.map((r) => r.recipeSnapshotId);
    const recipeSnapshots = await RecipeSnapshot.find({
      _id: { $in: recipeSnapshotIds }
    });

    // Map recipe snapshots to their original recipe IDs and quantities
    const restoredRecipes = snapshot.recipes.map((pr) => {
      const recipeSnapshot = recipeSnapshots.find(
        (rs) => rs._id.toString() === pr.recipeSnapshotId.toString()
      );

      if (!recipeSnapshot) {
        throw new Error(
          `Recipe snapshot ${pr.recipeSnapshotId} not found for restoration`
        );
      }

      return {
        recipeId: recipeSnapshot.originalRecipeId,
        quantity: pr.quantity
      };
    });

    product.recipes = restoredRecipes;
    product.modifiedBy = req.user?.id;

    await product.save();

    const populatedProduct = await Product.findById(product._id);

    const response: APIResponse = {
      success: true,
      message: "Product restored successfully",
      data: populatedProduct
    };

    res.json(response);
  } catch (error) {
    console.error("Restore product version error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const downloadProductImportTemplate = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const workbook = await generateProductImportTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="product-import-template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Download product import template error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to generate product import template."
    };
    res.status(500).json(response);
  }
};

export const verifyProductImport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      const response: APIResponse = {
        success: false,
        error: "FILE_REQUIRED",
        message: "No file uploaded."
      };
      res.status(400).json(response);
      return;
    }

    const parsed = await parseProductImportWorkbook(req.file.buffer);

    const designNumbers = parsed.products.map((p) => p.designNumber);
    const existingProducts = await Product.find({
      designNumber: { $in: designNumbers },
      deletedAt: null
    }).lean();
    const existingDesigns = new Set(
      existingProducts.map((p: any) => p.designNumber)
    );

    let productsToCreate = 0;
    let productsToUpdate = 0;
    parsed.products.forEach((p) => {
      if (existingDesigns.has(p.designNumber)) {
        productsToUpdate++;
      } else {
        productsToCreate++;
      }
    });

    const hardErrors = parsed.errors.filter((e) => e.severity === "error");

    const result: VerifyResult = {
      valid: hardErrors.length === 0,
      summary: {
        productsFound: parsed.products.length,
        recipesFound: parsed.recipes.length,
        stepsFound: parsed.steps.length,
        rawMaterialsFound: parsed.recipeMaterials.length,
        specificationsFound: 0,
        errors: parsed.errors
      }
    };

    const response: APIResponse<VerifyResult> = {
      success: true,
      message: "Product import verification completed.",
      data: result
    };

    res.status(hardErrors.length > 0 ? 400 : 200).json(response);
  } catch (error) {
    console.error("Verify product import error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred during import verification."
    };
    res.status(500).json(response);
  }
};

export const importProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      const response: APIResponse = {
        success: false,
        error: "FILE_REQUIRED",
        message: "No file uploaded."
      };
      res.status(400).json(response);
      return;
    }

    const parsed = await parseProductImportWorkbook(req.file.buffer);
    const hardErrors = parsed.errors.filter((e) => e.severity === "error");

    if (hardErrors.length > 0) {
      const verifyResult: VerifyResult = {
        valid: false,
        summary: {
          productsFound: parsed.products.length,
          recipesFound: parsed.recipes.length,
          stepsFound: parsed.steps.length,
          rawMaterialsFound: parsed.recipeMaterials.length,
          specificationsFound: 0,
          errors: parsed.errors
        }
      };

      const response: APIResponse<VerifyResult> = {
        success: false,
        message: "Import failed due to validation errors. No data was written.",
        data: verifyResult,
        error: "VALIDATION_ERROR"
      };

      res.status(400).json(response);
      return;
    }

    const session = await mongoose.startSession();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    await session.withTransaction(async () => {
      // Resolve DeviceTypes
      const allDeviceTypeNames = Array.from(
        new Set(parsed.steps.map((s) => s.deviceTypeName))
      );
      const deviceTypes = await DeviceType.find(
        { name: { $in: allDeviceTypeNames } },
        null,
        { session }
      );
      const deviceTypeMap = new Map<string, mongoose.Types.ObjectId>();
      deviceTypes.forEach((dt) =>
        deviceTypeMap.set(dt.name, dt._id as mongoose.Types.ObjectId)
      );

      // Resolve RawMaterials
      const allMaterialNames = Array.from(
        new Set(parsed.recipeMaterials.map((rm) => rm.materialName))
      );
      const materials = await RawMaterial.find(
        { name: { $in: allMaterialNames } },
        null,
        { session }
      );
      const materialMap = new Map<string, any>();
      materials.forEach((m) => materialMap.set(m.name, m));

      // Upsert Products
      const productIdByDesignNumber = new Map<
        string,
        mongoose.Types.ObjectId
      >();
      for (const p of parsed.products) {
        const updatedProduct = await Product.findOneAndUpdate(
          { designNumber: p.designNumber, deletedAt: null },
          {
            $set: {
              productName: p.productName,
              customerName: p.customerName,
              personInCharge: p.personInCharge,
              department: p.department,
              quantityUnit: p.quantityUnit,
              modifiedBy: req.user?._id
            }
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            session
          }
        );

        if (updatedProduct.isNew) {
          created++;
        } else {
          updated++;
        }

        productIdByDesignNumber.set(
          updatedProduct.designNumber,
          updatedProduct._id as mongoose.Types.ObjectId
        );
      }

      // Create Recipes
      for (const recipeRow of parsed.recipes) {
        const productId = productIdByDesignNumber.get(
          recipeRow.productDesignNumber
        );
        if (!productId) {
          skipped++;
          continue;
        }

        const stepsForRecipe = parsed.steps.filter(
          (s) => s.recipeName === recipeRow.recipeName
        );
        const materialsForRecipe = parsed.recipeMaterials.filter(
          (rm) => rm.recipeName === recipeRow.recipeName
        );

        const stepIdMap = new Map<number, mongoose.Types.ObjectId>();
        const steps = stepsForRecipe.map((s) => {
          const newId = new mongoose.Types.ObjectId();
          stepIdMap.set(s.stepOrder, newId);
          return {
            _id: newId,
            order: s.stepOrder,
            name: s.stepName,
            description: s.stepDescription ?? "",
            estimatedDuration: s.estimatedDurationMin,
            deviceTypeId: deviceTypeMap.get(s.deviceTypeName),
            qualityChecks: s.qualityChecks,
            dependsOn: [] as mongoose.Types.ObjectId[],
            mediaIds: []
          };
        });

        steps.forEach((step, index) => {
          const src = stepsForRecipe[index];
          step.dependsOn = src.dependsOnStepOrders.map((order) => {
            const depId = stepIdMap.get(order);
            if (!depId) {
              throw new Error(
                `Step order '${order}' not found for recipe '${recipeRow.recipeName}'.`
              );
            }
            return depId;
          });
        });

        const rawMaterials = materialsForRecipe.map((rm) => {
          const materialDoc = materialMap.get(rm.materialName);
          return {
            materialId: materialDoc?._id,
            quantityRequired: rm.quantityRequired,
            specification: {
              color: rm.spec.color,
              dimensions: {
                length: rm.spec.dim_length,
                width: rm.spec.dim_width,
                height: rm.spec.dim_height,
                unit: rm.spec.dim_unit
              },
              weight: {
                value: rm.spec.weight_value,
                unit: rm.spec.weight_unit
              }
            }
          };
        });

        const recipe = new Recipe({
          name: recipeRow.recipeName,
          description: recipeRow.description,
          dwgNo: recipeRow.dwgNo,
          unit: recipeRow.unit ?? "EA",
          outsourcing: recipeRow.outsourcing,
          remarks: recipeRow.remarks,
          product: productId,
          steps,
          rawMaterials,
          estimatedDuration: 0,
          modifiedBy: req.user?._id
        });

        await recipe.save({ session });

        await Product.findByIdAndUpdate(
          productId,
          {
            $push: {
              recipes: {
                recipeId: recipe._id,
                quantity: 1
              }
            }
          },
          { session }
        );
      }
    });

    await session.endSession();

    const result: ImportResult = {
      success: true,
      summary: {
        created,
        updated,
        skipped,
        errors: parsed.errors
      }
    };

    const response: APIResponse<ImportResult> = {
      success: true,
      message: "Import completed successfully.",
      data: result
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Import products error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred during import. Please try again."
    };
    res.status(500).json(response);
  }
};
