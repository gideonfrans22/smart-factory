import { Response } from "express";
import mongoose from "mongoose";
import {
  rawMaterialTypeService,
  RawMaterialTypeServiceError
} from "./raw-material-type.service";
import type {
  RawMaterialTypeCreateInput,
  RawMaterialTypeListQueryInput,
  RawMaterialTypeUpdateInput
} from "./raw-material-type.validators";
import { APIResponse, AuthenticatedRequest } from "@shared/types";

function handleRawMaterialTypeError(
  res: Response,
  error: unknown,
  logLabel: string
): void {
  console.error(`${logLabel}:`, error);
  if (error instanceof RawMaterialTypeServiceError) {
    const response: APIResponse = {
      success: false,
      error: error.errorCode,
      message: error.message,
      ...(error.data !== undefined && { data: error.data as unknown })
    };
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

export class RawMaterialTypeController {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const q = req.query as unknown as RawMaterialTypeListQueryInput;
      const result = await rawMaterialTypeService.list({
        page: q.page,
        limit: q.limit,
        search: q.search
      });
      const response: APIResponse = {
        success: true,
        message: "Raw material types retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      handleRawMaterialTypeError(res, error, "rawMaterialType.list");
    }
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const item = await rawMaterialTypeService.getById(id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Raw material type not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Raw material type retrieved successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      handleRawMaterialTypeError(res, error, "rawMaterialType.getById");
    }
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const body = req.body as RawMaterialTypeCreateInput;
      const item = await rawMaterialTypeService.create(body, userId);
      const response: APIResponse = {
        success: true,
        message: "Raw material type created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error) {
      handleRawMaterialTypeError(res, error, "rawMaterialType.create");
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const { id } = req.params;
      const body = req.body as RawMaterialTypeUpdateInput;
      const item = await rawMaterialTypeService.update(id, body, userId);
      const response: APIResponse = {
        success: true,
        message: "Raw material type updated successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      handleRawMaterialTypeError(res, error, "rawMaterialType.update");
    }
  }

  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const { id } = req.params;
      const item = await rawMaterialTypeService.softDelete(id, userId);
      const response: APIResponse = {
        success: true,
        message: "Raw material type deleted successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      handleRawMaterialTypeError(res, error, "rawMaterialType.remove");
    }
  }
}

export const rawMaterialTypeController = new RawMaterialTypeController();
