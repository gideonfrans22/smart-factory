import mongoose, { Schema, Document } from "mongoose";
import { ISpecifications } from "./RawMaterial";

// Recipe Step interface for snapshot
export interface IRecipeStepSnapshot {
  _id: mongoose.Types.ObjectId; // Important: step ID lives within snapshot
  order: number;
  name: string;
  description?: string;
  deviceTypeId: mongoose.Types.ObjectId;
  estimatedDuration: number; // in minutes
  dependsOn?: mongoose.Types.ObjectId[]; // References to other step _ids in this snapshot
  instructions?: string;
  qualityChecks?: string[];
}

// Raw Material Reference interface for snapshot
export interface IRawMaterialSnapshotReference {
  rawMaterialId: mongoose.Types.ObjectId;
  rawMaterialNumber?: string;
  name: string;
  unit: string;
  description?: string;
  quantityRequired: number; // Quantity needed per unit produced
  specification?: ISpecifications; // Specifications like dimensions, weight, etc.
}

// RecipeSnapshot interface
export interface IRecipeSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  originalRecipeId: mongoose.Types.ObjectId; // Reference to the live Recipe
  version: number; // Snapshot version (increments on each update)
  recipeNumber?: string;
  name: string;
  description?: string;
  specification?: string;
  steps: IRecipeStepSnapshot[];
  rawMaterials: IRawMaterialSnapshotReference[];
  estimatedDuration: number; // Total duration in minutes

  // ✨ NEW FIELDS - Manufacturing metadata
  dwgNo?: string;
  unit?: string;
  outsourcing?: string;
  remarks?: string;

  // ✨ MEDIA FIELDS
  mediaIds?: mongoose.Types.ObjectId[];

  createdAt: Date; // For smart caching: compare with Recipe.updatedAt
  updatedAt: Date;
}

// Static methods interface
export interface IRecipeSnapshotModel extends mongoose.Model<IRecipeSnapshot> {
  getLatestSnapshot(
    recipeId: mongoose.Types.ObjectId
  ): Promise<IRecipeSnapshot | null>;
  getOrCreateSnapshot(
    recipeId: mongoose.Types.ObjectId,
    recipeData: any
  ): Promise<IRecipeSnapshot>;
}

// Recipe Step Schema for snapshot
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
    dependsOn: [{ type: Schema.Types.ObjectId }], // References to step _ids in this snapshot
    instructions: { type: String },
    qualityChecks: [{ type: String }]
  },
  { _id: true } // Ensure each step has its own _id
);

// Raw Material Snapshot Reference Schema
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
    specification: { type: Schema.Types.Mixed }
  });

// RecipeSnapshot Schema
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
    // ✨ NEW FIELDS - Manufacturing metadata
    dwgNo: { type: String, required: false },
    unit: { type: String, required: false, default: "EA" },
    outsourcing: { type: String, required: false },
    remarks: { type: String, required: false },
    // ✨ MEDIA FIELDS
    mediaIds: [{ type: Schema.Types.ObjectId, ref: "Media" }]
  },
  { timestamps: true }
);

// Compound index for efficient querying and caching
RecipeSnapshotSchema.index({ originalRecipeId: 1, version: -1 }); // Get latest version
RecipeSnapshotSchema.index({ originalRecipeId: 1, createdAt: 1 }); // For cache checking

// Static method to get latest snapshot for a recipe
RecipeSnapshotSchema.statics.getLatestSnapshot = async function (
  recipeId: mongoose.Types.ObjectId
): Promise<IRecipeSnapshot | null> {
  return this.findOne({ originalRecipeId: recipeId })
    .sort({ version: -1 })
    .exec();
};

// Static method to get or create snapshot with smart caching
RecipeSnapshotSchema.statics.getOrCreateSnapshot = async function (
  recipeId: mongoose.Types.ObjectId,
  recipeData: any
): Promise<IRecipeSnapshot> {
  // Find latest snapshot using the static method
  const latestSnapshot = await this.findOne({ originalRecipeId: recipeId })
    .sort({ version: -1 })
    .exec();

  // If no snapshot exists, create first version
  if (!latestSnapshot) {
    return this.create({
      originalRecipeId: recipeId,
      version: 1,
      ...recipeData
    });
  }

  // Smart caching: compare timestamps
  // If live recipe hasn't been updated since snapshot creation, reuse snapshot
  if (
    recipeData.updatedAt &&
    latestSnapshot.createdAt >= recipeData.updatedAt
  ) {
    return latestSnapshot;
  }

  // Recipe has been updated, create new version
  return this.create({
    originalRecipeId: recipeId,
    version: latestSnapshot.version + 1,
    ...recipeData
  });
};

export default mongoose.model<IRecipeSnapshot, IRecipeSnapshotModel>(
  "RecipeSnapshot",
  RecipeSnapshotSchema
);
