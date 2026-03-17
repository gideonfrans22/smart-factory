import mongoose, { Schema, Document } from "mongoose";
  export interface GridLayoutDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const GridLayoutSchema = new Schema<GridLayoutDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const GridLayout = mongoose.model<GridLayoutDocument>(
    "GridLayout",
    GridLayoutSchema
  );
  