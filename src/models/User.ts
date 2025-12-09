import mongoose, { Document, Query, Schema } from "mongoose";

export interface IUser extends Document {
  username?: string;
  name: string;
  email?: string;
  password: string;
  role: "admin" | "worker";
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 20,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
      index: true
    },
    password: {
      type: String,
      default: ""
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "worker"]
    },
    department: {
      type: String,
      trim: true,
      maxlength: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: {
      type: Date
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
UserSchema.virtual("id").get(function (this: IUser) {
  return this._id;
});

// populate modifiedBy
UserSchema.pre("find", function (this: Query<IUser[], IUser>) {
  this.populate("modifiedBy");
});

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
