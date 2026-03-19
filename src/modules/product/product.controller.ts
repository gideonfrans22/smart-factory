import { Response } from "express";
import mongoose from "mongoose";
import { Product } from "./product.model";
import { Recipe } from "@modules/recipe";
import { DeviceType } from "@modules/device-type";
import { RawMaterial } from "@modules/raw-material";
import { ActivityLog } from "../../models/ActivityLog";
import { parseProductImportWorkbook } from "./product.import.service";
import { importUpload } from "@shared/middleware";
import { runMiddleware } from "@shared/utils";
import {
  APIResponse,
  AuthenticatedRequest,
  ImportResult,
  VerifyResult
} from "@shared/types";
import { productService, ProductServiceError } from "./product.service";

export class ProductController {
  // Get all products with pagination and filtering
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        customerName,
        personInCharge,
        department
      } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const data = await productService.listProducts({
        page: pageNum,
        limit: limitNum,
        search: search as string | undefined,
        customerName: customerName as string | undefined,
        personInCharge: personInCharge as string | undefined,
        department: department as string | undefined
      });

      const response: APIResponse = {
        success: true,
        message: "Products retrieved successfully",
        data
      };

      res.json(response);
    } catch (error) {
      console.error("Get products error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Get product by ID
  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      const response: APIResponse = {
        success: true,
        message: "Product retrieved successfully",
        data: product
      };

      res.json(response);
    } catch (error) {
      console.error("Get product error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Get all recipes for a product
  async getRecipes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const recipesWithQuantity = await productService.getProductRecipes(id);

      const response: APIResponse = {
        success: true,
        message: "Product recipes retrieved successfully",
        data: recipesWithQuantity
      };

      res.json(response);
    } catch (error) {
      console.error("Get product recipes error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Create new product
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const populatedProduct = await productService.createProduct({
        designNumber,
        productName,
        customerName,
        personInCharge,
        department,
        quantityUnit,
        recipes,
        userId: req.user?.id,
        username: req.user?.username
      });

      const response: APIResponse = {
        success: true,
        message: "Product created successfully",
        data: populatedProduct
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Create product error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Update product
  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const populatedProduct = await productService.updateProduct({
        id,
        designNumber,
        productName,
        customerName,
        personInCharge,
        department,
        quantityUnit,
        recipes,
        userId: req.user?.id
      });

      const response: APIResponse = {
        success: true,
        message: "Product updated successfully",
        data: populatedProduct
      };

      res.json(response);
    } catch (error) {
      console.error("Update product error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Delete product
  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await productService.deleteProduct({ id, userId: req.user?.id });

      const response: APIResponse = {
        success: true,
        message: "Product deleted successfully"
      };

      res.json(response);
    } catch (error) {
      console.error("Delete product error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Duplicate product
  async duplicate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newDesignNumber, newProductName } = req.body;
      const data = await productService.duplicateProduct({
        id,
        newDesignNumber,
        newProductName,
        userId: req.user?.id
      });

      const response: APIResponse = {
        success: true,
        message: "Product duplicated successfully",
        data
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Duplicate product error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Get product version history
  async getVersionHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const data = await productService.getVersionHistory({
        id,
        page: pageNum,
        limit: limitNum
      });

      const response: APIResponse = {
        success: true,
        message: "Product version history retrieved successfully",
        data
      };

      res.json(response);
    } catch (error) {
      console.error("Get product version history error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  // Restore product to a previous version
  async restoreVersion(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id, versionId } = req.params;
      const populatedProduct = await productService.restoreVersion({
        id,
        versionId,
        userId: req.user?.id
      });

      const response: APIResponse = {
        success: true,
        message: "Product restored successfully",
        data: populatedProduct
      };

      res.json(response);
    } catch (error) {
      console.error("Restore product version error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  async downloadTemplate(
    _req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const workbook = await productService.downloadTemplateWorkbook();
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
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate product import template."
      };
      res.status(500).json(response);
    }
  }

  async verifyImport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      try {
        await runMiddleware(req as any, res, importUpload as any);
      } catch (err: any) {
        const response: APIResponse = {
          success: false,
          error: "FILE_ERROR",
          message: err?.message || "Failed to process uploaded file."
        };
        res.status(400).json(response);
        return;
      }

      if (!req.file || !req.file.buffer) {
        const response: APIResponse = {
          success: false,
          error: "FILE_REQUIRED",
          message: "No file uploaded."
        };
        res.status(400).json(response);
        return;
      }

      const { result, hasHardErrors } = await productService.verifyImport({
        buffer: req.file.buffer
      });

      const response: APIResponse<VerifyResult> = {
        success: true,
        message: "Product import verification completed.",
        data: result
      };

      res.status(hasHardErrors ? 400 : 200).json(response);
    } catch (error) {
      console.error("Verify product import error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }

      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred during import verification."
      };
      res.status(500).json(response);
    }
  }

  async import(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      try {
        await runMiddleware(req as any, res, importUpload as any);
      } catch (err: any) {
        const response: APIResponse = {
          success: false,
          error: "FILE_ERROR",
          message: err?.message || "Failed to process uploaded file."
        };
        res.status(400).json(response);
        return;
      }

      if (!req.file || !req.file.buffer) {
        const response: APIResponse = {
          success: false,
          error: "FILE_REQUIRED",
          message: "No file uploaded."
        };
        res.status(400).json(response);
        return;
      }

      const importResult: ImportResult = await productService.importProducts({
        buffer: req.file.buffer,
        mongoUserId: req.user?._id as any,
        fileName: req.file?.originalname
      });

      const importResponse: APIResponse<ImportResult> = {
        success: true,
        message: "Import completed successfully.",
        data: importResult
      };

      res.status(200).json(importResponse);
      return;

      const parsed = await parseProductImportWorkbook(req.file!.buffer);
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
          message:
            "Import failed due to validation errors. No data was written.",
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

      try {
        await ActivityLog.create({
          userId: req.user?._id,
          action: "BULK_IMPORT",
          resourceType: "Product",
          resourceId: null,
          details: {
            created: result.summary.created,
            updated: result.summary.updated,
            skipped: result.summary.skipped,
            fileName: req.file?.originalname
          },
          success: true,
          modifiedBy: req.user?._id
        });
      } catch (logError) {
        console.error("ActivityLog error (Product import):", logError);
      }

      const response: APIResponse<ImportResult> = {
        success: true,
        message: "Import completed successfully.",
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Import products error:", error);
      if (error instanceof ProductServiceError) {
        const response: APIResponse = {
          success: false,
          error: error.errorCode,
          message: error.message
        };
        if (error.data !== undefined) {
          response.data = error.data;
        }
        res.status(error.statusCode).json(response);
        return;
      }
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred during import. Please try again."
      };
      res.status(500).json(response);
    }
  }
}

export const productController = new ProductController();
