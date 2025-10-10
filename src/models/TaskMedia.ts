import mongoose, { Document, Schema } from "mongoose";

export interface ITaskMedia extends Document {
  taskId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadType: "PHOTO" | "VIDEO" | "DOCUMENT" | "AUDIO";
  createdAt: Date;
}

const TaskMediaSchema: Schema = new Schema(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true
    },
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    uploadType: {
      type: String,
      required: true,
      enum: ["PHOTO", "VIDEO", "DOCUMENT", "AUDIO"],
      default: "PHOTO"
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
TaskMediaSchema.index({ taskId: 1 });
TaskMediaSchema.index({ uploadType: 1 });
TaskMediaSchema.index({ uploadedBy: 1 });

export const TaskMedia = mongoose.model<ITaskMedia>(
  "TaskMedia",
  TaskMediaSchema
);
