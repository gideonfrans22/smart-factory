import mongoose, { Document, Schema } from "mongoose";
import { ISpecifications } from "./RawMaterial";

export interface IRecipeStep extends Document<mongoose.Types.ObjectId> {
  order: number;
  name: string;
  description: string;
  estimatedDuration: number;
  deviceTypeId: mongoose.Types.ObjectId; // Reference to DeviceType (not specific device)
  qualityChecks: string[];
  dependsOn: mongoose.Types.ObjectId[]; // Array of step _ids that must be completed first
  mediaIds: mongoose.Types.ObjectId[]; // References to Media documents
}

export interface IRawMaterialReference {
  materialId: mongoose.Types.ObjectId; // Reference to RawMaterial._id
  quantityRequired: number; // Quantity needed per unit produced
  specification?: ISpecifications; // Specifications like dimensions, weight, etc.
}

export interface IRecipe extends Document {
  recipeNumber?: string;
  version: number;
  name: string;
  description?: string;
  rawMaterials: IRawMaterialReference[]; // Array of raw materials required
  product?: mongoose.Types.ObjectId; // Reference to Product._id if this recipe is tied to a specific product
  steps: IRecipeStep[];
  estimatedDuration: number;
  deletedAt?: Date; // Soft delete timestamp
  isDeleted: boolean; // Virtual field for soft delete check
  createdAt: Date;
  updatedAt: Date;
}

const RecipeStepSchema: Schema = new Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    estimatedDuration: {
      type: Number,
      required: true,
      min: 0,
      comment: "Duration in minutes"
    },
    deviceTypeId: {
      type: Schema.Types.ObjectId,
      ref: "DeviceType",
      required: true,
      comment: "Type of device required for this step (not specific device)"
    },
    qualityChecks: {
      type: [String],
      default: []
    },
    dependsOn: {
      type: [Schema.Types.ObjectId],
      default: [],
      comment: "Array of step _ids that must be completed before this step"
    },
    mediaIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Media" }],
      default: [],
      comment: "References to Media documents"
    }
  },
  {
    timestamps: true,
    _id: true // Ensure MongoDB generates _id for each step subdocument
  }
);

const RecipeSchema: Schema = new Schema(
  {
    recipeNumber: {
      type: String,
      trim: true,
      maxlength: 50
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    description: {
      type: String,
      trim: true
    },
    rawMaterials: [
      {
        materialId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RawMaterial",
          required: true
        },
        quantityRequired: {
          type: Number,
          required: true,
          min: 0,
          comment: "Quantity needed per unit produced"
        },
        specification: {
          type: Schema.Types.Mixed,
          comment: "Specifications like dimensions, weight, color, etc."
        }
      }
    ],
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      comment:
        "Reference to Product._id if this recipe is tied to a specific product"
    },
    steps: {
      type: [RecipeStepSchema],
      required: true,
      validate: {
        validator: function (steps: IRecipeStep[]) {
          return steps.length > 0;
        },
        message: "Recipe must have at least one step"
      }
    },
    estimatedDuration: {
      type: Number,
      required: true,
      min: 0,
      comment: "Total duration in minutes (sum of all steps)"
    },
    deletedAt: {
      type: Date,
      default: null,
      comment: "Soft delete timestamp"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// translate _id to id
RecipeSchema.virtual("id").get(function (this: IRecipe) {
  return this._id;
});

// Virtual field for soft delete check
RecipeSchema.virtual("isDeleted").get(function (this: IRecipe) {
  return this.deletedAt != null;
});

// Query middleware to exclude soft-deleted documents by default
RecipeSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  if (!(options as any).includeDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

// populate Media references in steps as mediaFiles
RecipeSchema.pre<IRecipe>("find", function (next) {
  this.populate("steps.mediaIds");
  next();
});

// Indexes
RecipeSchema.index({ name: 1 });
RecipeSchema.index({ recipeNumber: 1 });
RecipeSchema.index({ deletedAt: 1 }); // For soft delete queries
RecipeSchema.index({ Product: 1 }); // For querying recipes by product
// Unique compound index on recipeNumber and version (sparse to allow null recipeNumbers)
RecipeSchema.index(
  { recipeNumber: 1, version: 1 },
  { unique: true, sparse: true }
);

// Helper function to validate step dependencies
function validateStepDependencies(steps: IRecipeStep[]): {
  valid: boolean;
  error?: string;
} {
  const stepIds = new Set(steps.map((step) => step._id.toString()));

  // Check for circular dependencies using topological sort
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (
    stepId: string,
    dependencyMap: Map<string, string[]>
  ): boolean => {
    visited.add(stepId);
    recursionStack.add(stepId);

    const dependencies = dependencyMap.get(stepId) || [];
    for (const depId of dependencies) {
      if (!visited.has(depId)) {
        if (hasCycle(depId, dependencyMap)) return true;
      } else if (recursionStack.has(depId)) {
        return true; // Circular dependency found
      }
    }

    recursionStack.delete(stepId);
    return false;
  };

  // Build dependency map
  const dependencyMap = new Map<string, string[]>();
  for (const step of steps) {
    const stepIdStr = step._id.toString();
    const dependsOnStr = (step.dependsOn || []).map((id) => id.toString());
    dependencyMap.set(stepIdStr, dependsOnStr);

    // Validate that all dependencies exist
    for (const depId of dependsOnStr) {
      if (!stepIds.has(depId)) {
        return {
          valid: false,
          error: `Step at order ${step.order} depends on non-existent step '${depId}'`
        };
      }
    }
  }

  // Check for circular dependencies
  for (const stepId of stepIds) {
    visited.clear();
    recursionStack.clear();
    if (hasCycle(stepId, dependencyMap)) {
      return {
        valid: false,
        error: `Circular dependency detected involving step '${stepId}'`
      };
    }
  }

  return { valid: true };
}

// Pre-save hook to calculate total duration and validate dependencies
RecipeSchema.pre("save", function (next) {
  const doc = this as unknown as IRecipe;

  if (doc.steps && doc.steps.length > 0) {
    // Calculate total duration
    doc.estimatedDuration = doc.steps.reduce(
      (total: number, step: IRecipeStep) => total + step.estimatedDuration,
      0
    );

    // Validate step dependencies
    const validation = validateStepDependencies(doc.steps);
    if (!validation.valid) {
      return next(new Error(validation.error));
    }
  }

  next();
});

// Pre-delete hook to soft delete recipe by setting deletedAt
RecipeSchema.pre("findOneAndDelete", async function (next) {
  try {
    const recipeId = this.getQuery()._id;

    // Soft delete by setting deletedAt
    await this.model.updateOne(
      { _id: recipeId },
      { $set: { deletedAt: new Date() } }
    );
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Recipe = mongoose.model<IRecipe>("Recipe", RecipeSchema);
