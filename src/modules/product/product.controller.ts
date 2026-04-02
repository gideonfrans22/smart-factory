import { importUpload } from "@shared/middleware";
import {
  APIResponse,
  AuthenticatedRequest,
  ImportResult,
  VerifyResult
} from "@shared/types";
import { runMiddleware } from "@shared/utils";
import { Response } from "express";
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
