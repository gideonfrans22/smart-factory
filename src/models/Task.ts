import mongoose, { Document, Schema } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  projectId?: mongoose.Types.ObjectId; // Optional: null for standalone tasks
  projectNumber?: string; // Denormalized from Project for easy tracking/reporting/display
  recipeSnapshotId?: mongoose.Types.ObjectId; // Reference to RecipeSnapshot (created at task generation)
  productSnapshotId?: mongoose.Types.ObjectId; // Reference to ProductSnapshot (if product-specific)
  recipeId: mongoose.Types.ObjectId; // Original recipe ID (for reference)
  productId?: mongoose.Types.ObjectId; // Optional: Original product ID (for reference)
  recipeStepId: mongoose.Types.ObjectId; // Required: Which step in the snapshot (step's _id within RecipeSnapshot)
  recipeExecutionNumber: number; // Which execution of this recipe (1 to totalRecipeExecutions)
  totalRecipeExecutions: number; // Total number of times this recipe needs to be executed
  stepOrder: number; // Order of this step within the recipe (for easy querying)
  isLastStepInRecipe: boolean; // True if this is the final step of the recipe
  deviceTypeId: mongoose.Types.ObjectId; // Required: Type of device needed (from recipe step)
  deviceId?: mongoose.Types.ObjectId; // Optional: Specific device assigned (required when ONGOING)
  workerId?: mongoose.Types.ObjectId; // Optional at creation, required for ONGOING/COMPLETED
  dependentTask?: mongoose.Types.ObjectId; // Reference to the task that must be completed before this task
  status: "PENDING" | "ONGOING" | "PAUSED" | "PAUSED_EMERGENCY" | "COMPLETED" | "FAILED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  pauseHistory?: Array<{
    pausedAt: Date;
    resumedAt?: Date;
    reason: string;
    pausedBy: string;
    resolvedBy?: string;
  }>;
  estimatedDuration?: number;
  actualDuration?: number;
  pausedDuration?: number;
  startedAt?: Date;
  completedAt?: Date;
  progress: number;
  notes?: string;
  qualityData?: any;
  mediaFiles: mongoose.Types.ObjectId[]; // References to Media documents
  modifiedBy?: mongoose.Types.ObjectId;
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
      required: false,
      comment: "Optional: null for standalone tasks outside of projects"
    },
    projectNumber: {
      type: String,
      comment:
        "Denormalized from Project for easy tracking/reporting/display (format: SUMAN-YYYY-MM-DD-XXX)",
      index: true
    },
    recipeSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "RecipeSnapshot",
      comment: "Reference to RecipeSnapshot (created at task generation time)"
    },
    productSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ProductSnapshot",
      comment: "Reference to ProductSnapshot (if product-specific task)"
    },
    recipeId: {
      type: Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
      comment: "Original live Recipe ID (for reference)"
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      comment: "Original live Product ID (for reference, if product-specific)"
    },
    recipeStepId: {
      type: Schema.Types.ObjectId,
      comment: "Reference to a step _id within the RecipeSnapshot",
      required: true
    },
    recipeExecutionNumber: {
      type: Number,
      required: true,
      min: 1,
      comment: "Which execution of this recipe (1 to totalRecipeExecutions)"
    },
    totalRecipeExecutions: {
      type: Number,
      required: true,
      min: 1,
      comment:
        "Total number of times this recipe needs to be executed in the project"
    },
    stepOrder: {
      type: Number,
      required: true,
      min: 1,
      comment: "Order of this step within the recipe (for easy querying)"
    },
    isLastStepInRecipe: {
      type: Boolean,
      required: true,
      default: false,
      comment: "True if this is the final step of the recipe execution"
    },
    deviceTypeId: {
      type: Schema.Types.ObjectId,
      ref: "DeviceType",
      required: true,
      comment: "Type of device required for this task (copied from recipe step)"
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      comment:
        "Specific device assigned to this task (required when status is ONGOING)"
    },
    workerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      comment:
        "Worker assigned to this task (required for ONGOING/COMPLETED status)"
    },
    dependentTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      comment:
        "Reference to the task that must be completed before this task can start"
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"],
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
    },
    pauseHistory: {
      type: [
        {
          pausedAt: { type: Date, required: true },
          resumedAt: { type: Date },
          reason: { type: String, required: true },
          pausedBy: { type: String, required: true },
          resolvedBy: { type: String }
        }
      ],
      default: [],
      comment: "History of task pauses and resumes"
    },
    mediaFiles: {
      type: [{ type: Schema.Types.ObjectId, ref: "Media" }],
      default: []
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// translate _id to id
TaskSchema.virtual("id").get(function (this: ITask) {
  return this._id;
});

// Indexes
// Single-field indexes for frequently queried fields
TaskSchema.index({ projectId: 1 }); // Very frequently queried alone
TaskSchema.index({ recipeId: 1 }); // Frequently queried alone
TaskSchema.index({ productId: 1 }); // Used in task filtering
TaskSchema.index({ recipeSnapshotId: 1 }); // Frequently queried alone
TaskSchema.index({ productSnapshotId: 1 }); // Used in queries
TaskSchema.index({ deviceTypeId: 1 }); // Frequently queried alone
TaskSchema.index({ deviceId: 1 }); // Frequently queried alone
TaskSchema.index({ workerId: 1 }); // Frequently queried alone
TaskSchema.index({ status: 1 }); // Very frequently queried alone
TaskSchema.index({ dependentTask: 1 }); // Used to find dependent tasks

// Compound indexes for snapshot queries
TaskSchema.index({ recipeSnapshotId: 1, recipeStepId: 1 }); // Find tasks for specific step in snapshot (covers recipeStepId queries)
TaskSchema.index({ productSnapshotId: 1, status: 1 }); // Find tasks for product snapshot by status
TaskSchema.index({ projectId: 1, recipeSnapshotId: 1 }); // Find all tasks for a recipe in a project

// Compound indexes for execution tracking
TaskSchema.index({ projectId: 1, recipeId: 1, recipeExecutionNumber: 1 }); // Find specific execution
TaskSchema.index({
  recipeSnapshotId: 1,
  recipeExecutionNumber: 1,
  stepOrder: 1
}); // Find specific step in execution
TaskSchema.index({
  projectId: 1,
  recipeId: 1,
  isLastStepInRecipe: 1,
  status: 1
}); // Find completed recipe executions (covers recipeExecutionNumber + status queries)

// Sort optimization indexes
TaskSchema.index({ createdAt: -1 }); // Most common sort pattern
TaskSchema.index({ completedAt: -1, createdAt: -1 }); // Common sort pattern for completed tasks

// Compound indexes for device/worker task queries (optimized for getDeviceTasks endpoint)
TaskSchema.index({
  deviceTypeId: 1,
  deviceId: 1,
  status: 1,
  completedAt: -1,
  createdAt: -1
}); // Device tasks query with sort
TaskSchema.index({
  deviceTypeId: 1,
  deviceId: 1,
  workerId: 1,
  status: 1,
  completedAt: -1,
  createdAt: -1
}); // Device tasks with worker filter
TaskSchema.index({ deviceTypeId: 1, deviceId: 1, createdAt: -1 }); // Device tasks date range queries

// Pre-save validation hook
TaskSchema.pre("save", async function (next) {
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

  // Require deviceId for ONGOING and COMPLETED status
  if (
    (task.status === "ONGOING" || task.status === "COMPLETED") &&
    !task.deviceId
  ) {
    return next(
      new Error(`deviceId is required when task status is ${task.status}`)
    );
  }

  // Validate that the assigned device matches the required device type
  if (task.deviceId && task.deviceTypeId) {
    const Device = mongoose.model("Device");
    const device = await Device.findById(task.deviceId);

    if (!device) {
      return next(new Error(`Device with id ${task.deviceId} not found`));
    }

    if (device.deviceTypeId.toString() !== task.deviceTypeId.toString()) {
      return next(
        new Error(
          `Device type mismatch: Task requires device type ${task.deviceTypeId}, but device ${task.deviceId} is of type ${device.deviceTypeId}`
        )
      );
    }
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
