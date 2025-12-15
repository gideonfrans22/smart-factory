import { Response } from "express";
import { Product } from "../models/Product";
import { Recipe } from "../models/Recipe";
import { Project } from "../models/Project";
import ProductSnapshot from "../models/ProductSnapshot";
import RecipeSnapshot from "../models/RecipeSnapshot";
import { APIResponse, AuthenticatedRequest } from "../types";
import { SnapshotService } from "../services/snapshotService";
import mongoose from "mongoose";

// Get all products with pagination and filtering
export const getProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      customerName,
      personInCharge,
      department
    } = req.query;

    const query: any = {};
    if (customerName)
      query.customerName = { $regex: customerName, $options: "i" };
    if (personInCharge) query.personInCharge = personInCharge;
    if (department) query.department = { $regex: department, $options: "i" };
    if (search) {
      query.$or = [
        { designNumber: { $regex: search, $options: "i" } },
        { productName: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Products retrieved successfully",
      data: {
        items: products,
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
    console.error("Get products error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get product by ID
export const getProductById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Product retrieved successfully",
      data: product
    };

    res.json(response);
  } catch (error) {
    console.error("Get product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get all recipes for a product
export const getProductRecipes = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Get all recipe details
    const recipeIds = product.recipes.map((r) => r.recipeId);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } });

    // Combine recipe data with quantity from product
    const recipesWithQuantity = product.recipes.map((pr) => {
      const recipeData = recipes.find((r) => r._id === pr.recipeId);
      return {
        recipe: recipeData,
        quantity: pr.quantity
      };
    });

    const response: APIResponse = {
      success: true,
      message: "Product recipes retrieved successfully",
      data: recipesWithQuantity
    };

    res.json(response);
  } catch (error) {
    console.error("Get product recipes error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Create new product
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes
    } = req.body;

    if (!designNumber || !productName) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Design number and product name are required"
      };
      res.status(400).json(response);
      return;
    }

    // Check if design number already exists
    const existingProduct = await Product.findOne({ designNumber });
    if (existingProduct) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Default to current user if personInCharge not provided
    const assignedPersonInCharge = personInCharge || req.user?.username;

    const product = new Product({
      designNumber,
      productName,
      customerName,
      personInCharge: assignedPersonInCharge,
      department,
      quantityUnit,
      recipes: recipes || [],
      modifiedBy: req.user?.id
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id);

    const response: APIResponse = {
      success: true,
      message: "Product created successfully",
      data: populatedProduct
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Update product
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      designNumber,
      productName,
      customerName,
      personInCharge,
      department,
      quantityUnit,
      recipes
    } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if design number is being changed to an existing one
    if (designNumber && designNumber !== product.designNumber) {
      const existingProduct = await Product.findOne({ designNumber });
      if (existingProduct) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DESIGN_NUMBER",
          message: "Design number already exists"
        };
        res.status(400).json(response);
        return;
      }
      product.designNumber = designNumber;
    }

    if (productName) product.productName = productName;
    if (customerName !== undefined) product.customerName = customerName;
    if (personInCharge) product.personInCharge = personInCharge;
    if (department !== undefined) product.department = department;
    if (quantityUnit !== undefined) product.quantityUnit = quantityUnit;
    if (recipes !== undefined) product.recipes = recipes;

    // Track who modified the product
    product.modifiedBy = req.user?.id;

    await product.save();

    const populatedProduct = await Product.findById(product._id);

    if (populatedProduct) {
      // Create snapshot for updated product
      await SnapshotService.getOrCreateProductSnapshot(
        populatedProduct._id as mongoose.Types.ObjectId
      );
    }

    const response: APIResponse = {
      success: true,
      message: "Product updated successfully",
      data: populatedProduct
    };

    res.json(response);
  } catch (error) {
    console.error("Update product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Delete product
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check if product is used in any project
    const projectsUsingProduct = await Project.findOne({
      "products.productId": id
    });

    if (projectsUsingProduct) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Cannot delete product. It is being used in one or more projects."
      };
      res.status(400).json(response);
      return;
    }

    product.modifiedBy = req.user?.id;
    await product.save();

    await Product.findOneAndDelete({
      _id: id
    });

    const response: APIResponse = {
      success: true,
      message: "Product deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Duplicate product
export const duplicateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { newDesignNumber, newProductName } = req.body;

    // Find the original product
    const originalProduct = await Product.findById(id);

    if (!originalProduct) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate new design number is provided
    if (!newDesignNumber) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "New design number is required for duplication"
      };
      res.status(400).json(response);
      return;
    }

    // Check if new design number already exists
    const existingProduct = await Product.findOne({
      designNumber: newDesignNumber
    });
    if (existingProduct) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DESIGN_NUMBER",
        message: "Design number already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Create the duplicate product with all recipes and properties
    const duplicatedProduct = new Product({
      designNumber: newDesignNumber,
      productName: newProductName || `${originalProduct.productName} (Copy)`,
      customerName: originalProduct.customerName,
      personInCharge: originalProduct.personInCharge,
      quantityUnit: originalProduct.quantityUnit,
      recipes: originalProduct.recipes.map((recipe) => ({
        recipeId: recipe.recipeId,
        quantity: recipe.quantity
      })),
      modifiedBy: req.user?.id
    });

    await duplicatedProduct.save();

    const populatedProduct = await Product.findById(duplicatedProduct._id);

    const response: APIResponse = {
      success: true,
      message: "Product duplicated successfully",
      data: {
        original: {
          _id: originalProduct._id,
          designNumber: originalProduct.designNumber,
          productName: originalProduct.productName
        },
        duplicate: populatedProduct
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Duplicate product error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

// Get product version history
export const getProductVersionHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify the product exists
    const product = await Product.findById(id);

    if (!product) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get all product snapshots for this product, sorted by version descending
    const total = await ProductSnapshot.countDocuments({
      originalProductId: id
    });

    const snapshots = await ProductSnapshot.find({
      originalProductId: id
    })
      .populate("modifiedBy", "name username email")
      .sort({ version: -1 })
      .skip(skip)
      .limit(limitNum);

    // For each product snapshot, populate the recipe snapshots
    const versionsWithRecipes = await Promise.all(
      snapshots.map(async (snapshot) => {
        const recipeSnapshotIds = snapshot.recipes.map(
          (r) => r.recipeSnapshotId
        );

        const recipeSnapshots = await RecipeSnapshot.find({
          _id: { $in: recipeSnapshotIds }
        });

        // Map recipes with their quantities and full snapshot data
        const recipesWithDetails = snapshot.recipes.map((pr) => {
          const recipeSnapshot = recipeSnapshots.find(
            (rs) => rs._id.toString() === pr.recipeSnapshotId.toString()
          );

          return {
            recipeSnapshot: recipeSnapshot
              ? {
                  _id: recipeSnapshot._id,
                  originalRecipeId: recipeSnapshot.originalRecipeId,
                  version: recipeSnapshot.version,
                  recipeNumber: recipeSnapshot.recipeNumber,
                  name: recipeSnapshot.name,
                  description: recipeSnapshot.description,
                  specification: recipeSnapshot.specification,
                  estimatedDuration: recipeSnapshot.estimatedDuration,
                  dwgNo: recipeSnapshot.dwgNo,
                  unit: recipeSnapshot.unit,
                  outsourcing: recipeSnapshot.outsourcing,
                  remarks: recipeSnapshot.remarks,
                  steps: recipeSnapshot.steps,
                  rawMaterials: recipeSnapshot.rawMaterials,
                  createdAt: recipeSnapshot.createdAt
                }
              : null,
            quantity: pr.quantity
          };
        });

        return {
          _id: snapshot._id,
          version: snapshot.version,
          productNumber: snapshot.productNumber,
          name: snapshot.name,
          description: snapshot.description,
          customerName: snapshot.customerName,
          personInCharge: snapshot.personInCharge,
          recipes: recipesWithDetails,
          modifiedBy: snapshot.modifiedBy,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt
        };
      })
    );

    const response: APIResponse = {
      success: true,
      message: "Product version history retrieved successfully",
      data: {
        currentProduct: {
          _id: product._id,
          designNumber: product.designNumber,
          productName: product.productName,
          updatedAt: product.updatedAt
        },
        versions: versionsWithRecipes,
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
    console.error("Get product version history error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
