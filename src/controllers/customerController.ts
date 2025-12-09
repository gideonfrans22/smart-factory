import { Response } from "express";
import Customer from "../models/Customer";
import { APIResponse, AuthenticatedRequest } from "../types";
import mongoose from "mongoose";

// Get all customers with pagination and filtering
export const getCustomers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { personInCharge: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Customers retrieved successfully",
      data: {
        items: customers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get customers error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get customer by ID
export const getCustomerById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Customer not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Customer retrieved successfully",
      data: customer
    };

    res.json(response);
  } catch (error) {
    console.error("Get customer error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Create new customer
export const createCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    const { name, personInCharge, notes } = req.body;

    // Validate required fields
    if (!name || !personInCharge) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name and personInCharge are required fields"
      };
      res.status(400).json(response);
      return;
    }

    const customer = new Customer({
      name,
      personInCharge,
      notes,
      modifiedBy: user?._id
    });

    await customer.save();

    const response: APIResponse = {
      success: true,
      message: "Customer created successfully",
      data: customer
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create customer error:", error);

    // Handle unique constraint error
    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Customer with this name already exists"
      };
      res.status(409).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Update customer
export const updateCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    const { id } = req.params;
    const { name, personInCharge, notes } = req.body;

    const customer = await Customer.findById(id);

    if (!customer) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Customer not found"
      };
      res.status(404).json(response);
      return;
    }

    // Update fields
    if (name !== undefined) customer.name = name;
    if (personInCharge !== undefined) customer.personInCharge = personInCharge;
    if (notes !== undefined) customer.notes = notes;
    if (user?._id) customer.modifiedBy = user?._id as mongoose.Types.ObjectId;

    await customer.save();

    const response: APIResponse = {
      success: true,
      message: "Customer updated successfully",
      data: customer
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update customer error:", error);

    // Handle unique constraint error
    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Customer with this name already exists"
      };
      res.status(409).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Delete customer
export const deleteCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Customer not found"
      };
      res.status(404).json(response);
      return;
    }

    await Customer.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Customer deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete customer error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
