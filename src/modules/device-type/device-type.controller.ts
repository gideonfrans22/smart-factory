import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { deviceTypeService } from "./device-type.service";
import { APIResponse } from "@shared/types";

export class DeviceTypeController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await deviceTypeService.list();
      const response: APIResponse = {
        success: true,
        message: "Device types retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      // keep behavior consistent with raw-material (use error middleware)
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid device type ID"
        };
        res.status(400).json(response);
        return;
      }

      const deviceType = await deviceTypeService.getById(id);

      if (!deviceType) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device type not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Device type retrieved successfully",
        data: deviceType
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getDevicesByType(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid device type ID"
        };
        res.status(400).json(response);
        return;
      }

      const result = await deviceTypeService.getDevicesByType(id);

      if (!result) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device type not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Devices retrieved successfully",
        data: result
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableDevicesByType(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid device type ID"
        };
        res.status(400).json(response);
        return;
      }

      const result = await deviceTypeService.getAvailableDevicesByType(id);

      if (!result) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device type not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Available devices retrieved successfully",
        data: result
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.create(req.body);
      const response: APIResponse = {
        success: true,
        message: "Device type created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === 11000 || error.code === "DUPLICATE_DEVICE_TYPE_NAME") {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DEVICE_TYPE_NAME",
          message: "Type name is duplicated"
        };
        res.status(409).json(response);
        return;
      }

      if (error.code === "VALIDATION_ERROR") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message
        };
        res.status(400).json(response);
        return;
      }

      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.update(req.params.id, req.body);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device type not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Device type updated successfully",
        data: item
      };
      res.json(response);
    } catch (error: any) {
      if (error.code === 11000 || error.code === "DUPLICATE_DEVICE_TYPE_NAME") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Device type with this name already exists"
        };
        res.status(400).json(response);
        return;
      }

      if (error.code === "VALIDATION_ERROR") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message
        };
        res.status(400).json(response);
        return;
      }

      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await deviceTypeService.softDelete(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Device type not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Device type deleted successfully",
        data: item
      };

      res.json(response);
    } catch (error: any) {
      if (error.code === "VALIDATION_ERROR") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message
        };
        res.status(400).json(response);
        return;
      }

      if (error.code === "CONFLICT_DEVICE") {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: error.message
        };
        res.status(409).json(response);
        return;
      }

      if (error.code === "CONFLICT_RECIPE") {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: error.message
        };
        res.status(409).json(response);
        return;
      }

      if (error.code === "CONFLICT_TASK") {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: error.message
        };
        res.status(409).json(response);
        return;
      }

      next(error);
    }
  }
}

export const deviceTypeController = new DeviceTypeController();

