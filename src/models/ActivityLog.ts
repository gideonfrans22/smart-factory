import mongoose, { Document, Schema } from "mongoose";

export interface IActivityLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
  createdAt: Date;
}

const ActivityLogSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    resourceId: {
      type: String,
      trim: true,
      maxlength: 255
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    success: {
      type: Boolean,
      default: true
    },
    errorMessage: {
      type: String,
      trim: true
    },
    durationMs: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
ActivityLogSchema.index({ userId: 1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ resourceType: 1, resourceId: 1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ success: 1 });

export const ActivityLog = mongoose.model<IActivityLog>(
  "ActivityLog",
  ActivityLogSchema
);
