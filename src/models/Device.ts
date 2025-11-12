import mongoose, { Document, Schema } from "mongoose";

export interface IDevice extends Document {
  _id: string; // auto-generated ID
  name: string;
  deviceTypeId: mongoose.Types.ObjectId; // Reference to DeviceType
  location?: string;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  ipAddress?: string;
  macAddress?: string; // MAC address for network identification
  lastHeartbeat?: Date;
  config: Record<string, any>;
  // Grid display properties (defaults for when device is not in a layout)
  defaultRowSpan: number;
  defaultColSpan: number;
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
    macAddress: {
      type: String,
      trim: true,
      uppercase: true,
      comment: "MAC address for network identification"
    },
    lastHeartbeat: {
      type: Date
    },
    config: {
      type: Schema.Types.Mixed,
      default: {}
    },
    defaultRowSpan: {
      type: Number,
      default: 1,
      min: 1,
      comment: "Default row span when device is added to a grid layout"
    },
    defaultColSpan: {
      type: Number,
      default: 1,
      min: 1,
      comment: "Default column span when device is added to a grid layout"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
DeviceSchema.index({ status: 1 });
DeviceSchema.index({ deviceTypeId: 1 });
DeviceSchema.index({ location: 1 });
DeviceSchema.index({ lastHeartbeat: 1 });

// translate _id to id
DeviceSchema.virtual("id").get(function (this: IDevice) {
  return this._id;
});

// Create virtual populate for deviceType details
DeviceSchema.virtual("deviceType", {
  ref: "DeviceType",
  localField: "deviceTypeId",
  foreignField: "_id",
  justOne: true
});

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
