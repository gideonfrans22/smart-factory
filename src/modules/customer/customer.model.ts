import mongoose, { Schema, Document } from "mongoose";
  export interface CustomerDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const CustomerSchema = new Schema<CustomerDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Customer = mongoose.model<CustomerDocument>(
    "Customer",
    CustomerSchema
  );
  