import mongoose from "mongoose";
import { z } from "zod";

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId format"
});

export const mediaIdParamSchema = z.object({
  id: objectIdSchema
});

export const mediaUploadBodySchema = z.object({
  type: z.string().trim().min(1).max(50).optional()
});

export type MediaIdParamInput = z.infer<typeof mediaIdParamSchema>;
export type MediaUploadBodyInput = z.infer<typeof mediaUploadBodySchema>;

