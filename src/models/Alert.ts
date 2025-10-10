import mongoose, { Document, Schema } from "mongoose";

export interface IAlert extends Document {
  type: "INFO" | "WARNING" | "ERROR" | "EMERGENCY";
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  status: "UNREAD" | "READ" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

const AlertSchema: Schema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["INFO", "WARNING", "ERROR", "EMERGENCY"]
    },
    level: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM"
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      trim: true,
      maxlength: 100
    },
    relatedEntityType: {
      type: String,
      trim: true,
      maxlength: 50
    },
    relatedEntityId: {
      type: String,
      trim: true,
      maxlength: 255
    },
    status: {
      type: String,
      required: true,
      enum: ["UNREAD", "READ", "ACKNOWLEDGED", "RESOLVED"],
      default: "UNREAD"
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    acknowledgedAt: {
      type: Date
    },
    resolvedAt: {
      type: Date
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
AlertSchema.index({ type: 1 });
AlertSchema.index({ level: 1 });
AlertSchema.index({ status: 1 });
AlertSchema.index({ source: 1 });
AlertSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
AlertSchema.index({ createdAt: -1 });

export const Alert = mongoose.model<IAlert>("Alert", AlertSchema);
