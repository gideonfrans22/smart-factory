import { Response } from "express";
import { Product } from "../models/Product";
import { Recipe } from "../models/Recipe";
import { Project } from "../models/Project";
import { APIResponse, AuthenticatedRequest } from "../types";

// Get all products with pagination and filtering
export const getProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, customerName, personInCharge } = req.query;

    const query: any = {};
    if (customerName)
      query.customerName = { $regex: customerName, $options: "i" };
    if (personInCharge) query.personInCharge = personInCharge;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("personInCharge", "username email")
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

    const product = await Product.findById(id).populate(
      "personInCharge",
      "username email"
    );

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
        error: "VALIDATION_ERROR",
        message: "Design number already exists"
      };
      res.status(400).json(response);
      return;
    }

    // Default to current user if personInCharge not provided
    const assignedPersonInCharge = personInCharge || req.user?._id;

    const product = new Product({
      designNumber,
      productName,
      customerName,
      personInCharge: assignedPersonInCharge,
      quantityUnit,
      recipes: recipes || []
    });

    await product.save();

    const populatedProduct = await Product.findById(product._id).populate(
      "personInCharge",
      "username email"
    );

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
          error: "VALIDATION_ERROR",
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
    if (quantityUnit !== undefined) product.quantityUnit = quantityUnit;
    if (recipes !== undefined) product.recipes = recipes;

    await product.save();

    const populatedProduct = await Product.findById(product._id).populate(
      "personInCharge",
      "username email"
    );

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

    await Product.findByIdAndDelete(id);

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
