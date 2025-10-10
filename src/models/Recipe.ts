import mongoose, { Document, Schema } from "mongoose";

export interface IRecipeStep {
  stepId: string;
  order: number;
  name: string;
  description: string;
  estimatedDuration: number;
  requiredDevices: string[];
  qualityChecks: string[];
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
    }
  },
  { _id: false }
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

// Virtual to calculate total duration from steps
RecipeSchema.pre("save", function (next) {
  const doc = this as unknown as IRecipe;
  if (doc.steps && doc.steps.length > 0) {
    doc.estimatedDuration = doc.steps.reduce(
      (total: number, step: IRecipeStep) => total + step.estimatedDuration,
      0
    );
  }
  next();
});

export const Recipe = mongoose.model<IRecipe>("Recipe", RecipeSchema);
