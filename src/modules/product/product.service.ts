import mongoose from "mongoose";
import { Product } from "./product.model";
import { ProductSnapshot } from "./product-snapshot.model";
import { Recipe, RecipeSnapshot } from "@modules/recipe";
import { DeviceType } from "@modules/device-type";
import { RawMaterial } from "@modules/raw-material";
import { Project } from "@modules/project";
import { ActivityLog } from "@shared/models/ActivityLog";
import { SnapshotService } from "@shared/services/snapshotService";
import {
  generateProductImportTemplate,
  parseProductImportWorkbook
} from "./product.import.service";
import { ImportResult, VerifyResult } from "@shared/types";

export class ProductServiceError extends Error {
  statusCode: number;
  errorCode: string;
  data?: unknown;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    data?: unknown;
  }) {
    super(options.message);
    this.name = "ProductServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

export class ProductService {
  async listProducts(params: {
    page: number;
    limit: number;
    search?: string;
    customerName?: string;
    personInCharge?: string;
    department?: string;
  }) {
    const { page, limit, search, customerName, personInCharge, department } =
      params;

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

    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(query);
    const items = await Product.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async getProductById(id: string) {
    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }
    return product;
  }

  async getProductRecipes(id: string) {
    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    const recipeIds = product.recipes.map((r) => r.recipeId);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } });

    const recipesWithQuantity = product.recipes.map((pr) => {
      const recipeData = recipes.find(
        (r: any) => r._id.toString() === pr.recipeId.toString()
      );
      return {
        recipe: recipeData,
        quantity: pr.quantity
      };
    });

    return recipesWithQuantity;
  }

  async createProduct(params: {
    designNumber: string;
    productName: string;
    customerName?: string;
    personInCharge?: string;
    department?: string;
    quantityUnit?: string;
    recipes?: Array<{ recipeId: string; quantity: number }>;
    userId?: any;
    username?: string;
  }) {
    const {
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes,
      userId,
      username
    } = params;

    if (!designNumber || !productName) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Design number and product name are required"
      });
    }

    const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}-[0-9]{2}$/;
    if (!DESIGN_NUMBER_REGEX.test(designNumber)) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요 (예: LKH25-09-001-00)"
      });
    }

    const existingProduct = await Product.findOne({ designNumber });
    if (existingProduct) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      });
    }

    const assignedPersonInCharge = personInCharge || username;

    const product = new Product({
      designNumber,
      productName,
      customerName,
      personInCharge: assignedPersonInCharge,
      department,
      quantityUnit,
      recipes: recipes || [],
      modifiedBy: userId
    });

    await product.save();

    return Product.findById(product._id);
  }

  async updateProduct(params: {
    id: string;
    designNumber?: string;
    productName?: string;
    customerName?: string;
    personInCharge?: string;
    department?: string;
    quantityUnit?: string;
    recipes?: Array<{ recipeId: string; quantity: number }>;
    userId?: any;
  }) {
    const {
      id,
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes,
      userId
    } = params;

    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}-[0-9]{2}$/;
    if (designNumber && !DESIGN_NUMBER_REGEX.test(designNumber)) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요 (예: LKH25-09-001-00)"
      });
    }

    if (designNumber && designNumber !== product.designNumber) {
      const existingProduct = await Product.findOne({ designNumber });
      if (existingProduct) {
        throw new ProductServiceError({
          statusCode: 400,
          errorCode: "DUPLICATE_DESIGN_NUMBER",
          message: "Design number already exists"
        });
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
    if (recipes !== undefined) product.recipes = recipes as any;

    product.modifiedBy = userId;
    await product.save();

    const populatedProduct = await Product.findById(product._id);
    if (populatedProduct) {
      await SnapshotService.getOrCreateProductSnapshot(
        populatedProduct._id as mongoose.Types.ObjectId
      );
    }

    return populatedProduct;
  }

  async deleteProduct(params: { id: string; userId?: any }) {
    const { id, userId } = params;

    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    const projectsUsingProduct = await Project.findOne({
      "products.productId": id
    });

    if (projectsUsingProduct) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message:
          "Cannot delete product. It is being used in one or more projects."
      });
    }

    product.modifiedBy = userId;
    await product.save();

    await Product.findOneAndDelete({ _id: id });
  }

  async duplicateProduct(params: {
    id: string;
    newDesignNumber?: string;
    newProductName?: string;
    userId?: any;
  }) {
    const { id, newDesignNumber, newProductName, userId } = params;

    const originalProduct = await Product.findById(id);
    if (!originalProduct) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    if (!newDesignNumber) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "New design number is required for duplication"
      });
    }

    // Validate design number format: 00000-00-000 (5 chars - 2 digits - 3 digits)
    const DESIGN_NUMBER_REGEX_DUP = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}$/;
    if (!DESIGN_NUMBER_REGEX_DUP.test(newDesignNumber)) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "INVALID_FORMAT",
        message:
          "설계번호 형식이 올바르지 않습니다. 00000-00-000 형식으로 입력해주세요 (예: LKH25-09-001)"
      });
    }

    const existingProduct = await Product.findOne({
      designNumber: newDesignNumber
    });
    if (existingProduct) {
      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      });
    }

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
      modifiedBy: userId
    });

    await duplicatedProduct.save();

    const populatedProduct = await Product.findById(duplicatedProduct._id);

    return {
      original: {
        _id: originalProduct._id,
        designNumber: originalProduct.designNumber,
        productName: originalProduct.productName
      },
      duplicate: populatedProduct
    };
  }

  async getVersionHistory(params: { id: string; page: number; limit: number }) {
    const { id, page, limit } = params;

    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    const skip = (page - 1) * limit;

    const total = await ProductSnapshot.countDocuments({
      originalProductId: id
    });

    const snapshots = await ProductSnapshot.find({
      originalProductId: id
    })
      .populate("modifiedBy", "name username email")
      .sort({ version: -1 })
      .skip(skip)
      .limit(limit);

    const versionsWithRecipes = await Promise.all(
      snapshots.map(async (snapshot) => {
        const recipeSnapshotIds = snapshot.recipes.map(
          (r) => r.recipeSnapshotId
        );

        const recipeSnapshots = await RecipeSnapshot.find({
          _id: { $in: recipeSnapshotIds }
        });

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

    return {
      currentProduct: {
        _id: product._id,
        designNumber: product.designNumber,
        productName: product.productName,
        updatedAt: product.updatedAt
      },
      versions: versionsWithRecipes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async restoreVersion(params: {
    id: string;
    versionId: string;
    userId?: any;
  }) {
    const { id, versionId, userId } = params;

    const product = await Product.findById(id);
    if (!product) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Product not found"
      });
    }

    const snapshot = await ProductSnapshot.findOne({
      _id: versionId,
      originalProductId: id
    });

    if (!snapshot) {
      throw new ProductServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Version snapshot not found"
      });
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
    const recipeSnapshotIds = snapshot.recipes.map((r) => r.recipeSnapshotId);
    const recipeSnapshots = await RecipeSnapshot.find({
      _id: { $in: recipeSnapshotIds }
    });

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
    product.modifiedBy = userId;

    await product.save();

    return Product.findById(product._id);
  }

  async downloadTemplateWorkbook() {
    return generateProductImportTemplate();
  }

  async verifyImport(params: { buffer: Buffer | Uint8Array | ArrayBuffer }) {
    const { buffer } = params;

    const parsed = await parseProductImportWorkbook(buffer);
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

    return {
      result,
      hasHardErrors: hardErrors.length > 0,
      productsToCreate,
      productsToUpdate
    };
  }

  async importProducts(params: {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    userId?: any;
    mongoUserId?: mongoose.Types.ObjectId;
    fileName?: string;
  }): Promise<ImportResult> {
    const { buffer, mongoUserId, fileName } = params;

    const parsed = await parseProductImportWorkbook(buffer);
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

      throw new ProductServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Import failed due to validation errors. No data was written.",
        data: verifyResult
      });
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

      // Resolve RawMaterials (by id from new template, or legacy name)
      const allMaterialIds = Array.from(
        new Set(
          parsed.recipeMaterials
            .map((rm) => rm.rawMaterialId)
            .filter(
              (id): id is string =>
                typeof id === "string" &&
                id.length > 0 &&
                mongoose.Types.ObjectId.isValid(id)
            )
        )
      );
      const allMaterialNames = Array.from(
        new Set(
          parsed.recipeMaterials
            .map((rm) => rm.materialName)
            .filter((n): n is string => typeof n === "string" && n.length > 0)
        )
      );
      const materialOr: Array<
        | { _id: { $in: mongoose.Types.ObjectId[] } }
        | { name: { $in: string[] } }
      > = [];
      if (allMaterialIds.length > 0) {
        materialOr.push({
          _id: {
            $in: allMaterialIds.map((id) => new mongoose.Types.ObjectId(id))
          }
        });
      }
      if (allMaterialNames.length > 0) {
        materialOr.push({ name: { $in: allMaterialNames } });
      }
      const materials =
        materialOr.length > 0
          ? await RawMaterial.find({ $or: materialOr }, null, { session })
          : [];
      const materialMapById = new Map<string, any>();
      const materialMapByName = new Map<string, any>();
      materials.forEach((m) => {
        materialMapById.set((m._id as mongoose.Types.ObjectId).toString(), m);
        if ((m as any).name) {
          materialMapByName.set((m as any).name, m);
        }
      });

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
              modifiedBy: mongoUserId
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
          const materialDoc = rm.rawMaterialId
            ? materialMapById.get(rm.rawMaterialId)
            : rm.materialName
              ? materialMapByName.get(rm.materialName)
              : undefined;
          if (!materialDoc?._id) {
            throw new Error(
              `Raw material not found for recipe '${recipeRow.recipeName}' (rawMaterialId or materialName).`
            );
          }
          return {
            materialId: materialDoc._id,
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
          modifiedBy: mongoUserId
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

    try {
      await ActivityLog.create({
        userId: mongoUserId,
        action: "BULK_IMPORT",
        resourceType: "Product",
        resourceId: null,
        details: {
          created: result.summary.created,
          updated: result.summary.updated,
          skipped: result.summary.skipped,
          fileName
        },
        success: true,
        modifiedBy: mongoUserId
      });
    } catch (logError) {
      console.error("ActivityLog error (Product import):", logError);
    }

    return result;
  }
}

export const productService = new ProductService();
