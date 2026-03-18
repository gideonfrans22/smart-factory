import mongoose, { Document, Schema } from "mongoose";
import { IDevicePosition } from "./grid-layout.types";

export interface GridLayoutDocument extends Document {
  _id: string;
  name: string;
  description?: string;
  columns: number;
  rows: number;
  devices: IDevicePosition[];
  isDefault: boolean;
  isMonitorDisplay: boolean;
  createdBy?: mongoose.Types.ObjectId;
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deviceCount?: number;
}

const DevicePositionSchema = new Schema(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true
    },
    row: {
      type: Number,
      required: true,
      min: 0,
      comment: "Row position in the grid (0-indexed)"
    },
    column: {
      type: Number,
      required: true,
      min: 0,
      comment: "Column position in the grid (0-indexed)"
    },
    rowSpan: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      comment: "Number of rows the device occupies"
    },
    colSpan: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      comment: "Number of columns the device occupies"
    }
  },
  { _id: false }
);

const GridLayoutSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      comment: "Name of the grid layout"
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      comment: "Optional description of the layout"
    },
    columns: {
      type: Number,
      required: true,
      min: 1,
      default: 12,
      comment: "Number of columns in the grid"
    },
    rows: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
      comment: "Number of rows in the grid"
    },
    devices: {
      type: [DevicePositionSchema],
      default: [],
      comment: "Array of device positions in the grid"
    },
    isDefault: {
      type: Boolean,
      default: false,
      comment: "Whether this is the default layout"
    },
    isMonitorDisplay: {
      type: Boolean,
      default: false,
      comment: "Whether this layout should be displayed on monitor TV"
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      comment: "User who created this layout"
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

GridLayoutSchema.index({ name: 1 });
GridLayoutSchema.index({ isDefault: 1 });
GridLayoutSchema.index({ createdBy: 1 });
GridLayoutSchema.index({ "devices.deviceId": 1 });

GridLayoutSchema.pre("save", function (this: GridLayoutDocument, next) {
  const deviceIds = this.devices.map((d: IDevicePosition) =>
    d.deviceId.toString()
  );
  const uniqueIds = new Set(deviceIds);

  if (deviceIds.length !== uniqueIds.size) {
    return next(new Error("Duplicate device IDs found in the layout"));
  }

  next();
});

GridLayoutSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await mongoose
      .model("GridLayout")
      .updateMany(
        { _id: { $ne: this._id }, isDefault: true },
        { isDefault: false }
      );
  }
  next();
});

GridLayoutSchema.virtual("deviceCount").get(function (this: GridLayoutDocument) {
  return this.devices.length;
});

export const GridLayout = mongoose.model<GridLayoutDocument>(
  "GridLayout",
  GridLayoutSchema
);
