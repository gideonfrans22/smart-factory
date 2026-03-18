import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { customerService } from "./customer.service";
import { AuthenticatedRequest, APIResponse } from "@shared/types";

export class CustomerController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await customerService.list(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Customers retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await customerService.getById(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Customer not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Customer retrieved successfully",
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
      const item = await customerService.create(req.body, userId);
      const response: APIResponse = {
        success: true,
        message: "Customer created successfully",
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
          message: "Customer with this name already exists"
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
      const item = await customerService.update(
        req.params.id,
        req.body,
        userId
      );
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Customer not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Customer updated successfully",
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
          message: "Customer with this name already exists"
        };
        res.status(409).json(response);
        return;
      }
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await customerService.remove(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Customer not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Customer deleted successfully"
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();

