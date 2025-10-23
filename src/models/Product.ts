import mongoose, { Document, Schema } from "mongoose";

export interface IProductRecipe {
  recipeId: string;
  quantity: number;
}

export interface IProduct extends Document {
  designNumber: string; // 설계번호
  productName: string; // 제품명
  customerName?: string; // 고객명
  personInCharge: mongoose.Types.ObjectId; // 담당자 (User reference)
  quantityUnit?: string; // 수량 단위
  recipes: IProductRecipe[]; // Array of recipes with quantities
  createdAt: Date;
  updatedAt: Date;
}

const ProductRecipeSchema = new Schema(
  {
    recipeId: {
      type: String,
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
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },
    quantityUnit: {
      type: String,
      trim: true,
      maxlength: 50
    },
    recipes: {
      type: [ProductRecipeSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ProductSchema.index({ designNumber: 1 });
ProductSchema.index({ productName: 1 });
ProductSchema.index({ personInCharge: 1 });
ProductSchema.index({ customerName: 1 });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
