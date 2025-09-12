import mongoose, { Document, Schema } from 'mongoose';

export interface IPart extends Document {
  partId: string;
  name: string;
  description: string;
  category: string;
  requiredProcessLines: number[];
  currentProcessLine?: number;
  currentStatus: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedCompletionTime?: Date;
  actualCompletionTime?: Date;
  totalProcessingTime: number; // in minutes
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartSchema: Schema = new Schema({
  partId: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  category: {
    type: String,
    required: true,
    trim: true
  },
  requiredProcessLines: [{
    type: Number,
    required: true,
    min: 1,
    max: 20
  }],
  currentProcessLine: {
    type: Number,
    min: 1,
    max: 20
  },
  currentStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'on_hold'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  estimatedCompletionTime: {
    type: Date
  },
  actualCompletionTime: {
    type: Date
  },
  totalProcessingTime: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export const Part = mongoose.model<IPart>('Part', PartSchema);
