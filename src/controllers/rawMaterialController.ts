import { Response } from "express";
import { ISpecifications, RawMaterial } from "../models/RawMaterial";
import { Recipe } from "../models/Recipe";
import {
  APIResponse,
  AuthenticatedRequest,
  ImportResult,
  VerifyResult
} from "../types";
import mongoose from "mongoose";
import {
  generateRawMaterialTemplate,
  parseRawMaterialWorkbook
} from "../services/rawMaterialImportService";

// Get all raw materials with pagination and filtering
export const getAllRawMaterials = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { supplier, search, page = 1, limit = 10 } = req.query;

    // Build query
    const query: any = {};
    if (supplier) {
      query.supplier = { $regex: supplier, $options: "i" };
    }
    if (search) {
      query.$or = [
        { materialCode: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await RawMaterial.countDocuments(query);

    // Get raw materials
    const rawMaterials = await RawMaterial.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ materialCode: 1 });

    const response: APIResponse = {
      success: true,
      message: "Raw materials retrieved successfully",
      data: {
        items: rawMaterials,
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
    const user = req.user;

    const {
      materialCode,
      name,
      description,
      specifications,
      supplier,
      unit,
      currentStock
    } = req.body;

    // Validate required fields
    if (!materialCode || !name) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Material code and name are required"
      };
      res.status(400).json(response);
      return;
    }

    // Check if material name already exists
    const existing = await RawMaterial.findOne({
      name: name.toUpperCase()
    });
    if (existing) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Material name already exists"
      };
      res.status(409).json(response);
      return;
    }

    // Create raw material
    const rawMaterial = new RawMaterial({
      materialCode,
      name: name.toUpperCase(),
      description,
      specifications,
      supplier,
      unit,
      currentStock,
      modifiedBy: user?._id
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
    const user = req.user;
    const { id } = req.params;
    const {
      materialCode,
      name,
      description,
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

    // Check if new material name conflicts with existing
    if (name && name.toUpperCase() !== rawMaterial.name) {
      const existing = await RawMaterial.findOne({
        name: name,
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
      rawMaterial.name = name.toUpperCase();
    }

    // Update fields
    if (materialCode !== undefined) rawMaterial.materialCode = materialCode;
    if (description !== undefined) rawMaterial.description = description;
    if (specifications !== undefined)
      rawMaterial.specifications = specifications;
    if (supplier !== undefined) rawMaterial.supplier = supplier;
    if (unit !== undefined) rawMaterial.unit = unit;
    if (currentStock !== undefined) rawMaterial.currentStock = currentStock;
    if (user?._id)
      rawMaterial.modifiedBy = user?._id as mongoose.Types.ObjectId;

    // Track who modified the raw material
    await rawMaterial.save();

    const newRawMaterial = await RawMaterial.findById(id).populate(
      "modifiedBy"
    );

    const response: APIResponse = {
      success: true,
      message: "Raw material updated successfully",
      data: newRawMaterial
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
      message: "Raw material deleted successfully"
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

export const downloadRawMaterialTemplate = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const workbook = await generateRawMaterialTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="raw-materials-import-template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Download raw material template error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to generate template."
    };
    res.status(500).json(response);
  }
};

export const verifyRawMaterialImport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      const response: APIResponse = {
        success: false,
        error: "FILE_REQUIRED",
        message: "No file uploaded."
      };
      res.status(400).json(response);
      return;
    }

    const parsed = await parseRawMaterialWorkbook(req.file.buffer);

    const existingByName = await RawMaterial.find({
      name: { $in: parsed.materials.map((m) => m.name) }
    }).lean();
    const existingNameSet = new Set<string>(
      existingByName.map((m: any) => m.name)
    );

    let toCreate = 0;
    let toUpdate = 0;

    parsed.materials.forEach((m) => {
      if (existingNameSet.has(m.name)) {
        toUpdate++;
      } else {
        toCreate++;
      }
    });

    // For specifications: we only compute counts here; dedup is done in import
    const rawMaterialsFound = parsed.materials.length;
    const specificationsFound = parsed.specifications.length;

    const hardErrors = parsed.errors.filter((e) => e.severity === "error");

    const result: VerifyResult = {
      valid: hardErrors.length === 0,
      summary: {
        rawMaterialsFound,
        specificationsFound,
        errors: parsed.errors
      }
    };

    const response: APIResponse<VerifyResult> = {
      success: true,
      message: "Raw material import verification completed.",
      data: result
    };

    res.status(hardErrors.length > 0 ? 400 : 200).json(response);
  } catch (error) {
    console.error("Verify raw material import error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred during import verification."
    };
    res.status(500).json(response);
  }
};

export const importRawMaterials = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      const response: APIResponse = {
        success: false,
        error: "FILE_REQUIRED",
        message: "No file uploaded."
      };
      res.status(400).json(response);
      return;
    }

    const parsed = await parseRawMaterialWorkbook(req.file.buffer);
    const hardErrors = parsed.errors.filter((e) => e.severity === "error");

    if (hardErrors.length > 0) {
      const verifyResult: VerifyResult = {
        valid: false,
        summary: {
          rawMaterialsFound: parsed.materials.length,
          specificationsFound: parsed.specifications.length,
          errors: parsed.errors
        }
      };

      const response: APIResponse<VerifyResult> = {
        success: false,
        message: "Import failed due to validation errors. No data was written.",
        data: verifyResult,
        error: "VALIDATION_ERROR"
      };

      res.status(400).json(response);
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Upsert materials by name
    for (const material of parsed.materials) {
      const existing = await RawMaterial.findOne({ name: material.name });

      if (existing) {
        existing.materialCode = material.materialCode;
        if (material.description !== undefined) {
          existing.description = material.description;
        }
        if (material.supplier !== undefined) {
          existing.supplier = material.supplier;
        }
        if (material.unit !== undefined) {
          existing.unit = material.unit;
        }
        if (material.currentStock !== undefined) {
          existing.currentStock = material.currentStock;
        }
        if (req.user?._id) {
          existing.modifiedBy = req.user._id as mongoose.Types.ObjectId;
        }
        await existing.save();
        updated++;
      } else {
        await RawMaterial.create({
          materialCode: material.materialCode,
          name: material.name,
          description: material.description,
          supplier: material.supplier,
          unit: material.unit,
          currentStock:
            material.currentStock !== undefined ? material.currentStock : 0,
          modifiedBy: req.user?._id
        });
        created++;
      }
    }

    // Reload materials into a map for specs processing
    const materialDocs = await RawMaterial.find({
      name: { $in: parsed.specifications.map((s) => s.materialName) }
    });
    const materialMap = new Map<string, typeof RawMaterial.prototype>();
    materialDocs.forEach((doc) => {
      materialMap.set(doc.name, doc);
    });

    for (const spec of parsed.specifications) {
      const materialDoc = materialMap.get(spec.materialName);
      if (!materialDoc) {
        continue;
      }

      const specsArray = materialDoc.specifications || [];

      const isDuplicate = specsArray.some((existingSpec: ISpecifications) => {
        const dims = existingSpec.dimensions || {};
        const weight = existingSpec.weight || {};

        const sameColor = (existingSpec.color || "") === (spec.color || "");
        const sameLength =
          (dims.length ?? undefined) === (spec.dimensions?.length ?? undefined);
        const sameWidth =
          (dims.width ?? undefined) === (spec.dimensions?.width ?? undefined);
        const sameHeight =
          (dims.height ?? undefined) === (spec.dimensions?.height ?? undefined);
        const sameDimUnit =
          (dims.unit || undefined) === (spec.dimensions?.unit || undefined);
        const sameWeightValue =
          (weight.value ?? undefined) === (spec.weight?.value ?? undefined);
        const sameWeightUnit =
          (weight.unit || undefined) === (spec.weight?.unit || undefined);
        const sameSupplier =
          (existingSpec.supplier || undefined) ===
          (spec.specSupplier || undefined);

        return (
          sameColor &&
          sameLength &&
          sameWidth &&
          sameHeight &&
          sameDimUnit &&
          sameWeightValue &&
          sameWeightUnit &&
          sameSupplier
        );
      });

      if (isDuplicate) {
        skipped++;
        continue;
      }

      specsArray.push({
        color: spec.color,
        dimensions: spec.dimensions,
        weight: spec.weight,
        supplier: spec.specSupplier
      } as any);

      materialDoc.specifications = specsArray;

      if (req.user?._id) {
        materialDoc.modifiedBy = req.user._id as mongoose.Types.ObjectId;
      }

      await materialDoc.save();
    }

    const result: ImportResult = {
      success: true,
      summary: {
        created,
        updated,
        skipped,
        errors: parsed.errors
      }
    };

    const response: APIResponse<ImportResult> = {
      success: true,
      message: "Import completed successfully.",
      data: result
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Import raw materials error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred during import. Please try again."
    };
    res.status(500).json(response);
  }
};
