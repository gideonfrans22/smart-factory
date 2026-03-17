import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest, APIResponse } from "../../types";
import { authService } from "./auth.service";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req as any).validatedBody ?? req.body;
      const result = await authService.register(payload);
      const response: APIResponse = {
        success: true,
        message: "User registered successfully",
        data: result
      };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === "CONFLICT") {
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

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req as any).validatedBody ?? req.body;
      const result = await authService.login(payload);
      const response: APIResponse = {
        success: true,
        message: "Login successful",
        data: result
      };
      res.json(response);
    } catch (error: any) {
      if (error.code === "INVALID_CREDENTIALS") {
        const response: APIResponse = {
          success: false,
          error: "UNAUTHORIZED",
          message: error.message
        };
        res.status(401).json(response);
        return;
      }
      next(error);
    }
  }

  async workerLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req as any).validatedBody ?? req.body;
      const result = await authService.workerLogin(payload);
      const response: APIResponse = {
        success: true,
        message: "Worker login successful",
        data: result
      };
      res.json(response);
    } catch (error: any) {
      if (error.code === "INVALID_CREDENTIALS") {
        const response: APIResponse = {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: error.message
        };
        res.status(401).json(response);
        return;
      }
      if (error.code === "NOT_FOUND") {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: error.message
        };
        res.status(404).json(response);
        return;
      }
      if (error.code === "CONFLICT") {
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

  async monitorLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req as any).validatedBody ?? req.body;
      const result = await authService.monitorLogin(payload);
      const response: APIResponse = {
        success: true,
        message: "Monitor authenticated successfully",
        data: result
      };
      res.json(response);
    } catch (error: any) {
      if (error.code === "INVALID_CREDENTIALS") {
        const response: APIResponse = {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: error.message
        };
        res.status(401).json(response);
        return;
      }
      next(error);
    }
  }

  async logout(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const response: APIResponse = {
        success: true,
        message: "Logged out successfully"
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;

      if (!user) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "User not found"
        };
        res.status(404).json(response);
        return;
      }

      const profile = await authService.buildProfile(user);

      const response: APIResponse = {
        success: true,
        message: "Profile retrieved successfully",
        data: profile
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
