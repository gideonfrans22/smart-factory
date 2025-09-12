import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessRecord extends Document {
  partId: mongoose.Types.ObjectId;
  processLineNumber: number;
  workerId: mongoose.Types.ObjectId;
  status: 'queued' | 'started' | 'completed' | 'paused' | 'failed';
  startTime?: Date;
  endTime?: Date;
  processingDuration?: number; // in minutes
  notes?: string;
  qualityCheck: {
    passed: boolean;
    score?: number;
    comments?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProcessRecordSchema: Schema = new Schema({
  partId: {
    type: Schema.Types.ObjectId,
    ref: 'Part',
    required: true
  },
  processLineNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 20
  },
  workerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'started', 'completed', 'paused', 'failed'],
    default: 'queued'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  processingDuration: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  qualityCheck: {
    passed: {
      type: Boolean,
      default: false
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    comments: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
ProcessRecordSchema.index({ partId: 1, processLineNumber: 1 });
ProcessRecordSchema.index({ workerId: 1, status: 1 });

export const ProcessRecord = mongoose.model<IProcessRecord>('ProcessRecord', ProcessRecordSchema);
