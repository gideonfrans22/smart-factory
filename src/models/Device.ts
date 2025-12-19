import mongoose, { Document, Schema } from "mongoose";

export interface IDevice extends Document {
  _id: string; // auto-generated ID
  name: string;
  deviceTypeId: mongoose.Types.ObjectId; // Reference to DeviceType
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  currentUser?: mongoose.Types.ObjectId;
  currentTask?: mongoose.Types.ObjectId;
  ipAddress?: string;
  macAddress?: string; // MAC address for network identification
  lastHeartbeat?: Date;
  config: Record<string, any>;
  errorReason?: string; // Description of error/emergency
  statusHistory?: Array<{
    status: string;
    changedAt: Date;
    reason?: string;
    changedBy?: string;
  }>;
  isActive?: boolean;
  modifiedBy?: mongoose.Types.ObjectId;
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
    status: {
      type: String,
      required: true,
      enum: ["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"],
      default: "OFFLINE"
    },
    currentUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      comment: "Reference to the user currently operating the device"
    },
    currentTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      comment: "Reference to the task currently assigned to the device"
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
    errorReason: {
      type: String,
      trim: true,
      comment: "Description of current error or emergency"
    },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          changedAt: { type: Date, required: true, default: Date.now },
          reason: { type: String },
          changedBy: { type: String }
        }
      ],
      default: [],
      comment: "History of device status changes"
    },
    isActive: {
      type: Boolean,
      default: true,
      comment: "Whether the device is active"
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
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
DeviceSchema.index({ currentUser: 1 });
DeviceSchema.index({ currentTask: 1 });
DeviceSchema.index({ deviceTypeId: 1 });
DeviceSchema.index({ lastHeartbeat: 1 });
DeviceSchema.index({ isActive: 1 });

// translate _id to id
DeviceSchema.virtual("id").get(function (this: IDevice) {
  return this._id;
});

// Pre-get hook to exclude soft-deleted devices
DeviceSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  const includeDeleted =
    (options as any).includeDeleted === false ? false : true;
  if (!includeDeleted) {
    this.where({
      isActive: {
        $ne: false
      }
    });
  }
  next();
});

// Create virtual populate for deviceType details
DeviceSchema.virtual("deviceType", {
  ref: "DeviceType",
  localField: "deviceTypeId",
  foreignField: "_id",
  justOne: true
});

// Pre-find hook to always populate deviceType, currentUser, and currentTask
function autoPopulateDeviceTypeAndUser(
  this: mongoose.Query<any, IDevice>,
  next: (err?: Error) => void
) {
  this.populate("deviceType")
    .populate("currentUser", "name username email")
    .populate("currentTask", "title status progress priority");
  next();
}
DeviceSchema.pre("find", autoPopulateDeviceTypeAndUser);
DeviceSchema.pre("findOne", autoPopulateDeviceTypeAndUser);

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

// Broadcast device updates on save
DeviceSchema.post("save", async function (doc: IDevice) {
  const realtimeService =
    require("../services/realtimeService").realtimeService;
  realtimeService.broadcastDeviceUpdate(doc.toObject()).catch((err: any) => {
    console.error("Broadcast device update error:", err);
  });
});

export const Device = mongoose.model<IDevice>("Device", DeviceSchema);
