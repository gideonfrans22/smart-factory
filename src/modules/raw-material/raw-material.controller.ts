import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { rawMaterialService } from "./raw-material.service";
import { generateRawMaterialTemplate, parseRawMaterialWorkbook } from "./raw-material.import.service";
import { AuthenticatedRequest, APIResponse, ImportResult, VerifyResult } from "@shared/types";
import { importUpload } from "@shared/middleware";
import { runMiddleware } from "@shared/utils";

export class RawMaterialController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await rawMaterialService.list(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Raw materials retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await rawMaterialService.getById(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Raw material not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Raw material retrieved successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const item = await rawMaterialService.create(req.body, userId);
      const response: APIResponse = {
        success: true,
        message: "Raw material created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message
        };
        res.status(400).json(response);
        return;
      }
      if (error.code === 11000 || error.code === "DUPLICATE_NAME") {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_ERROR",
          message: "Raw material already exists"
        };
        res.status(409).json(response);
        return;
      }
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const item = await rawMaterialService.update(
        req.params.id,
        req.body,
        userId
      );
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Raw material not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Raw material updated successfully",
        data: item
      };
      res.json(response);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message
        };
        res.status(400).json(response);
        return;
      }
      if (error.code === 11000 || error.code === "DUPLICATE_NAME") {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_ERROR",
          message: "Raw material already exists"
        };
        res.status(409).json(response);
        return;
      }
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await rawMaterialService.remove(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Raw material not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Raw material deleted successfully"
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async downloadTemplate(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const workbook = await generateRawMaterialTemplate();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="raw-materials-import-template.xlsx"'
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }

  async verifyImport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
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

      const parsed = await parseRawMaterialWorkbook(req.file.buffer);
      const verified = await rawMaterialService.verifyParsedImport(parsed);

      const hardErrors = verified.errors.filter((e) => e.severity === "error");

      const result: VerifyResult = {
        valid: hardErrors.length === 0,
        summary: {
          rawMaterialsFound: verified.materials.length,
          specificationsFound: 0,
          errors: verified.errors
        }
      };

      const response: APIResponse<VerifyResult> = {
        success: true,
        message: "Raw material import verification completed.",
        data: result
      };

      res.status(hardErrors.length > 0 ? 400 : 200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async import(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

      const parsed = await parseRawMaterialWorkbook(req.file.buffer);
      const verified = await rawMaterialService.verifyParsedImport(parsed);
      const hardErrors = verified.errors.filter((e) => e.severity === "error");

      if (hardErrors.length > 0) {
        const verifyResult: VerifyResult = {
          valid: false,
          summary: {
            rawMaterialsFound: verified.materials.length,
            specificationsFound: 0,
            errors: verified.errors
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

      const summary = await rawMaterialService.importFromParsedData(
        verified,
        req.user?._id as mongoose.Types.ObjectId | undefined,
        req.file?.originalname
      );

      const result: ImportResult = {
        success: true,
        summary
      };

      const response: APIResponse<ImportResult> = {
        success: true,
        message: "Import completed successfully.",
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const rawMaterialController = new RawMaterialController();
