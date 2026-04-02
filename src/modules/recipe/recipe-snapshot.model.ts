import mongoose, { Document, Schema } from "mongoose";
import {
  RawMaterialDimensions,
  RawMaterialSpecification,
  RawMaterialWeight
} from "@modules/raw-material";

export interface IRecipeStepSnapshot {
  _id: mongoose.Types.ObjectId;
  order: number;
  name: string;
  description?: string;
  deviceTypeId: mongoose.Types.ObjectId;
  estimatedDuration: number;
  dependsOn?: mongoose.Types.ObjectId[];
  instructions?: string;
  qualityChecks?: string[];
}

export interface IRawMaterialSnapshotReference {
  rawMaterialId: mongoose.Types.ObjectId;
  /** Stable identifier for integrations; set to raw material `_id` string post–raw-material migration */
  rawMaterialNumber?: string;
  /** Display label: prefer raw material type name, else legacy `name` */
  name: string;
  unit: string;
  description?: string;
  quantityRequired: number;
  specification?: RawMaterialSpecification;
  materialTypeCode?: string;
  materialTypeName?: string;
  dimensions?: RawMaterialDimensions;
  weight?: RawMaterialWeight;
  color?: string;
}

export interface IRecipeSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  originalRecipeId: mongoose.Types.ObjectId;
  version: number;
  recipeNumber?: string;
  name: string;
  description?: string;
  specification?: string;
  steps: IRecipeStepSnapshot[];
  rawMaterials: IRawMaterialSnapshotReference[];
  estimatedDuration: number;

  dwgNo?: string;
  unit?: string;
  outsourcing?: string;
  remarks?: string;

  mediaIds?: mongoose.Types.ObjectId[];
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecipeSnapshotModel extends mongoose.Model<IRecipeSnapshot> {
  getLatestSnapshot(
    recipeId: mongoose.Types.ObjectId
  ): Promise<IRecipeSnapshot | null>;
  getOrCreateSnapshot(
    recipeId: mongoose.Types.ObjectId,
    recipeData: any
  ): Promise<IRecipeSnapshot>;
}

const RecipeStepSnapshotSchema = new Schema<IRecipeStepSnapshot>(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String },
    deviceTypeId: {
      type: Schema.Types.ObjectId,
      ref: "DeviceType",
      required: true
    },
    estimatedDuration: { type: Number, required: true },
    dependsOn: [{ type: Schema.Types.ObjectId }],
    instructions: { type: String },
    qualityChecks: [{ type: String }]
  },
  { _id: true }
);

const RawMaterialSnapshotReferenceSchema =
  new Schema<IRawMaterialSnapshotReference>({
    rawMaterialId: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true
    },
    rawMaterialNumber: { type: String },
    name: { type: String, required: true },
    unit: { type: String, required: false, default: "EA" },
    description: { type: String },
    quantityRequired: { type: Number, required: true, min: 0 },
    specification: { type: Schema.Types.Mixed },
    materialTypeCode: { type: String },
    materialTypeName: { type: String },
    dimensions: { type: Schema.Types.Mixed },
    weight: { type: Schema.Types.Mixed },
    color: { type: String }
  });

const RecipeSnapshotSchema = new Schema<IRecipeSnapshot>(
  {
    originalRecipeId: {
      type: Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    recipeNumber: { type: String },
    name: { type: String, required: true },
    description: { type: String },
    specification: { type: String },
    steps: {
      type: [RecipeStepSnapshotSchema],
      required: true,
      validate: {
        validator: function (steps: IRecipeStepSnapshot[]) {
          return steps.length > 0;
        },
        message: "Recipe must have at least one step"
      }
    },
    rawMaterials: [RawMaterialSnapshotReferenceSchema],
    estimatedDuration: { type: Number, required: true },
    dwgNo: { type: String, required: false },
    unit: { type: String, required: false, default: "EA" },
    outsourcing: { type: String, required: false },
    remarks: { type: String, required: false },
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }],
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

RecipeSnapshotSchema.index({ originalRecipeId: 1, version: -1 });
RecipeSnapshotSchema.index({ originalRecipeId: 1, createdAt: 1 });

RecipeSnapshotSchema.statics.getLatestSnapshot = async function (
  recipeId: mongoose.Types.ObjectId
): Promise<IRecipeSnapshot | null> {
  return this.findOne({ originalRecipeId: recipeId }).sort({ version: -1 }).exec();
};

RecipeSnapshotSchema.statics.getOrCreateSnapshot = async function (
  recipeId: mongoose.Types.ObjectId,
  recipeData: any
): Promise<IRecipeSnapshot> {
  const latestSnapshot = await this.findOne({ originalRecipeId: recipeId })
    .sort({ version: -1 })
    .exec();

  if (!latestSnapshot) {
    return this.create({
      originalRecipeId: recipeId,
      version: 1,
      ...recipeData
    });
  }

  if (recipeData.updatedAt && latestSnapshot.createdAt >= recipeData.updatedAt) {
    return latestSnapshot;
  }

  return this.create({
    originalRecipeId: recipeId,
    version: latestSnapshot.version + 1,
    ...recipeData
  });
};

export const RecipeSnapshot = mongoose.model<IRecipeSnapshot, IRecipeSnapshotModel>(
  "RecipeSnapshot",
  RecipeSnapshotSchema
);

