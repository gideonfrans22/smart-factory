import { Response, NextFunction } from "express";
// Commented out unused imports during temporary auth bypass
// import * as jwt from "jsonwebtoken";
// import { User } from "../models/User";
import { AuthenticatedRequest } from "../types";
// import { JWTPayload, APIResponse } from "../types";

/**
 * TEMPORARY: Authentication is disabled for all routes
 * This middleware now passes through all requests without validation
 *
 * To re-enable authentication, uncomment the original implementation below
 * and remove the current bypass logic
 */
export const authenticateToken = async (
  _req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // TEMPORARY BYPASS: Skip all authentication checks
  console.log("⚠️  WARNING: Authentication is temporarily disabled");
  next();
  return;

  /* ORIGINAL IMPLEMENTATION - CURRENTLY DISABLED
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
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
        error: "UNAUTHORIZED",
        message: "Cannot use refresh token for authentication"
      };
      res.status(401).json(response);
      return;
    }

    const user = await User.findById(decoded.sub).select("-password");

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
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
      error: "FORBIDDEN",
      message: "Invalid token"
    };
    res.status(403).json(response);
  }
  */
};

/**
 * TEMPORARY: Role-based authorization is disabled
 * This middleware now passes through all requests without validation
 */
export const requireRole = (roles: string[]) => {
  return (
    _req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    // TEMPORARY BYPASS: Skip all role checks
    console.log(
      `⚠️  WARNING: Role check for [${roles.join(
        ", "
      )}] is temporarily disabled`
    );
    next();
    return;

    /* ORIGINAL IMPLEMENTATION - CURRENTLY DISABLED
    if (!req.user) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required"
      };
      res.status(401).json(response);
      return;
    }

    if (!roles.includes(req.user.role)) {
      const response: APIResponse = {
        success: false,
        error: "FORBIDDEN",
        message: "Insufficient permissions"
      };
      res.status(403).json(response);
      return;
    }

    next();
    */
  };
};

export const requireAdmin = requireRole(["admin"]);
export const requireWorker = requireRole(["worker"]);
export const requireAnyRole = requireRole(["admin", "worker"]);
