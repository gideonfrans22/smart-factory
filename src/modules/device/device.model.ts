import mongoose, { Document, Query, Schema } from "mongoose";

export interface DeviceDocument extends Document {
  _id: string;
  name: string;
  deviceTypeId: mongoose.Types.ObjectId;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  currentUser?: mongoose.Types.ObjectId;
  currentTask?: mongoose.Types.ObjectId;
  ipAddress?: string;
  macAddress?: string;
  lastHeartbeat?: Date;
  config: Record<string, any>;
  errorReason?: string;
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

DeviceSchema.index({ status: 1 });
DeviceSchema.index({ currentUser: 1 });
DeviceSchema.index({ currentTask: 1 });
DeviceSchema.index({ deviceTypeId: 1 });
DeviceSchema.index({ lastHeartbeat: 1 });
DeviceSchema.index({ isActive: 1 });

DeviceSchema.virtual("id").get(function (this: DeviceDocument) {
  return this._id;
});

DeviceSchema.pre(
  /^find/,
  function (this: Query<DeviceDocument[], DeviceDocument>, next) {
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
  }
);

DeviceSchema.virtual("deviceType", {
  ref: "DeviceType",
  localField: "deviceTypeId",
  foreignField: "_id",
  justOne: true
});

function autoPopulateDeviceTypeAndUser(
  this: Query<any, DeviceDocument>,
  next: (err?: Error) => void
) {
  this.populate("deviceType")
    .populate("currentUser", "name username email")
    .populate("currentTask", "title status progress priority");
  next();
}
DeviceSchema.pre("find", autoPopulateDeviceTypeAndUser);
DeviceSchema.pre("findOne", autoPopulateDeviceTypeAndUser);

DeviceSchema.post("save", async function (doc: DeviceDocument) {
  const realtimeService =
    require("@shared/services/realtimeService").realtimeService;
  realtimeService.broadcastDeviceUpdate(doc.toObject()).catch((err: any) => {
    console.error("Broadcast device update error:", err);
  });
});

export const Device = mongoose.model<DeviceDocument>("Device", DeviceSchema);
