import mongoose, { Schema, Document } from "mongoose";
  export interface ProjectDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const ProjectSchema = new Schema<ProjectDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Project = mongoose.model<ProjectDocument>(
    "Project",
    ProjectSchema
  );
  