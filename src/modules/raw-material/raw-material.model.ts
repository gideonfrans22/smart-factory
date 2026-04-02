import mongoose, { Document, Query, Schema } from "mongoose";

export interface RawMaterialDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface RawMaterialWeight {
  value?: number;
  unit?: string;
}

/** Shape for per-recipe-line material specs (recipe / snapshot), not the removed legacy array on RawMaterial */
export interface RawMaterialSpecification {
  dimensions?: RawMaterialDimensions;
  weight?: RawMaterialWeight;
  color?: string;
  supplier?: string;
  [key: string]: any;
}

export interface RawMaterialDocument extends Document {
  materialType: mongoose.Types.ObjectId;
  dimensions: RawMaterialDimensions & {
    length: number;
    width: number;
    height: number;
  };
  weight?: RawMaterialWeight;
  color?: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DimensionsSchema: Schema = new Schema(
  {
    length: {
      type: Number,
      min: 0,
      required: true
    },
    width: {
      type: Number,
      min: 0,
      required: true
    },
    height: {
      type: Number,
      min: 0,
      required: true
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
    materialType: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterialType",
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    dimensions: { type: DimensionsSchema, required: true },
    weight: WeightSchema,
    color: {
      type: String,
      trim: true
    },
    supplier: {
      type: String,
      trim: true
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

RawMaterialSchema.virtual("id").get(function (this: RawMaterialDocument) {
  return this._id;
});

RawMaterialSchema.pre(
  "find",
  function (this: Query<RawMaterialDocument[], RawMaterialDocument>) {
    this.populate("modifiedBy");
  }
);

RawMaterialSchema.index({ materialType: 1 });
RawMaterialSchema.index(
  {
    materialType: 1,
    "dimensions.length": 1,
    "dimensions.width": 1,
    "dimensions.height": 1
  },
  {
    unique: true,
    partialFilterExpression: {
      materialType: { $exists: true },
      "dimensions.length": { $exists: true },
      "dimensions.width": { $exists: true },
      "dimensions.height": { $exists: true }
    }
  }
);

export const RawMaterial = mongoose.model<RawMaterialDocument>(
  "RawMaterial",
  RawMaterialSchema
);
