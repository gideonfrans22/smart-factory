import mongoose, { Schema, Document } from "mongoose";
  export interface RecipeDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const RecipeSchema = new Schema<RecipeDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Recipe = mongoose.model<RecipeDocument>(
    "Recipe",
    RecipeSchema
  );
  