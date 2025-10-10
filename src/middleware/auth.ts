import { Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { User } from "../models/User";
import { AuthenticatedRequest, JWTPayload, APIResponse } from "../types";

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      const response: APIResponse = {
        success: false,
        message: "Access token required"
      };
      res.status(401).json(response);
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Check if it's not a refresh token (refresh tokens shouldn't be used for authentication)
    if (decoded.type === "refresh") {
      const response: APIResponse = {
        success: false,
        message: "Cannot use refresh token for authentication"
      };
      res.status(401).json(response);
      return;
    }

    const user = await User.findById(decoded.sub).select("-password");

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        message: "Invalid or inactive user"
      };
      res.status(401).json(response);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    const response: APIResponse = {
      success: false,
      message: "Invalid token"
    };
    res.status(403).json(response);
  }
};

export const requireRole = (roles: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      const response: APIResponse = {
        success: false,
        message: "Authentication required"
      };
      res.status(401).json(response);
      return;
    }

    if (!roles.includes(req.user.role)) {
      const response: APIResponse = {
        success: false,
        message: "Insufficient permissions"
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(["admin"]);
export const requireWorker = requireRole(["worker"]);
export const requireAnyRole = requireRole(["admin", "worker"]);
