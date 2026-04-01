import mongoose, { Document, Schema } from "mongoose";

export interface IRawMaterialType extends Document {
  code: string;
  name: string;
  deletedAt?: Date | null;
  isDeleted: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RawMaterialTypeSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: [true, "Code is required"],
      trim: true,
      maxlength: 100
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 200
    },
    deletedAt: {
      type: Date,
      default: null,
      comment: "Soft delete timestamp"
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    deletedBy: {
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

RawMaterialTypeSchema.virtual("id").get(function (this: IRawMaterialType) {
  return this._id;
});

RawMaterialTypeSchema.virtual("isDeleted").get(function (
  this: IRawMaterialType
) {
  return this.deletedAt != null;
});

RawMaterialTypeSchema.pre(
  /^countDocuments/,
  function (this: mongoose.Query<unknown, unknown>, next) {
    const options = this.getOptions();
    if (!(options as { includeDeleted?: boolean }).includeDeleted) {
      this.where({ deletedAt: null });
    }
    next();
  }
);

RawMaterialTypeSchema.pre(
  /^find/,
  function (this: mongoose.Query<unknown, unknown>, next) {
    const options = this.getOptions();
    if (!(options as { includeDeleted?: boolean }).includeDeleted) {
      this.where({ deletedAt: null });
    }
    next();
  }
);

RawMaterialTypeSchema.index({ code: 1 });
RawMaterialTypeSchema.index({ deletedAt: 1 });
RawMaterialTypeSchema.index(
  { code: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const RawMaterialType = mongoose.model<IRawMaterialType>(
  "RawMaterialType",
  RawMaterialTypeSchema
);
