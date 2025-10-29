import mongoose, { Document, Schema } from "mongoose";
import { IRecipeStep } from "./Recipe";
import { IProductRecipe } from "./Product";
import { ISpecifications } from "./RawMaterial";

export interface IProjectProductSnapshot {
  designNumber: string;
  productName: string;
  customerName?: string;
  quantityUnit?: string;
  recipes: IProductRecipe[];
}

export interface IProjectProduct {
  productId: mongoose.Types.ObjectId;
  snapshot: IProjectProductSnapshot;
  targetQuantity: number;
  producedQuantity: number;
}

export interface IProjectRawMaterialSnapshot {
  materialCode: string;
  name: string;
  specifications?: ISpecifications;
  supplier?: string;
  unit?: string;
}

export interface IProjectRawMaterialReference {
  materialId: mongoose.Types.ObjectId;
  snapshot: IProjectRawMaterialSnapshot;
  quantityRequired: number;
}

export interface IProjectRecipeSnapshot {
  recipeNumber?: string;
  version: number;
  name: string;
  description?: string;
  rawMaterials: IProjectRawMaterialReference[];
  steps: IRecipeStep[];
  estimatedDuration: number;
}

export interface IProjectRecipe {
  recipeId: mongoose.Types.ObjectId;
  snapshot: IProjectRecipeSnapshot;
  targetQuantity: number;
  producedQuantity: number;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  products: IProjectProduct[];
  recipes: IProjectRecipe[];
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate: Date;
  endDate: Date;
  deadline?: Date;
  progress: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectProductSnapshotSchema = new Schema(
  {
    designNumber: {
      type: String,
      required: true,
      trim: true
    },
    productName: {
      type: String,
      required: true,
      trim: true
    },
    customerName: {
      type: String,
      trim: true
    },
    quantityUnit: {
      type: String,
      trim: true
    },
    recipes: {
      type: [
        {
          recipeId: {
            type: String,
            required: true
          },
          quantity: {
            type: Number,
            required: true,
            default: 1
          }
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const ProjectProductSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    snapshot: {
      type: ProjectProductSnapshotSchema,
      required: true
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    producedQuantity: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const ProjectRawMaterialSnapshotSchema = new Schema(
  {
    materialCode: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    specifications: {
      type: Schema.Types.Mixed
    },
    supplier: {
      type: String,
      trim: true
    },
    unit: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const ProjectRawMaterialReferenceSchema = new Schema(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true
    },
    snapshot: {
      type: ProjectRawMaterialSnapshotSchema,
      required: true
    },
    quantityRequired: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const ProjectRecipeSnapshotSchema = new Schema(
  {
    recipeNumber: {
      type: String,
      trim: true
    },
    version: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    rawMaterials: {
      type: [ProjectRawMaterialReferenceSchema],
      default: []
    },
    steps: {
      type: [Schema.Types.Mixed],
      required: true
    },
    estimatedDuration: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const ProjectRecipeSchema = new Schema(
  {
    recipeId: {
      type: Schema.Types.ObjectId,
      ref: "Recipe",
      required: true
    },
    snapshot: {
      type: ProjectRecipeSnapshotSchema,
      required: true
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    producedQuantity: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const ProjectSchema: Schema = new Schema(
  {
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
    products: {
      type: [ProjectProductSchema],
      default: [],
      validate: {
        validator: function (products: IProjectProduct[]) {
          const recipes = (this as any).recipes || [];
          return products.length > 0 || recipes.length > 0;
        },
        message: "Project must have at least one product or one recipe"
      }
    },
    recipes: {
      type: [ProjectRecipeSchema],
      default: [],
      validate: {
        validator: function (recipes: IProjectRecipe[]) {
          const products = (this as any).products || [];
          return recipes.length > 0 || products.length > 0;
        },
        message: "Project must have at least one product or one recipe"
      }
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
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
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
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ priority: 1 });
ProjectSchema.index({ startDate: 1, endDate: 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ "products.productId": 1 });
ProjectSchema.index({ "recipes.recipeId": 1 });

// Pre-save hook to calculate progress automatically
ProjectSchema.pre("save", function (next) {
  const doc = this as unknown as IProject;

  // Calculate total produced and target quantities
  let totalProduced = 0;
  let totalTarget = 0;

  // Sum up products
  if (doc.products && doc.products.length > 0) {
    doc.products.forEach((product) => {
      totalProduced += product.producedQuantity || 0;
      totalTarget += product.targetQuantity || 0;
    });
  }

  // Sum up recipes
  if (doc.recipes && doc.recipes.length > 0) {
    doc.recipes.forEach((recipe) => {
      totalProduced += recipe.producedQuantity || 0;
      totalTarget += recipe.targetQuantity || 0;
    });
  }

  // Calculate progress percentage
  if (totalTarget > 0) {
    doc.progress = Math.round((totalProduced / totalTarget) * 100);
    // Ensure progress is between 0 and 100
    doc.progress = Math.min(100, Math.max(0, doc.progress));
  } else {
    doc.progress = 0;
  }

  next();
});

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
