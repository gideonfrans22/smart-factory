import { Response } from "express";
import { RawMaterial } from "../models/RawMaterial";
import { Recipe } from "../models/Recipe";
import { APIResponse, AuthenticatedRequest } from "../types";

// Get all raw materials
export const getAllRawMaterials = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const rawMaterials = await RawMaterial.find().sort({ materialCode: 1 });

    const response: APIResponse = {
      success: true,
      message: "Raw materials retrieved successfully",
      data: rawMaterials
    };
    res.json(response);
  } catch (error) {
    console.error("Get all raw materials error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get raw material by ID
export const getRawMaterialById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Raw material not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Raw material retrieved successfully",
      data: rawMaterial
    };
    res.json(response);
  } catch (error) {
    console.error("Get raw material by ID error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Create new raw material
export const createRawMaterial = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      materialCode,
      name,
      materialType,
      specifications,
      supplier,
      unit,
      currentStock
    } = req.body;

    // Validate required fields
    if (!materialCode || !name || !materialType) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Material code, name, and material type are required"
      };
      res.status(400).json(response);
      return;
    }

    // Check if material code already exists
    const existing = await RawMaterial.findOne({
      materialCode: materialCode.toUpperCase()
    });
    if (existing) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Material code already exists"
      };
      res.status(409).json(response);
      return;
    }

    // Create raw material
    const rawMaterial = new RawMaterial({
      materialCode: materialCode.toUpperCase(),
      name,
      materialType: materialType.toUpperCase(),
      specifications,
      supplier,
      unit,
      currentStock
    });

    await rawMaterial.save();

    const response: APIResponse = {
      success: true,
      message: "Raw material created successfully",
      data: rawMaterial
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create raw material error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: error.message
      };
      res.status(400).json(response);
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Material code already exists"
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

// Update raw material
export const updateRawMaterial = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      materialCode,
      name,
      materialType,
      specifications,
      supplier,
      unit,
      currentStock
    } = req.body;

    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Raw material not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if new material code conflicts with existing
    if (
      materialCode &&
      materialCode.toUpperCase() !== rawMaterial.materialCode
    ) {
      const existing = await RawMaterial.findOne({
        materialCode: materialCode.toUpperCase(),
        _id: { $ne: id }
      });
      if (existing) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_ERROR",
          message: "Material code already exists"
        };
        res.status(409).json(response);
        return;
      }
      rawMaterial.materialCode = materialCode.toUpperCase();
    }

    // Update fields
    if (name !== undefined) rawMaterial.name = name;
    if (materialType !== undefined)
      rawMaterial.materialType = materialType.toUpperCase();
    if (specifications !== undefined)
      rawMaterial.specifications = specifications;
    if (supplier !== undefined) rawMaterial.supplier = supplier;
    if (unit !== undefined) rawMaterial.unit = unit;
    if (currentStock !== undefined) rawMaterial.currentStock = currentStock;

    await rawMaterial.save();

    const response: APIResponse = {
      success: true,
      message: "Raw material updated successfully",
      data: rawMaterial
    };
    res.json(response);
  } catch (error: any) {
    console.error("Update raw material error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: error.message
      };
      res.status(400).json(response);
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Material code already exists"
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

// Delete raw material
export const deleteRawMaterial = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if raw material exists
    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Raw material not found"
      };
      res.status(404).json(response);
      return;
    }

    // Prevent deletion if raw material is used in any recipe
    const recipeUsingMaterial = await Recipe.findOne({
      "rawMaterials.materialId": id
    });

    if (recipeUsingMaterial) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: `Cannot delete raw material. It is used in recipe: ${recipeUsingMaterial.name} (${recipeUsingMaterial.recipeNumber})`
      };
      res.status(409).json(response);
      return;
    }

    await RawMaterial.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Raw material deleted successfully",
      data: null
    };
    res.json(response);
  } catch (error) {
    console.error("Delete raw material error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
