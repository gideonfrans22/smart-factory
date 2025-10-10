import mongoose, { Document, Schema } from "mongoose";

export interface IEmergencyReport extends Document {
  deviceId: string;
  reportedBy: mongoose.Types.ObjectId;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  location?: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
  assignedTo?: mongoose.Types.ObjectId;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyReportSchema: Schema = new Schema(
  {
    deviceId: {
      type: String,
      ref: "Device",
      required: true
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    severity: {
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
    description: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100
    },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
      default: "OPEN"
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    resolvedAt: {
      type: Date
    },
    resolutionNotes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
EmergencyReportSchema.index({ deviceId: 1 });
EmergencyReportSchema.index({ reportedBy: 1 });
EmergencyReportSchema.index({ status: 1 });
EmergencyReportSchema.index({ severity: 1 });
EmergencyReportSchema.index({ createdAt: -1 });

export const EmergencyReport = mongoose.model<IEmergencyReport>(
  "EmergencyReport",
  EmergencyReportSchema
);
