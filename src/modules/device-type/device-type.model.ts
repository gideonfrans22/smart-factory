import mongoose, { Schema, Document } from "mongoose";
  export interface DeviceTypeDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const DeviceTypeSchema = new Schema<DeviceTypeDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const DeviceType = mongoose.model<DeviceTypeDocument>(
    "DeviceType",
    DeviceTypeSchema
  );
  