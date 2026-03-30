import mongoose, { Document, Schema } from "mongoose";

/**
 * Per-project mapping: device type id -> ordered device ids (round-robin order).
 * One document per project; `projectId` is unique.
 */
export interface IProjectDeviceConfiguration extends Document {
  projectId: mongoose.Types.ObjectId;
  byDeviceType: Map<string, mongoose.Types.ObjectId[]>;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectDeviceConfigurationSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    byDeviceType: {
      type: Map,
      of: [
        {
          type: Schema.Types.ObjectId,
          ref: "Device"
        }
      ],
      default: () => new Map()
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

ProjectDeviceConfigurationSchema.index({ projectId: 1 }, { unique: true });

ProjectDeviceConfigurationSchema.virtual("id").get(function (
  this: IProjectDeviceConfiguration
) {
  return this._id;
});

export const ProjectDeviceConfiguration = mongoose.model<IProjectDeviceConfiguration>(
  "ProjectDeviceConfiguration",
  ProjectDeviceConfigurationSchema,
  "ProjectDeviceConfiguration"
);
