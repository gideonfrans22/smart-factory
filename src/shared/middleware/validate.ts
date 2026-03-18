import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate =
  (schema: ZodSchema, source: "body" | "query" | "params" = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse((req as any)[source]);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: result.error.flatten().fieldErrors
      });
      return;
    }
    (req as any)[source] = result.data;
    next();
  };
