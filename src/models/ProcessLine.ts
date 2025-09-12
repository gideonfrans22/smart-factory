import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessLine extends Document {
  lineNumber: number;
  name: string;
  description: string;
  isActive: boolean;
  currentCapacity: number;
  maxCapacity: number;
  averageProcessingTime: number; // in minutes
  assignedWorkers: mongoose.Types.ObjectId[];
  status: 'operational' | 'maintenance' | 'offline';
  lastMaintenance?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessLineSchema: Schema = new Schema({
  lineNumber: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 20
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentCapacity: {
    type: Number,
    default: 0,
    min: 0
  },
  maxCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  averageProcessingTime: {
    type: Number,
    default: 0,
    min: 0
  },
  assignedWorkers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['operational', 'maintenance', 'offline'],
    default: 'operational'
  },
  lastMaintenance: {
    type: Date
  }
}, {
  timestamps: true
});

export const ProcessLine = mongoose.model<IProcessLine>('ProcessLine', ProcessLineSchema);
