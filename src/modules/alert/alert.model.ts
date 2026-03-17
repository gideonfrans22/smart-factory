import mongoose, { Schema, Document } from "mongoose";
  export interface AlertDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const AlertSchema = new Schema<AlertDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Alert = mongoose.model<AlertDocument>(
    "Alert",
    AlertSchema
  );
  