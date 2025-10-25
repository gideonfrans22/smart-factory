import mongoose, { Document, Schema } from "mongoose";

export interface IDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: string; // e.g., "mm", "cm", "m", "inch"
}

export interface IWeight {
  value?: number;
  unit?: string; // e.g., "kg", "g", "lb", "oz"
}

export interface ISpecifications {
  dimensions?: IDimensions;
  weight?: IWeight;
  color?: string;
  // Can be extended with additional fields as needed
  [key: string]: any;
}

export interface IRawMaterial extends Document {
  materialCode: string; // Unique identifier (e.g., "MAT-001")
  name: string; // e.g., "Steel Plate"
  materialType: string; // e.g., "METAL", "PLASTIC", "COMPOSITE", "CHEMICAL"
  specifications?: ISpecifications;
  supplier?: string; // Optional supplier name
  unit?: string; // Optional unit of measure (e.g., "kg", "meters", "pieces")
  currentStock?: number; // Optional current stock quantity
  createdAt: Date;
  updatedAt: Date;
}

const DimensionsSchema: Schema = new Schema(
  {
    length: {
      type: Number,
      min: 0
    },
    width: {
      type: Number,
      min: 0
    },
    height: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      trim: true,
      default: "mm"
    }
  },
  { _id: false }
);

const WeightSchema: Schema = new Schema(
  {
    value: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      trim: true,
      default: "kg"
    }
  },
  { _id: false }
);

const RawMaterialSchema: Schema = new Schema(
  {
    materialCode: {
      type: String,
      required: [true, "Material code is required"],
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true
    },
    materialType: {
      type: String,
      required: [true, "Material type is required"],
      trim: true,
      uppercase: true
    },
    specifications: {
      dimensions: DimensionsSchema,
      weight: WeightSchema,
      color: {
        type: String,
        trim: true
      }
    },
    supplier: {
      type: String,
      trim: true
    },
    unit: {
      type: String,
      trim: true
    },
    currentStock: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Indexes
RawMaterialSchema.index({ materialCode: 1 }, { unique: true });
RawMaterialSchema.index({ materialType: 1 });
RawMaterialSchema.index({ name: 1 });

export const RawMaterial = mongoose.model<IRawMaterial>(
  "RawMaterial",
  RawMaterialSchema
);
