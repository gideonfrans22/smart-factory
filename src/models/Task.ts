import mongoose, { Document, Schema } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  recipeId: mongoose.Types.ObjectId; // Required: Which recipe in project
  productId?: mongoose.Types.ObjectId; // Optional: Which product (if task is product-specific)
  recipeStepId: mongoose.Types.ObjectId; // Required: Which step in the recipe (step's _id)
  deviceId?: string;
  workerId?: mongoose.Types.ObjectId; // Optional at creation, required for ONGOING/COMPLETED
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
    recipeId: {
      type: Schema.Types.ObjectId,
      required: true,
      comment: "Reference to recipe in project.recipes[] or product.recipes[]"
    },
    productId: {
      type: Schema.Types.ObjectId,
      comment:
        "Reference to product in project.products[] (optional, only if task is product-specific)"
    },
    recipeStepId: {
      type: Schema.Types.ObjectId,
      comment: "Reference to a step _id within the recipe snapshot",
      required: true
    },
    deviceId: {
      type: String,
      ref: "Device"
    },
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      comment:
        "Worker assigned to this task (required for ONGOING/COMPLETED status)"
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
TaskSchema.index({ recipeId: 1 });
TaskSchema.index({ productId: 1 });
TaskSchema.index({ recipeStepId: 1 });
TaskSchema.index({ deviceId: 1 });
TaskSchema.index({ workerId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ startedAt: 1, completedAt: 1 });

// Pre-save validation hook
TaskSchema.pre("save", function (next) {
  const task = this as unknown as ITask;

  // Require workerId for ONGOING and COMPLETED status
  if (
    (task.status === "ONGOING" || task.status === "COMPLETED") &&
    !task.workerId
  ) {
    return next(
      new Error(`workerId is required when task status is ${task.status}`)
    );
  }

  // Set completedAt when status changes to COMPLETED
  if (task.status === "COMPLETED" && !task.completedAt) {
    task.completedAt = new Date();
  }

  // Set startedAt when status changes to ONGOING
  if (task.status === "ONGOING" && !task.startedAt) {
    task.startedAt = new Date();
  }

  next();
});

export const Task = mongoose.model<ITask>("Task", TaskSchema);
