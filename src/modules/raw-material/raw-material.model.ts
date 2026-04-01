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

export interface RawMaterialSpecification {
  dimensions?: RawMaterialDimensions;
  weight?: RawMaterialWeight;
  color?: string;
  supplier?: string;
  [key: string]: any;
}

export interface RawMaterialDocument extends Document {
  materialCode?: string;
  name?: string;
  materialType?: mongoose.Types.ObjectId;
  dimensions?: RawMaterialDimensions;
  weight?: RawMaterialWeight;
  color?: string;
  description?: string;
  specifications?: RawMaterialSpecification[];
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
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      trim: true
    },
    materialType: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterialType"
    },
    description: {
      type: String,
      trim: true
    },
    dimensions: DimensionsSchema,
    weight: WeightSchema,
    color: {
      type: String,
      trim: true
    },
    specifications: [
      {
        dimensions: DimensionsSchema,
        weight: WeightSchema,
        color: {
          type: String,
          trim: true
        },
        supplier: {
          type: String,
          trim: true
        }
      }
    ],
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

RawMaterialSchema.index({ materialCode: 1 });
RawMaterialSchema.index({ name: 1 });
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
