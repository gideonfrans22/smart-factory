import mongoose, { Document, Schema } from "mongoose";

export interface IMedia extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  uploadedBy?: mongoose.Types.ObjectId;
  type?: string;
  createdAt: Date;
}

const MediaSchema: Schema = new Schema(
  {
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
      ref: "User"
    },
    type: {
      type: String,
      trim: true,
      maxlength: 50
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// translate _id to id
MediaSchema.virtual("id").get(function (this: IMedia) {
  return this._id;
});

// Indexes
MediaSchema.index({ uploadedBy: 1 });
MediaSchema.index({ type: 1 });
MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ mimeType: 1 });

export const Media = mongoose.model<IMedia>("Media", MediaSchema);
