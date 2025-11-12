import mongoose, { Document, Schema } from "mongoose";

export interface IProductRecipe {
  recipeId: mongoose.Types.ObjectId; // Reference to Recipe._id
  quantity: number;
}

export interface IProduct extends Document {
  designNumber: string; // 설계번호
  productName: string; // 제품명
  customerName?: string; // 고객명
  personInCharge?: string; // 담당자 (담당자명)
  quantityUnit?: string; // 수량 단위
  recipes: IProductRecipe[]; // Array of recipes with quantities
  deletedAt?: Date; // Soft delete timestamp
  isDeleted: boolean; // Virtual field for soft delete check
  createdAt: Date;
  updatedAt: Date;
}

const ProductRecipeSchema = new Schema(
  {
    recipeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Recipe"
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 0
    }
  },
  { _id: false }
);

const ProductSchema: Schema = new Schema(
  {
    designNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    personInCharge: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100
    },
    quantityUnit: {
      type: String,
      trim: true,
      maxlength: 50
    },
    recipes: {
      type: [ProductRecipeSchema],
      default: []
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
ProductSchema.virtual("id").get(function (this: IProduct) {
  return this._id;
});

// Virtual field for soft delete check
ProductSchema.virtual("isDeleted").get(function (this: IProduct) {
  return this.deletedAt != null;
});

// Query middleware to exclude soft-deleted documents by default
ProductSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  if (!(options as any).includeDeleted) {
    this.where({ deletedAt: null });
  }
  next();
});

// Populate references before returning
ProductSchema.pre<IProduct>("findOne", function (next) {
  this.populate({
    path: "recipes.recipeId",
    options: { sort: { createdAt: 1 } }
  });
  this.populate({
    path: "recipes.recipeId",
    populate: {
      path: "rawMaterials.materialId",
      select: "materialCode name specifications supplier unit"
    }
  });
  next();
});
ProductSchema.pre<IProduct>("find", function (next) {
  this.populate({
    path: "recipes.recipeId",
    options: { sort: { createdAt: 1 } }
  });
  this.populate({
    path: "recipes.recipeId",
    populate: {
      path: "rawMaterials.materialId",
      select: "materialCode name specifications supplier unit"
    }
  });
  next();
});

// Pre-delete hook to soft delete product
ProductSchema.pre("findOneAndDelete", async function (next) {
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

// Indexes
ProductSchema.index({ designNumber: 1 });
ProductSchema.index({ productName: 1 });
ProductSchema.index({ customerName: 1 });
ProductSchema.index({ deletedAt: 1 }); // For soft delete queries

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
