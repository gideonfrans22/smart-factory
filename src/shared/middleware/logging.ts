import { Request, Response, NextFunction } from "express";
import { loggerService } from "@shared/services";
import { AuthenticatedRequest } from "@shared/types";

/**
 * Express middleware for logging HTTP requests and responses
 * Captures request details, response status, and duration
 */
export const requestLoggingMiddleware = (
  req: Request | AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip logging for health check endpoints (or log at debug level)
  const isHealthCheck = req.path === "/api/health" || req.path === "/";

  if (isHealthCheck) {
    // Log health checks at debug level
    loggerService.debug(`Health check: ${req.method} ${req.path}`);
    return next();
  }

  // Capture start time
  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to capture response details
  res.end = function (chunk?: any, encoding?: any): Response {
    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Get request details
    const method = req.method;
    const path = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    // Get user ID if authenticated (Mongoose uses _id)
    const userId = (req as AuthenticatedRequest).user?._id?.toString();

    // Log the request
    loggerService.logAPIRequest(
      method,
      path,
      statusCode,
      durationMs,
      ip,
      userAgent,
      userId
    );

    // Call original end function
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error logging middleware
 * Should be used after the error handler to log errors
 */
export const errorLoggingMiddleware = (
  error: any,
  req: Request | AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const method = req.method;
  const path = req.originalUrl || req.url;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  const userId = (req as AuthenticatedRequest).user?._id?.toString();

  loggerService.error(`API Error: ${method} ${path}`, {
    error: error.message,
    stack: error.stack,
    statusCode: error.status || 500,
    ip,
    userAgent,
    userId,
    body: req.body,
    query: req.query,
    params: req.params
  });

  next(error);
};
