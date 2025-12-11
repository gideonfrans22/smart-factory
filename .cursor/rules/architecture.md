# Architecture Overview

## System Type
TypeScript + Express + MongoDB backend for a smart factory management system.

## Core Pattern
**Deferred snapshot creation with execution tracking** for historical data integrity and quantity management.

## Key Components

- **Projects**: Top-level containers with **Products** OR standalone **Recipes** (stores only live references)
- **Recipes**: Multi-step manufacturing processes with raw materials and device requirements
- **Tasks**: Executable work items auto-generated from recipe steps with execution tracking
- **RecipeSnapshot & ProductSnapshot**: Immutable copies created at task generation time (separate collections with versioning)
- **Execution Tracking**: System to manage multiple recipe executions per product with proper quantity calculation

## Hierarchy

```
Recipe (template)
  ├─ steps[] with deviceTypeId, estimatedDuration
  ├─ rawMaterials[] with quantities
  └─ Used by ↓

Product
  ├─ recipes[] array with { recipeId, quantity }
  └─ Used by ↓

Project (live references only)
  ├─ products[]: { productId, targetQuantity, producedQuantity }
  ├─ recipes[]: { recipeId, targetQuantity, producedQuantity }
  └─ Generates → Tasks (ALL first-step tasks for ALL executions)
```

## Key Files

### Models (`src/models/`)
- `Project.ts`: Live references only, pre-save progress calculation hook
- `Task.ts`: Task lifecycle with execution tracking fields
- `Recipe.ts`: Steps with `IRecipeStep` interface, soft delete support
- `Product.ts`: Products with recipe references and quantities, soft delete support
- `RecipeSnapshot.ts`: Immutable recipe snapshots with versioning (separate collection)
- `ProductSnapshot.ts`: Immutable product snapshots with versioning (separate collection)

### Controllers (`src/controllers/`)
- `projectController.ts`: Project CRUD, task generation on activation
- `taskController.ts`: Task lifecycle management, completion logic

### Services (`src/services/`)
- `snapshotService.ts`: Smart snapshot caching and creation

### Middleware (`src/middleware/`)
- `auth.ts`: JWT authentication (currently disabled)
- `upload.ts`: Multer file upload configuration

## Dependencies

- mongoose: MongoDB ODM with schemas and virtuals
- express: Web framework with TypeScript types
- jsonwebtoken + bcryptjs: Authentication
- multer: File upload handling
- mqtt: Real-time device communication
- helmet + cors + express-rate-limit: Security middleware

