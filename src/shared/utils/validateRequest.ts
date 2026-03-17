import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { APIResponse } from "@shared/types";

export const validateBody =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.issues.map((e) => e.message).join("; ")
      };

      res.status(400).json(response);
      return;
    }

    // Attach parsed data for downstream handlers if needed
    (req as any).validatedBody = result.data;
    next();
  };
