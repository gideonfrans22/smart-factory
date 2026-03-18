import mongoose from "mongoose";
import { Customer, CustomerDocument } from "./customer.model";
import {
  CustomerDTO,
  CustomerFilters,
  CustomerUpdateDTO
} from "./customer.types";

export interface CustomerListResult {
  items: CustomerDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class CustomerService {
  async list(filters: CustomerFilters = {}): Promise<CustomerListResult> {
    const { search, department, page = 1, limit = 10 } = filters;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { personInCharge: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } }
      ];
    }

    if (department) {
      query.department = { $regex: department, $options: "i" };
    }

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const total = await Customer.countDocuments(query);
    const items = await Customer.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async getById(id: string): Promise<CustomerDocument | null> {
    return Customer.findById(id).exec();
  }

  async create(
    data: CustomerDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<CustomerDocument> {
    const existing = await Customer.findOne({ name: data.name });
    if (existing) {
      const error: any = new Error("Customer with this name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    const doc = new Customer({
      ...data,
      modifiedBy: userId
    });

    return doc.save();
  }

  async update(
    id: string,
    data: CustomerUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<CustomerDocument | null> {
    const customer = await Customer.findById(id);
    if (!customer) {
      return null;
    }

    if (data.name && data.name !== customer.name) {
      const existing = await Customer.findOne({
        name: data.name,
        _id: { $ne: id }
      });
      if (existing) {
        const error: any = new Error("Customer with this name already exists");
        error.code = "DUPLICATE_NAME";
        throw error;
      }
      customer.name = data.name;
    }

    if (data.personInCharge !== undefined) {
      customer.personInCharge = data.personInCharge;
    }
    if (data.department !== undefined) {
      customer.department = data.department;
    }
    if (data.notes !== undefined) {
      customer.notes = data.notes;
    }
    if (userId) {
      customer.modifiedBy = userId;
    }

    await customer.save();
    return Customer.findById(id).populate("modifiedBy");
  }

  async remove(id: string): Promise<CustomerDocument | null> {
    return Customer.findByIdAndDelete(id).exec();
  }
}

export const customerService = new CustomerService();

