import mongoose, { Schema, Document } from "mongoose";
  export interface DeviceDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const DeviceSchema = new Schema<DeviceDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Device = mongoose.model<DeviceDocument>(
    "Device",
    DeviceSchema
  );
  