import mongoose, { Document, Schema } from "mongoose";

export interface IDevice extends Document {
  _id: string; // auto-generated ID
  name: string;
  type: string;
  deviceTypeId: mongoose.Types.ObjectId; // Reference to DeviceType
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
    deviceTypeId: {
      type: Schema.Types.ObjectId,
      ref: "DeviceType",
      required: true,
      comment: "Reference to the device type category"
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
    timestamps: true
  }
);

// Indexes
DeviceSchema.index({ status: 1 });
DeviceSchema.index({ type: 1 });
DeviceSchema.index({ deviceTypeId: 1 });
DeviceSchema.index({ location: 1 });
DeviceSchema.index({ lastHeartbeat: 1 });

// Pre-remove hook to check for dependent recipe steps
DeviceSchema.pre("findOneAndDelete", async function (next) {
  try {
    const deviceId = this.getQuery()._id;

    // Import Recipe model here to avoid circular dependency
    const Recipe = mongoose.model("Recipe");

    // Check if any recipe step references this device
    const recipesWithDevice = await Recipe.findOne({
      "steps.deviceId": deviceId
    });

    if (recipesWithDevice) {
      return next(
        new Error(
          `Cannot delete device: It is referenced by recipe steps in recipe "${recipesWithDevice.name}"`
        )
      );
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Device = mongoose.model<IDevice>("Device", DeviceSchema);
