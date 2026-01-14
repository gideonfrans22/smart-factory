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
  modifiedBy?: mongoose.Types.ObjectId;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTypeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: 1,
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
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    isActive: {
      type: Boolean,
      default: true,
      comment: "Whether the device type is active"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// translate _id to id
DeviceTypeSchema.virtual("id").get(function (this: IDeviceType) {
  return this._id;
});

// Create virtual populate for devices of this type
DeviceTypeSchema.virtual("devices", {
  ref: "Device",
  localField: "_id",
  foreignField: "deviceTypeId",
  options: {
    includeDeleted: false
  }
});

// Pre-find hook to exclude soft-deleted device types
DeviceTypeSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
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

// Pre-save hook for auto-rename on soft delete
DeviceTypeSchema.pre("save", function (next) {
  if (this.isModified("isActive") && this.isActive === false) {
    // Check if name already has deleted suffix to avoid double-renaming
    if (!this.name.includes("_deleted_")) {
      const timestamp = Date.now();
      this.name = `${this.name}_deleted_${timestamp}`;
    }
  }
  next();
});

// Pre-remove hook to check for dependent devices, recipe steps, and tasks
// Note: This hook still runs for findOneAndDelete, but we'll use soft delete in controller
DeviceTypeSchema.pre("findOneAndDelete", async function (next) {
  try {
    const deviceTypeId = this.getQuery()._id;

    // Check if any active device references this device type
    const Device = mongoose.model("Device");
    const devicesWithType = await Device.findOne({
      deviceTypeId,
      isActive: { $ne: false }
    });

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
