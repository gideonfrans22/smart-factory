import mongoose, { Document, Schema } from "mongoose";

export interface IKPIData extends Document {
  metricName: string;
  metricValue: number;
  unit?: string;
  deviceId?: string;
  projectId?: mongoose.Types.ObjectId;
  recordedAt: Date;
  metadata: Record<string, any>;
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const KPIDataSchema: Schema = new Schema(
  {
    metricName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    metricValue: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      trim: true,
      maxlength: 20
    },
    deviceId: {
      type: String,
      ref: "Device"
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project"
    },
    recordedAt: {
      type: Date,
      required: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
KPIDataSchema.index({ metricName: 1 });
KPIDataSchema.index({ recordedAt: -1 });
KPIDataSchema.index({ deviceId: 1 });
KPIDataSchema.index({ projectId: 1 });
KPIDataSchema.index({ metricName: 1, recordedAt: -1 });

export const KPIData = mongoose.model<IKPIData>("KPIData", KPIDataSchema);
