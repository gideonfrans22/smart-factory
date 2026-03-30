import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { recipeService } from "./recipe.service";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
export class RecipeController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await recipeService.list(req.query as any);
      const response: APIResponse = {
        success: true,
        message: "Recipes retrieved successfully",
        data: result
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await recipeService.getById(req.params.id);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Recipe not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Recipe retrieved successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getByRecipeNumber(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const version = (req.query as any).version as number | undefined;
      const item = await recipeService.getByRecipeNumber(
        req.params.recipeNumber,
        version
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Recipe not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Recipe retrieved successfully",
        data: item
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = (req.user?._id || (req.user as any)?.id) as
        | mongoose.Types.ObjectId
        | undefined;
      const item = await recipeService.create(req.body, userId);
      const response: APIResponse = {
        success: true,
        message: "Recipe created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error: any) {
      if (error?.status && error?.code) {
        const response: APIResponse = {
          success: false,
          error: error.code,
          message: error.message
        };
        res.status(error.status).json(response);
        return;
      }
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = (req.user?._id || (req.user as any)?.id) as
        | mongoose.Types.ObjectId
        | undefined;
      const item = await recipeService.update(req.params.id, req.body, userId);
      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Recipe not found"
        };
        res.status(404).json(response);
        return;
      }
      const response: APIResponse = {
        success: true,
        message: "Recipe updated successfully",
        data: item
      };
      res.json(response);
    } catch (error: any) {
      if (error?.status && error?.code) {
        const response: APIResponse = {
          success: false,
          error: error.code,
          message: error.message
        };
        res.status(error.status).json(response);
        return;
      }
      next(error);
    }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = (req.user?._id || (req.user as any)?.id) as
        | mongoose.Types.ObjectId
        | undefined;
      const result = await recipeService.remove(req.params.id, userId);

      if (!result.deleted && result.reason === "NOT_FOUND") {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Recipe not found"
        };
        res.status(404).json(response);
        return;
      }

      if (!result.deleted && result.reason === "IN_USE") {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message:
            "Cannot delete recipe. It is being used in one or more projects."
        };
        res.status(400).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "Recipe deleted successfully"
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async createVersion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = (req.user?._id || (req.user as any)?.id) as
        | mongoose.Types.ObjectId
        | undefined;
      const item = await recipeService.createVersion(
        req.params.id,
        req.body,
        userId
      );

      if (!item) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Recipe not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: "New recipe version created successfully",
        data: item
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}
export const recipeController = new RecipeController();
