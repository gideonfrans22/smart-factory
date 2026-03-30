import mongoose, { Document, Schema } from "mongoose";
import { RawMaterialSpecification } from "@modules/raw-material";

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
  specification?: RawMaterialSpecification; // Specifications like dimensions, weight, etc.
}

export interface IRecipe extends Document {
  recipeNumber?: string; // Auto-generated format: "{Product.designNumber}" (only when product is linked)
  version: number; // Auto-generated, defaults to 1 on creation, increments on each update
  name: string;
  description?: string;
  rawMaterials: IRawMaterialReference[]; // Array of raw materials required
  product: mongoose.Types.ObjectId; // Reference to Product._id (REQUIRED)
  steps: IRecipeStep[];
  estimatedDuration: number;

  // Manufacturing metadata
  dwgNo?: string; // Drawing number (optional)
  unit?: string; // Unit (EA, kg, m) - defaults to "EA" (optional)
  outsourcing?: string; // Outsourcing vendor name (optional)
  remarks?: string; // Remarks/notes (비고) (optional)

  // Media fields
  mediaIds: mongoose.Types.ObjectId[]; // Media files

  deletedAt?: Date; // Soft delete timestamp
  isDeleted: boolean; // Virtual field for soft delete check
  modifiedBy?: mongoose.Types.ObjectId;
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
      default: "",
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
    _id: true
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
      required: true,
      comment: "Reference to Product._id (REQUIRED)"
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
    dwgNo: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
      comment: "Drawing number"
    },
    unit: {
      type: String,
      required: false,
      trim: true,
      default: "EA",
      maxlength: 20,
      comment: "Unit (EA, kg, m, etc.)"
    },
    outsourcing: {
      type: String,
      required: false,
      trim: true,
      maxlength: 255,
      comment: "Outsourcing vendor name"
    },
    remarks: {
      type: String,
      required: false,
      trim: true,
      comment: "Remarks/notes (비고)"
    },
    mediaIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Media" }],
      default: [],
      comment: "Media files"
    },
    deletedAt: {
      type: Date,
      default: null,
      comment: "Soft delete timestamp"
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

RecipeSchema.virtual("id").get(function (this: IRecipe) {
  return this._id;
});

RecipeSchema.virtual("isDeleted").get(function (this: IRecipe) {
  return this.deletedAt != null;
});

RecipeSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  if (!(options as any).includeDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

RecipeSchema.pre<IRecipe>("find", function (next) {
  this.populate("steps.mediaIds");
  next();
});

RecipeSchema.index({ name: 1 });
RecipeSchema.index({ recipeNumber: 1 });
RecipeSchema.index({ deletedAt: 1 });
RecipeSchema.index({ product: 1 });
RecipeSchema.index({ version: 1 });

function validateStepDependencies(steps: IRecipeStep[]): {
  valid: boolean;
  error?: string;
} {
  const stepIds = new Set(steps.map((step) => step._id.toString()));
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
        return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  };

  const dependencyMap = new Map<string, string[]>();
  for (const step of steps) {
    const stepIdStr = step._id.toString();
    const dependsOnStr = (step.dependsOn || []).map((id) => id.toString());
    dependencyMap.set(stepIdStr, dependsOnStr);

    for (const depId of dependsOnStr) {
      if (!stepIds.has(depId)) {
        return {
          valid: false,
          error: `Step at order ${step.order} depends on non-existent step '${depId}'`
        };
      }
    }
  }

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

RecipeSchema.pre("save", function (next) {
  const doc = this as unknown as IRecipe;

  if (doc.steps && doc.steps.length > 0) {
    doc.estimatedDuration = doc.steps.reduce(
      (total: number, step: IRecipeStep) => total + step.estimatedDuration,
      0
    );

    const validation = validateStepDependencies(doc.steps);
    if (!validation.valid) {
      return next(new Error(validation.error));
    }
  }

  next();
});

RecipeSchema.pre("findOneAndDelete", async function (next) {
  try {
    const recipeId = this.getQuery()._id;
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
