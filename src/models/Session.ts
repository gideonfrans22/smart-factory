import mongoose, { Document, Schema } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId?: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
  createdAt: Date;
}

const SessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    deviceId: {
      type: String,
      ref: "Device"
    },
    accessTokenHash: {
      type: String,
      required: true,
      maxlength: 255
    },
    refreshTokenHash: {
      type: String,
      required: true,
      maxlength: 255
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ deviceId: 1 });
SessionSchema.index({ accessTokenHash: 1, refreshTokenHash: 1 });
SessionSchema.index({ isActive: 1 });

// TTL index - automatically delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>("Session", SessionSchema);
