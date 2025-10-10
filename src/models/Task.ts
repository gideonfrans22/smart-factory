import mongoose, { Document, Schema } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  recipeStepId: string;
  deviceId?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: "PENDING" | "ONGOING" | "PAUSED" | "COMPLETED" | "FAILED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedDuration?: number;
  actualDuration?: number;
  pausedDuration?: number;
  startedAt?: Date;
  completedAt?: Date;
  progress: number;
  notes?: string;
  qualityData?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    description: {
      type: String,
      trim: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    recipeStepId: {
      type: String,
      comment: "Reference to a step within the project's recipe",
      required: true
    },
    deviceId: {
      type: String,
      ref: "Device"
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "ONGOING", "PAUSED", "COMPLETED", "FAILED"],
      default: "PENDING"
    },
    priority: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM"
    },
    estimatedDuration: {
      type: Number,
      min: 0,
      comment: "Duration in minutes"
    },
    actualDuration: {
      type: Number,
      min: 0,
      comment: "Actual time taken in minutes"
    },
    pausedDuration: {
      type: Number,
      default: 0,
      min: 0,
      comment: "Total paused time in minutes"
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    notes: {
      type: String,
      trim: true
    },
    qualityData: {
      type: Schema.Types.Mixed,
      comment: "Quality control data for this task"
    }
  },
  {
    timestamps: true
  }
);

// Indexes
TaskSchema.index({ projectId: 1 });
TaskSchema.index({ recipeStepId: 1 });
TaskSchema.index({ deviceId: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ startedAt: 1, completedAt: 1 });

export const Task = mongoose.model<ITask>("Task", TaskSchema);
