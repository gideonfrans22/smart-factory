import mongoose, { Schema, Document } from "mongoose";
  export interface ProductDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const ProductSchema = new Schema<ProductDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Product = mongoose.model<ProductDocument>(
    "Product",
    ProductSchema
  );
  