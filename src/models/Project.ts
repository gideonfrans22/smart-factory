import mongoose, { Document, Schema } from "mongoose";
import { generateProjectNumber } from "../services/projectService";

/**
 * Project Document Interface
 * Single product OR recipe per project architecture
 */
export interface IProject extends Document {
  name: string; // Auto-generated: "Product/Recipe Name (Qty: X)"
  projectNumber: string; // Auto-generated: "SUMAN-YYYY-MM-DD-XXX"
  description?: string;

  // Product or Recipe references
  product?: mongoose.Types.ObjectId; // Reference to Product
  recipe?: mongoose.Types.ObjectId; // Reference to Recipe

  // Denormalized snapshots - EXACTLY ONE of these must be set
  productSnapshot?: mongoose.Types.ObjectId; // Reference to ProductSnapshot
  recipeSnapshot?: mongoose.Types.ObjectId; // Reference to RecipeSnapshot

  targetQuantity: number; // How many units to produce
  producedQuantity: number; // How many units completed

  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate?: Date;
  endDate?: Date;
  deadline?: Date;
  progress: number; // Auto-calculated: (producedQuantity / targetQuantity) * 100
  createdBy: mongoose.Types.ObjectId;
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    projectNumber: {
      type: String
    },
    description: {
      type: String,
      trim: true
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product"
    },
    recipe: {
      type: Schema.Types.ObjectId,
      ref: "Recipe"
    },
    productSnapshot: {
      type: Schema.Types.ObjectId,
      ref: "ProductSnapshot"
    },
    recipeSnapshot: {
      type: Schema.Types.ObjectId,
      ref: "RecipeSnapshot"
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    producedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
      default: "PLANNING"
    },
    priority: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM"
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    deadline: {
      type: Date
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
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
ProjectSchema.virtual("id").get(function (this: IProject) {
  return this._id;
});

// Virtual: isDeleted
ProjectSchema.virtual("isDeleted").get(function (this: IProject) {
  return !!this.deletedAt;
});

// Custom validation: Exactly ONE of productSnapshot or recipeSnapshot must be set
ProjectSchema.path("productSnapshot").validate(function (value: any) {
  const doc = this as any;
  const hasProduct = !!value;
  const hasRecipe = !!doc.recipeSnapshot;

  // Must have exactly one
  if (!hasProduct && !hasRecipe) {
    return false;
  }
  if (hasProduct && hasRecipe) {
    return false;
  }
  return true;
}, "Project must have exactly one product or one recipe (not both, not neither)");

ProjectSchema.path("recipeSnapshot").validate(function (value: any) {
  const doc = this as any;
  const hasRecipe = !!value;
  const hasProduct = !!doc.productSnapshot;

  // Must have exactly one
  if (!hasProduct && !hasRecipe) {
    return false;
  }
  if (hasProduct && hasRecipe) {
    return false;
  }
  return true;
}, "Project must have exactly one product or one recipe (not both, not neither)");

// Indexes
ProjectSchema.index(
  { projectNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { projectNumber: { $type: "string" } }
  }
);
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ priority: 1 });
ProjectSchema.index({ startDate: 1, endDate: 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ recipe: 1 });
ProjectSchema.index({ product: 1 });
ProjectSchema.index({ productSnapshot: 1 });
ProjectSchema.index({ recipeSnapshot: 1 });

// Pre-save hook: Auto-generate project number with retry logic
ProjectSchema.pre("save", async function (next) {
  const doc = this as unknown as IProject;

  // Only generate project number when changing the status to ACTIVE
  if (!doc.projectNumber && doc.status === "ACTIVE") {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        doc.projectNumber = await generateProjectNumber();
        break; // Success, exit loop
      } catch (error: any) {
        retries++;
        if (retries >= maxRetries) {
          return next(
            new Error(
              `Failed to generate unique project number after ${maxRetries} attempts`
            )
          );
        }
        // Wait a bit before retrying (10ms)
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  next();
});
// Pre-get hook to exclude soft-deleted projects
ProjectSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  if (!(options as any).includeDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

// Pre-delete hook to soft delete project
ProjectSchema.pre("findOneAndDelete", async function (next) {
  try {
    const docToDelete = await this.model.findOne(this.getFilter());
    if (docToDelete) {
      docToDelete.deletedAt = new Date();
      await docToDelete.save();
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
