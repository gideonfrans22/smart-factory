import mongoose, { Document, Query, Schema } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  personInCharge: string;
  department?: string; // 부서명
  notes?: string;
  modifiedBy?: mongoose.Types.ObjectId; // User who last updated this customer
  deletedAt?: Date; // Soft delete timestamp
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
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

// Index for faster lookups
customerSchema.index({ name: 1 });

customerSchema.virtual("id").get(function (this: ICustomer) {
  return this._id;
});

// populate modifiedBy
customerSchema.pre("find", function (this: Query<ICustomer[], ICustomer>) {
  this.populate("modifiedBy");
});

const Customer = mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
