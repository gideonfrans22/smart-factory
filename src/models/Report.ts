import mongoose, { Document, Schema } from "mongoose";

export interface IReport extends Document {
  title: string;
  type: "TASK_COMPLETION" | "QUALITY" | "MAINTENANCE" | "EFFICIENCY";
  format: "PDF" | "EXCEL" | "CSV" | "JSON";
  parameters: Record<string, any>;
  filePath?: string;
  fileSize?: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  generatedBy?: mongoose.Types.ObjectId;
  generatedAt?: Date;
  expiresAt?: Date;
  downloadCount: number;
  errorMessage?: string;
  createdAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    type: {
      type: String,
      required: true,
      enum: [
        "TASK_COMPLETION",
        "WORKER_PERFORMANCE",
        "PRODUCTION_RATE",
        "EFFICIENCY"
      ]
    },
    format: {
      type: String,
      required: true,
      enum: ["PDF", "EXCEL", "CSV", "JSON"],
      default: "PDF"
    },
    parameters: {
      type: Schema.Types.Mixed,
      default: {}
    },
    filePath: {
      type: String,
      trim: true,
      maxlength: 500
    },
    fileSize: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING"
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    generatedAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0
    },
    errorMessage: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
ReportSchema.index({ type: 1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ generatedBy: 1 });
ReportSchema.index({ createdAt: -1 });

export const Report = mongoose.model<IReport>("Report", ReportSchema);
