import mongoose, { Schema, Document } from "mongoose";

// Product Recipe Reference interface for snapshot
export interface IProductRecipeSnapshotReference {
  recipeSnapshotId: mongoose.Types.ObjectId; // Reference to RecipeSnapshot
  quantity: number; // How many times this recipe should be executed
}

// ProductSnapshot interface
export interface IProductSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  originalProductId: mongoose.Types.ObjectId; // Reference to the live Product
  version: number; // Snapshot version (increments on each update)
  productNumber?: string;
  name: string;
  description?: string;
  customerName?: string; // 고객명
  personInCharge?: string; // 담당자 (담당자명)
  recipes: IProductRecipeSnapshotReference[]; // References to RecipeSnapshots
  modifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date; // For smart caching: compare with Product.updatedAt
  updatedAt: Date;
}

// Static methods interface
export interface IProductSnapshotModel
  extends mongoose.Model<IProductSnapshot> {
  getLatestSnapshot(
    productId: mongoose.Types.ObjectId
  ): Promise<IProductSnapshot | null>;
  getOrCreateSnapshot(
    productId: mongoose.Types.ObjectId,
    productData: any
  ): Promise<IProductSnapshot>;
}

// Product Recipe Snapshot Reference Schema
const ProductRecipeSnapshotReferenceSchema =
  new Schema<IProductRecipeSnapshotReference>({
    recipeSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "RecipeSnapshot",
      required: true
    },
    quantity: { type: Number, required: true, min: 1 }
  });

// ProductSnapshot Schema
const ProductSnapshotSchema = new Schema<IProductSnapshot>(
  {
    originalProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    productNumber: { type: String },
    name: { type: String, required: true },
    description: { type: String },
    customerName: { type: String },
    personInCharge: { type: String },
    recipes: {
      type: [ProductRecipeSnapshotReferenceSchema],
      required: true,
      default: []
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Compound index for efficient querying and caching
ProductSnapshotSchema.index({ originalProductId: 1, version: -1 }); // Get latest version
ProductSnapshotSchema.index({ originalProductId: 1, createdAt: 1 }); // For cache checking

// Static method to get latest snapshot for a product
ProductSnapshotSchema.statics.getLatestSnapshot = async function (
  productId: mongoose.Types.ObjectId
): Promise<IProductSnapshot | null> {
  return this.findOne({ originalProductId: productId })
    .sort({ version: -1 })
    .exec();
};

// Static method to get or create snapshot with smart caching
ProductSnapshotSchema.statics.getOrCreateSnapshot = async function (
  productId: mongoose.Types.ObjectId,
  productData: any
): Promise<IProductSnapshot> {
  // Find latest snapshot using direct query
  const latestSnapshot = await this.findOne({ originalProductId: productId })
    .sort({ version: -1 })
    .exec();

  // If no snapshot exists, create first version
  if (!latestSnapshot) {
    return this.create({
      originalProductId: productId,
      version: 1,
      ...productData
    });
  }

  // Smart caching: compare timestamps
  // If live product hasn't been updated since snapshot creation, reuse snapshot
  if (
    productData.updatedAt &&
    latestSnapshot.createdAt >= productData.updatedAt
  ) {
    return latestSnapshot;
  }

  // Product has been updated, create new version
  return this.create({
    originalProductId: productId,
    version: latestSnapshot.version + 1,
    ...productData
  });
};

export default mongoose.model<IProductSnapshot, IProductSnapshotModel>(
  "ProductSnapshot",
  ProductSnapshotSchema
);
