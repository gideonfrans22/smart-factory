import mongoose, { Document, Schema } from "mongoose";

export interface IDevice extends Document {
  _id: string; // Custom string ID like 'DEVICE_001'
  name: string;
  type: string;
  location?: string;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  ipAddress?: string;
  lastHeartbeat?: Date;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100
    },
    status: {
      type: String,
      required: true,
      enum: ["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"],
      default: "OFFLINE"
    },
    ipAddress: {
      type: String,
      trim: true
    },
    lastHeartbeat: {
      type: Date
    },
    config: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    _id: false, // Disable auto ID generation
    timestamps: true
  }
);

// Indexes
DeviceSchema.index({ status: 1 });
DeviceSchema.index({ type: 1 });
DeviceSchema.index({ location: 1 });
DeviceSchema.index({ lastHeartbeat: 1 });

export const Device = mongoose.model<IDevice>("Device", DeviceSchema);
