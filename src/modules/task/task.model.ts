import mongoose, { Schema, Document } from "mongoose";
  export interface TaskDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const TaskSchema = new Schema<TaskDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Task = mongoose.model<TaskDocument>(
    "Task",
    TaskSchema
  );
  