import mongoose, { Schema, Document } from "mongoose";
  export interface ReportDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const ReportSchema = new Schema<ReportDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const Report = mongoose.model<ReportDocument>(
    "Report",
    ReportSchema
  );
  