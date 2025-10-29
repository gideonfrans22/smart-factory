import mongoose, { Document, Schema } from "mongoose";

export interface IDeviceType extends Document {
  name: string;
  description?: string;
  specifications?: {
    maxDimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string;
    };
    maxWeight?: {
      value?: number;
      unit?: string;
    };
    [key: string]: any; // Allow flexible specifications
  };
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTypeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    specifications: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
DeviceTypeSchema.index({ name: 1 });

// translate _id to id
DeviceTypeSchema.virtual("id").get(function (this: IDeviceType) {
  return this._id;
});

// Create virtual populate for devices of this type
DeviceTypeSchema.virtual("devices", {
  ref: "Device",
  localField: "_id",
  foreignField: "deviceTypeId"
});

// Pre-remove hook to check for dependent devices, recipe steps, and tasks
DeviceTypeSchema.pre("findOneAndDelete", async function (next) {
  try {
    const deviceTypeId = this.getQuery()._id;

    // Check if any device references this device type
    const Device = mongoose.model("Device");
    const devicesWithType = await Device.findOne({ deviceTypeId });

    if (devicesWithType) {
      return next(
        new Error(
          `Cannot delete device type: It is referenced by device "${devicesWithType.name}". Please reassign or delete dependent devices first.`
        )
      );
    }

    // Check if any recipe step references this device type
    const Recipe = mongoose.model("Recipe");
    const recipesWithDeviceType = await Recipe.findOne({
      "steps.deviceTypeId": deviceTypeId
    });

    if (recipesWithDeviceType) {
      return next(
        new Error(
          `Cannot delete device type: It is referenced by recipe steps in recipe "${recipesWithDeviceType.name}". Please update or delete dependent recipes first.`
        )
      );
    }

    // Check if any task references this device type
    const Task = mongoose.model("Task");
    const tasksWithDeviceType = await Task.findOne({
      deviceTypeId
    });

    if (tasksWithDeviceType) {
      return next(
        new Error(
          `Cannot delete device type: It is referenced by task "${tasksWithDeviceType.title}". Please update or delete dependent tasks first.`
        )
      );
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const DeviceType = mongoose.model<IDeviceType>(
  "DeviceType",
  DeviceTypeSchema
);
