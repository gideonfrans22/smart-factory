import mongoose, { Schema, Document } from "mongoose";
  export interface UserDocument extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const UserSchema = new Schema<UserDocument>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const User = mongoose.model<UserDocument>(
    "User",
    UserSchema
  );
  