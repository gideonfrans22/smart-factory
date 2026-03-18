import mongoose, { Document, Query, Schema } from "mongoose";

export interface CustomerDocument extends Document {
  name: string;
  personInCharge: string;
  department?: string;
  notes?: string;
  modifiedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<CustomerDocument>(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [200, "Customer name cannot exceed 200 characters"]
    },
    personInCharge: {
      type: String,
      required: [true, "Person in charge is required"],
      trim: true,
      maxlength: [200, "Person in charge cannot exceed 200 characters"]
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department cannot exceed 100 characters"]
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"]
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

CustomerSchema.index({ name: 1 });

CustomerSchema.virtual("id").get(function (this: CustomerDocument) {
  return this._id;
});

CustomerSchema.pre(
  "find",
  function (this: Query<CustomerDocument[], CustomerDocument>) {
    this.populate("modifiedBy");
  }
);

export const Customer = mongoose.model<CustomerDocument>(
  "Customer",
  CustomerSchema
);
