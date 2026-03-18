import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { gridLayoutService } from "./grid-layout.service";
import {
  gridLayoutListQuerySchema,
  gridLayoutCreateSchema,
  gridLayoutUpdateSchema,
  gridLayoutIdParamSchema,
  deviceIdParamSchema,
  bulkDeviceUpdateSchema,
  devicePositionUpdateSchema
} from "./grid-layout.validators";
import { AuthenticatedRequest, APIResponse } from "@shared/types";

export class GridLayoutController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryResult = gridLayoutListQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          errors: queryResult.error.flatten().fieldErrors
        } as APIResponse);
        return;
      }

      const result = await gridLayoutService.list(queryResult.data);
      const response: APIResponse = {
        success: true,
        message: "Grid layouts retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = gridLayoutIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid ID parameter"
        } as APIResponse);
        return;
      }

      const item = await gridLayoutService.getById(paramResult.data.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Grid layout retrieved successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bodyResult = gridLayoutCreateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          errors: bodyResult.error.flatten().fieldErrors
        } as APIResponse);
        return;
      }

      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const data = bodyResult.data;
      
      const createData = {
        ...data,
        devices: data.devices?.map((d: any) => ({
          ...d,
          deviceId: new mongoose.Types.ObjectId(d.deviceId)
        }))
      };
      
      const item = await gridLayoutService.create(createData, userId);

      const response: APIResponse = {
        success: true,
        message: "Grid layout created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = gridLayoutIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid ID parameter"
        } as APIResponse);
        return;
      }

      const bodyResult = gridLayoutUpdateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          errors: bodyResult.error.flatten().fieldErrors
        } as APIResponse);
        return;
      }

      const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
      const data = bodyResult.data;
      
      const updateData = {
        ...data,
        devices: data.devices?.map((d: any) => ({
          ...d,
          deviceId: new mongoose.Types.ObjectId(d.deviceId)
        }))
      };
      
      const item = await gridLayoutService.update(
        paramResult.data.id,
        updateData,
        userId
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Grid layout updated successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateDevicePosition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paramResult = deviceIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid ID parameters"
        } as APIResponse);
        return;
      }

      const bodyResult = devicePositionUpdateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          errors: bodyResult.error.flatten().fieldErrors
        } as APIResponse);
        return;
      }

      const item = await gridLayoutService.updateDevicePosition(
        paramResult.data.id,
        paramResult.data.deviceId,
        bodyResult.data
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Device position updated successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateDevicePositions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paramResult = gridLayoutIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid ID parameter"
        } as APIResponse);
        return;
      }

      const bodyResult = bulkDeviceUpdateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          errors: bodyResult.error.flatten().fieldErrors
        } as APIResponse);
        return;
      }

      const item = await gridLayoutService.bulkUpdateDevicePositions(
        paramResult.data.id,
        bodyResult.data.devices
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Device positions updated successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramResult = gridLayoutIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid ID parameter"
        } as APIResponse);
        return;
      }

      const item = await gridLayoutService.remove(paramResult.data.id);

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Grid layout not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Grid layout deleted successfully"
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const gridLayoutController = new GridLayoutController();
