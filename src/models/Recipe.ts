import mongoose, { Document, Schema } from "mongoose";

export interface IRecipeStepMedia {
  mediaId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  mediaType: "INSTRUCTION" | "DIAGRAM" | "VIDEO" | "QUALITY_CHECK";
  description?: string;
  uploadedAt: Date;
}

export interface IRecipeStep {
  stepId: string;
  order: number;
  name: string;
  description: string;
  estimatedDuration: number;
  requiredDevices: string[];
  qualityChecks: string[];
  dependsOn: string[]; // Array of stepIds that must be completed first
  media: IRecipeStepMedia[]; // Attached instructions, diagrams, videos
}

export interface IRecipe extends Document {
  productCode: string;
  version: number;
  name: string;
  description?: string;
  steps: IRecipeStep[];
  estimatedDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeStepMediaSchema: Schema = new Schema(
  {
    mediaId: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    mediaType: {
      type: String,
      required: true,
      enum: ["INSTRUCTION", "DIAGRAM", "VIDEO", "QUALITY_CHECK"],
      default: "INSTRUCTION"
    },
    description: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const RecipeStepSchema: Schema = new Schema(
  {
    stepId: {
      type: String,
      required: true
    },
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
    requiredDevices: {
      type: [String],
      default: []
    },
    qualityChecks: {
      type: [String],
      default: []
    },
    dependsOn: {
      type: [String],
      default: [],
      comment: "Array of stepIds that must be completed before this step"
    },
    media: {
      type: [RecipeStepMediaSchema],
      default: [],
      comment:
        "Attached instructions, diagrams, videos, and quality check documents"
    }
  },
  {
    timestamps: true
  }
);

const RecipeSchema: Schema = new Schema(
  {
    productCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    }
  },
  {
    timestamps: true
  }
);

// Indexes
RecipeSchema.index({ productCode: 1, version: 1 }, { unique: true });
RecipeSchema.index({ name: 1 });
RecipeSchema.index({ productCode: 1 });

// Helper function to validate step dependencies
function validateStepDependencies(steps: IRecipeStep[]): {
  valid: boolean;
  error?: string;
} {
  const stepIds = new Set(steps.map((step) => step.stepId));

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
    dependencyMap.set(step.stepId, step.dependsOn || []);

    // Validate that all dependencies exist
    for (const depId of step.dependsOn || []) {
      if (!stepIds.has(depId)) {
        return {
          valid: false,
          error: `Step '${step.stepId}' depends on non-existent step '${depId}'`
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

export const Recipe = mongoose.model<IRecipe>("Recipe", RecipeSchema);
