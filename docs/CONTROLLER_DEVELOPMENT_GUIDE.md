# Controller Development Guide

## 📋 Overview

This guide provides the **standardized pattern** for creating and maintaining controllers in the Smart Factory Backend API. All controllers **MUST** follow these conventions to ensure consistency, maintainability, and predictability across the entire codebase.

---
## tesss

## 🎯 Core Principles

1. **Consistency**: All controllers follow the same patterns
2. **Type Safety**: Use TypeScript types consistently
3. **Error Handling**: Standardized error codes and responses
4. **Pagination**: All list endpoints support pagination
5. **Validation**: Comprehensive input validation
6. **Logging**: Consistent error logging
7. **Response Structure**: Uniform API response format

---

## 📦 Required Imports

Every controller should import the following:

```typescript
import { Request, Response } from "express";
import { Model } from "../models/Model"; // Your Mongoose model
import { APIResponse, AuthenticatedRequest } from "../types";
```

**Optional imports based on needs:**

```typescript
import mongoose from "mongoose"; // For ObjectId operations
```

---

## 🏗️ Standard Controller Structure

### 1. Function Signature

**ALL controller functions MUST:**

- Be `async`
- Accept `req` and `res` parameters
- Return `Promise<void>`
- Use `AuthenticatedRequest` when JWT authentication is required

```typescript
export const functionName = async (
  req: Request, // or AuthenticatedRequest for protected routes
  res: Response
): Promise<void> => {
  try {
    // Function logic
  } catch (error) {
    // Error handling
  }
};
```

---

## 📊 List Endpoints (GET /resources)

### Pattern

```typescript
export const getResources = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Extract query parameters with defaults
    const { page = 1, limit = 10, ...filters } = req.query;

    // 2. Build query object
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    // Add search functionality if needed
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } }
      ];
    }

    // 3. Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 4. Get total count for pagination metadata
    const total = await Model.countDocuments(query);

    // 5. Fetch items with pagination
    const items = await Model.find(query)
      .populate("relatedField", "field1 field2") // Optional: populate related data
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 }); // Sort by newest first

    // 6. Build response with pagination
    const response: APIResponse = {
      success: true,
      message: "Resources retrieved successfully",
      data: {
        items: items,
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
    console.error("Get resources error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
```

### Key Requirements

✅ **Default pagination**: `page = 1, limit = 10`
✅ **Response structure**: `{ items: [], pagination: {} }`
✅ **Pagination metadata**: page, limit, total, totalPages, hasNext, hasPrev
✅ **Sorting**: Default to `createdAt: -1` (newest first)
✅ **Error logging**: `console.error()` with descriptive message

---

## 🔍 Get By ID Endpoints (GET /resources/:id)

### Pattern

```typescript
export const getResourceById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Extract ID from params
    const { id } = req.params;

    // 2. Fetch item and populate if needed
    const item = await Model.findById(id).populate(
      "relatedField",
      "field1 field2"
    );

    // 3. Handle not found
    if (!item) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Resource not found"
      };
      res.status(404).json(response);
      return;
    }

    // 4. Return success response
    const response: APIResponse = {
      success: true,
      message: "Resource retrieved successfully",
      data: item
    };

    res.json(response);
  } catch (error) {
    console.error("Get resource error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
```

### Key Requirements

✅ **404 handling**: Always check if item exists
✅ **Direct data**: Return item directly in `data` property (not in array)
✅ **Populate**: Include related data when needed
✅ **Early return**: Use `return` after sending error response

---

## ➕ Create Endpoints (POST /resources)

### Pattern

```typescript
export const createResource = async (
  req: AuthenticatedRequest, // Use AuthenticatedRequest if auth required
  res: Response
): Promise<void> => {
  try {
    // 1. Extract fields from body
    const { field1, field2, field3 } = req.body;

    // 2. Validate required fields
    if (!field1 || !field2) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Field1 and field2 are required"
      };
      res.status(400).json(response);
      return;
    }

    // 3. Additional validation (format, length, etc.)
    if (field1.length < 3) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Field1 must be at least 3 characters"
      };
      res.status(400).json(response);
      return;
    }

    // 4. Check for duplicates
    const existing = await Model.findOne({ field1 });
    if (existing) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: "Resource with this field1 already exists"
      };
      res.status(409).json(response);
      return;
    }

    // 5. Validate related entities exist
    if (field3) {
      const relatedEntity = await RelatedModel.findById(field3);
      if (!relatedEntity) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "Related entity not found"
        };
        res.status(404).json(response);
        return;
      }
    }

    // 6. Create new item
    const item = new Model({
      field1,
      field2,
      field3,
      createdBy: req.user?._id // If authenticated
    });

    await item.save();

    // 7. Populate if needed
    await item.populate("relatedField", "field1 field2");

    // 8. Return success with 201 status
    const response: APIResponse = {
      success: true,
      message: "Resource created successfully",
      data: item
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create resource error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
```

### Key Requirements

✅ **Validation first**: Validate all inputs before database operations
✅ **Duplicate check**: Check for existing items if needed
✅ **Related entities**: Validate foreign keys exist
✅ **201 status**: Use 201 for successful creation
✅ **Return created item**: Include the created item in response

---

## ✏️ Update Endpoints (PUT /resources/:id)

### Pattern

```typescript
export const updateResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Extract ID and updates
    const { id } = req.params;
    const { field1, field2 } = req.body;

    // 2. Find existing item
    const item = await Model.findById(id);

    if (!item) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Resource not found"
      };
      res.status(404).json(response);
      return;
    }

    // 3. Validate updates if needed
    if (field1 && field1.length < 3) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Field1 must be at least 3 characters"
      };
      res.status(400).json(response);
      return;
    }

    // 4. Check for duplicate if unique field is being updated
    if (field1 && field1 !== item.field1) {
      const existing = await Model.findOne({ field1, _id: { $ne: id } });
      if (existing) {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: "Resource with this field1 already exists"
        };
        res.status(409).json(response);
        return;
      }
    }

    // 5. Update fields
    if (field1 !== undefined) item.field1 = field1;
    if (field2 !== undefined) item.field2 = field2;

    await item.save();

    // 6. Populate if needed
    await item.populate("relatedField", "field1 field2");

    // 7. Return success
    const response: APIResponse = {
      success: true,
      message: "Resource updated successfully",
      data: item
    };

    res.json(response);
  } catch (error) {
    console.error("Update resource error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
```

### Key Requirements

✅ **Find first**: Check if item exists before updating
✅ **Partial updates**: Support updating individual fields
✅ **Validation**: Validate new values
✅ **Duplicate check**: Check if unique fields don't conflict
✅ **Return updated item**: Include the updated item in response

---

## 🗑️ Delete Endpoints (DELETE /resources/:id)

### Pattern

```typescript
export const deleteResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Extract ID
    const { id } = req.params;

    // 2. Find item
    const item = await Model.findById(id);

    if (!item) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Resource not found"
      };
      res.status(404).json(response);
      return;
    }

    // 3. Check dependencies (optional but recommended)
    const hasRelatedItems = await RelatedModel.findOne({ resourceId: id });
    if (hasRelatedItems) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Cannot delete resource. It is being used by other entities."
      };
      res.status(400).json(response);
      return;
    }

    // 4. Delete item
    await Model.findByIdAndDelete(id);

    // 5. Return success WITHOUT data property
    const response: APIResponse = {
      success: true,
      message: "Resource deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete resource error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
```

### Key Requirements

✅ **Check existence**: Verify item exists before deleting
✅ **Check dependencies**: Prevent deletion if item is referenced elsewhere
✅ **No data property**: Delete responses should NOT include `data` field
✅ **200 status**: Use default 200 status for successful deletion

---

## 🚨 Error Handling Standards

### Standardized Error Codes

Use these error codes consistently across ALL controllers:

| Error Code              | HTTP Status | When to Use                                           |
| ----------------------- | ----------- | ----------------------------------------------------- |
| `VALIDATION_ERROR`      | 400         | Invalid input, missing required fields, format errors |
| `NOT_FOUND`             | 404         | Resource doesn't exist                                |
| `CONFLICT`              | 409         | Duplicate resource, unique constraint violation       |
| `UNAUTHORIZED`          | 401         | Invalid credentials, missing authentication           |
| `FORBIDDEN`             | 403         | User doesn't have permission                          |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server errors, database errors             |

### Error Response Pattern

```typescript
const response: APIResponse = {
  success: false,
  error: "ERROR_CODE",
  message: "Human-readable error message"
};
res.status(httpStatusCode).json(response);
return; // Always return after sending error response
```

### Catch Block Pattern

```typescript
} catch (error) {
  console.error("Descriptive error message:", error);
  const response: APIResponse = {
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "Internal server error"
  };
  res.status(500).json(response);
}
```

**⚠️ NEVER:**

- Use `"SERVER_ERROR"` - always use `"INTERNAL_SERVER_ERROR"`
- Omit the `error` property in error responses
- Send detailed error messages to client in production
- Forget to log errors with `console.error()`

---

## ✅ Response Format Standards

### Success Response (Single Item)

```typescript
const response: APIResponse = {
  success: true,
  message: "Resource retrieved successfully",
  data: item // Direct object
};
res.json(response);
```

### Success Response (List with Pagination)

```typescript
const response: APIResponse = {
  success: true,
  message: "Resources retrieved successfully",
  data: {
    items: items, // Array of items
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
```

### Success Response (Creation)

```typescript
const response: APIResponse = {
  success: true,
  message: "Resource created successfully",
  data: item
};
res.status(201).json(response);
```

### Success Response (Deletion)

```typescript
const response: APIResponse = {
  success: true,
  message: "Resource deleted successfully"
  // NO data property
};
res.json(response);
```

### Error Response

```typescript
const response: APIResponse = {
  success: false,
  error: "ERROR_CODE",
  message: "Human-readable error message"
};
res.status(httpStatusCode).json(response);
```

---

## 📝 Validation Best Practices

### 1. Required Fields Validation

```typescript
if (!field1 || !field2) {
  const response: APIResponse = {
    success: false,
    error: "VALIDATION_ERROR",
    message: "Field1 and field2 are required"
  };
  res.status(400).json(response);
  return;
}
```

### 2. Format Validation

```typescript
// Email validation
if (email && !validateEmail(email)) {
  const response: APIResponse = {
    success: false,
    error: "VALIDATION_ERROR",
    message: "Invalid email format"
  };
  res.status(400).json(response);
  return;
}

// Length validation
if (password.length < 6) {
  const response: APIResponse = {
    success: false,
    error: "VALIDATION_ERROR",
    message: "Password must be at least 6 characters long"
  };
  res.status(400).json(response);
  return;
}
```

### 3. Foreign Key Validation

```typescript
const relatedEntity = await RelatedModel.findById(relatedId);
if (!relatedEntity) {
  const response: APIResponse = {
    success: false,
    error: "NOT_FOUND",
    message: "Related entity not found"
  };
  res.status(404).json(response);
  return;
}
```

### 4. Duplicate Validation

```typescript
const existing = await Model.findOne({ uniqueField: value });
if (existing) {
  const response: APIResponse = {
    success: false,
    error: "CONFLICT",
    message: "Resource already exists"
  };
  res.status(409).json(response);
  return;
}
```

---

## 🔐 Authentication Patterns

### Using AuthenticatedRequest

For protected routes that require authentication:

```typescript
export const createResource = async (
  req: AuthenticatedRequest, // Instead of Request
  res: Response
): Promise<void> => {
  try {
    // Access authenticated user
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Use in model creation
    const item = new Model({
      field1: req.body.field1,
      createdBy: userId
    });

    // ...rest of logic
  } catch (error) {
    // ...error handling
  }
};
```

### Role-Based Authorization

```typescript
// Check user role
if (req.user?.role !== "admin") {
  const response: APIResponse = {
    success: false,
    error: "FORBIDDEN",
    message: "Admin access required"
  };
  res.status(403).json(response);
  return;
}
```

---

## 🎨 Code Style Guidelines

### 1. Naming Conventions

- **Functions**: camelCase with verb prefix
  - `getResources`, `getResourceById`, `createResource`, `updateResource`, `deleteResource`
- **Variables**: camelCase
  - `pageNum`, `limitNum`, `total`, `items`
- **Constants**: UPPER_SNAKE_CASE
  - `JWT_SECRET`, `DEFAULT_PAGE_SIZE`

### 2. Ordering

Functions should be ordered in this sequence:

1. GET list (getResources)
2. GET by ID (getResourceById)
3. POST create (createResource)
4. PUT update (updateResource)
5. DELETE (deleteResource)
6. Any custom endpoints

### 3. Comments

Add JSDoc comments for each function:

```typescript
/**
 * Get all resources with pagination and filtering
 * GET /api/resources?page=1&limit=10&status=ACTIVE
 */
export const getResources = async (
  req: Request,
  res: Response
): Promise<void> => {
  // ...
};
```

---

## 📋 Checklist for New Controllers

Before submitting a new controller, ensure:

- [ ] All functions have `Promise<void>` return type
- [ ] All functions use `async/await`
- [ ] List endpoints implement pagination with defaults `page=1, limit=10`
- [ ] List responses use `{ items: [], pagination: {} }` structure
- [ ] Error responses include `error` property with standardized codes
- [ ] All errors are logged with `console.error()`
- [ ] 404 checks are performed before operations
- [ ] Validation is done before database operations
- [ ] Duplicate checks are performed where needed
- [ ] Foreign key validations are implemented
- [ ] Delete responses do NOT include `data` property
- [ ] Create operations return 201 status code
- [ ] AuthenticatedRequest is used for protected routes
- [ ] Related data is populated when needed
- [ ] JSDoc comments are added for each function
- [ ] No TypeScript errors
- [ ] Follows CRUD function ordering

---

## 🚀 Example: Complete CRUD Controller

```typescript
import { Request, Response } from "express";
import { Product } from "../models/Product";
import { APIResponse, AuthenticatedRequest } from "../types";

/**
 * Get all products with pagination and filtering
 * GET /api/products?page=1&limit=10&status=ACTIVE&search=keyword
 */
export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const items = await Product.find(query)
      .populate("category", "name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Products retrieved successfully",
      data: {
        items,
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

/**
 * Get product by ID
 * GET /api/products/:id
 */
export const getProductById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await Product.findById(id).populate("category", "name");

    if (!item) {
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
      data: item
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

/**
 * Create new product
 * POST /api/products
 */
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, categoryId, price } = req.body;

    if (!name || !price) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name and price are required"
      };
      res.status(400).json(response);
      return;
    }

    const existing = await Product.findOne({ name });
    if (existing) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: "Product already exists"
      };
      res.status(409).json(response);
      return;
    }

    const item = new Product({
      name,
      description,
      categoryId,
      price,
      createdBy: req.user?._id
    });

    await item.save();
    await item.populate("category", "name");

    const response: APIResponse = {
      success: true,
      message: "Product created successfully",
      data: item
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

/**
 * Update product
 * PUT /api/products/:id
 */
export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;

    const item = await Product.findById(id);

    if (!item) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
      return;
    }

    if (name && name !== item.name) {
      const existing = await Product.findOne({ name, _id: { $ne: id } });
      if (existing) {
        const response: APIResponse = {
          success: false,
          error: "CONFLICT",
          message: "Product with this name already exists"
        };
        res.status(409).json(response);
        return;
      }
    }

    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;
    if (price !== undefined) item.price = price;

    await item.save();
    await item.populate("category", "name");

    const response: APIResponse = {
      success: true,
      message: "Product updated successfully",
      data: item
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

/**
 * Delete product
 * DELETE /api/products/:id
 */
export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await Product.findById(id);

    if (!item) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Product not found"
      };
      res.status(404).json(response);
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
```

---

## 🎓 Common Mistakes to Avoid

### ❌ DON'T

```typescript
// Wrong: No Promise<void> return type
export const getResources = async (req: Request, res: Response) => {

// Wrong: Direct array response (no pagination structure)
res.json({ success: true, data: items });

// Wrong: Using "SERVER_ERROR"
error: "SERVER_ERROR"

// Wrong: Missing error property
{ success: false, message: "Error" }

// Wrong: Including data: null in delete response
{ success: true, message: "Deleted", data: null }

// Wrong: Not returning after error response
res.status(404).json(response);
console.log("This will execute!"); // Bug!

// Wrong: No error logging
} catch (error) {
  res.status(500).json({ success: false });
}
```

### ✅ DO

```typescript
// Correct: Promise<void> return type
export const getResources = async (
  req: Request,
  res: Response
): Promise<void> => {

// Correct: Pagination structure
res.json({
  success: true,
  data: { items, pagination: {...} }
});

// Correct: Use "INTERNAL_SERVER_ERROR"
error: "INTERNAL_SERVER_ERROR"

// Correct: Include error property
{ success: false, error: "NOT_FOUND", message: "Not found" }

// Correct: No data property in delete response
{ success: true, message: "Deleted successfully" }

// Correct: Return after error response
res.status(404).json(response);
return; // Prevents further execution

// Correct: Log errors
} catch (error) {
  console.error("Operation error:", error);
  res.status(500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "Internal server error"
  });
}
```

---

## 📚 Additional Resources

- See existing controllers for reference:

  - `userController.ts` - Gold standard example
  - `deviceController.ts` - Good population example
  - `taskController.ts` - Good filtering example
  - `projectController.ts` - Complex relationships example

- Type definitions: `src/types/index.ts`
- Helper functions: `src/utils/helpers.ts`
- Middleware: `src/middleware/auth.ts`

---

## 🔄 Review Process

Before considering your controller complete:

1. ✅ Run TypeScript compilation: `npm run build`
2. ✅ Check for linting errors: `npm run lint` (if configured)
3. ✅ Test all endpoints with Postman
4. ✅ Verify error handling (try invalid inputs)
5. ✅ Check pagination works correctly
6. ✅ Verify authentication/authorization
7. ✅ Review against this guide's checklist

---

## 📝 Version History

- **v1.0.0** (2025-10-29): Initial standardization guide
  - Consolidated patterns from 14+ existing controllers
  - Standardized error codes and response structures
  - Fixed inconsistencies across codebase

---

**Remember**: Consistency is key! Following these patterns makes the codebase:

- ✨ Easier to understand
- 🔧 Easier to maintain
- 🐛 Easier to debug
- 📈 More scalable
- 👥 More collaborative

When in doubt, refer to this guide or look at `userController.ts` as the gold standard example.
