# Smart Factory Backend - AI Coding Agent Instructions

## 🏗️ Architecture Overview

This is a **TypeScript + Express + MongoDB** backend for a smart factory management system. The core pattern is **deferred snapshot creation with execution tracking** for historical data integrity and quantity management.

### Key Components

- **Projects**: Top-level containers with **Products** OR standalone **Recipes** (stores only live references)
- **Recipes**: Multi-step manufacturing processes with raw materials and device requirements
- **Tasks**: Executable work items auto-generated from recipe steps with execution tracking
- **RecipeSnapshot & ProductSnapshot**: Immutable copies created at task generation time (separate collections with versioning)
- **Execution Tracking**: System to manage multiple recipe executions per product with proper quantity calculation

## 🎯 Critical Patterns

### 1. Deferred Snapshot Pattern (Most Important!)

Snapshots are created **at task generation time**, not at project creation. Projects store only **live references** to products and recipes.

```typescript
// ✅ CORRECT: Projects store live references
const project = {
  products: [{ productId: "abc123", targetQuantity: 10, producedQuantity: 0 }],
  recipes: [{ recipeId: "xyz789", targetQuantity: 5, producedQuantity: 0 }]
};

// ✅ CORRECT: Create snapshot when generating tasks
const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
  recipeId
);
const task = new Task({
  recipeSnapshotId: recipeSnapshot._id
  // ... other fields
});

// ✅ CORRECT: Use snapshot in task completion
const recipeSnapshot = await RecipeSnapshot.findById(task.recipeSnapshotId);
const nextStep = recipeSnapshot.steps.find(
  (s) => s.order === task.stepOrder + 1
);

// ❌ WRONG: Don't look for embedded snapshots in projects
const firstStep = project.products[0].snapshot.recipes[0].steps[0]; // No longer exists!
```

**Key locations:**

- `src/models/RecipeSnapshot.ts`: Separate collection with versioning and smart caching
- `src/models/ProductSnapshot.ts`: Separate collection with recipe snapshot references
- `src/services/snapshotService.ts`: Smart caching with `getOrCreateRecipeSnapshot()`
- `src/models/Project.ts`: Only stores live references (`productId`, `recipeId`) with quantities
- `src/controllers/projectController.ts`: `updateProject()` creates snapshots during task generation
- `src/controllers/taskController.ts`: `completeTask()` uses `RecipeSnapshot` model

### 2. Task Auto-Generation with Execution Tracking

When a project status changes to `ACTIVE`, the system creates **ALL first-step tasks for ALL executions** upfront:

```typescript
// In updateProject() when isActivating === true:
// For each product:
for (const productRecipe of product.recipes) {
  // Calculate total executions needed
  const totalExecutions =
    projectProduct.targetQuantity * productRecipe.quantity;

  // Create snapshot using SnapshotService (smart caching)
  const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
    recipeId
  );
  const firstStep = recipeSnapshot.steps.find((s) => s.order === 1);
  const maxStepOrder = Math.max(...recipeSnapshot.steps.map((s) => s.order));

  // Create ALL first-step tasks for ALL executions
  for (let execution = 1; execution <= totalExecutions; execution++) {
    await Task.create({
      title: `${firstStep.name} - Exec ${execution}/${totalExecutions} - ${productName}`,
      recipeExecutionNumber: execution, // Which execution (1 to N)
      totalRecipeExecutions: totalExecutions, // Total needed
      stepOrder: firstStep.order, // Step order in recipe
      isLastStepInRecipe: firstStep.order === maxStepOrder,
      recipeSnapshotId: recipeSnapshot._id // Reference to snapshot
      // ... other fields
    });
  }
}
```

**Task completion triggers next step creation** in `completeTask()`:

- Fetch recipe snapshot: `await RecipeSnapshot.findById(task.recipeSnapshotId)`
- If NOT last step: Create next step with **SAME execution number**
- Copy execution tracking fields: `recipeExecutionNumber`, `totalRecipeExecutions`, `stepOrder`
- If IS last step: Increment `producedQuantity` with proper calculation

### 3. MQTT Real-Time Communication

MQTT broker handles real-time bidirectional communication between backend and devices:

**Backend publishes:**

- New task assignments to devices
- KPI updates

**Backend subscribes to:**

- Alerts from devices
- Task status updates from devices

**Devices publish:**

- Alerts (errors, warnings, status changes)
- Task progress/completion updates

**Devices subscribe to:**

- New task notifications
- System commands

**Configuration:** `src/config/mqtt.ts` - Set `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` in `.env`

### 4. Git Submodule: `api_spec/`

The `api_spec/` directory is a **shared Git submodule** between frontend and backend:

```bash
# Initialize submodule
git submodule update --init --recursive

# Update submodule
cd api_spec && git pull origin main && cd ..
git add api_spec && git commit -m "Update api_spec"
```

**Always update TypeScript interfaces in `api_spec/types/` when modifying models or API responses.**

### 5. Quantity Tracking & Execution System

**Calculation Formulas:**

For **Products** (with recipe quantities):

```typescript
totalExecutions = product.targetQuantity × productRecipe.quantity
// Example: Need 10 units, recipe makes 2 per execution → 20 total executions
```

For **Standalone Recipes**:

```typescript
totalExecutions = recipe.targetQuantity;
// Example: Need 5 executions → 5 total executions
```

**ProducedQuantity Increment Logic:**

Only increments when `task.isLastStepInRecipe === true`

For **Products**:

```typescript
// Count completed recipe executions
const completedExecutions = await Task.countDocuments({
  projectId,
  productId,
  recipeId,
  isLastStepInRecipe: true,
  status: "COMPLETED"
});

// Calculate completed product units
const executionsPerUnit = productRecipe.quantity;
const completedUnits = Math.floor(completedExecutions / executionsPerUnit);
projectProduct.producedQuantity = completedUnits;
```

For **Standalone Recipes**:

```typescript
projectRecipe.producedQuantity += 1; // Direct increment
```

**Execution Number Propagation:**

Tasks in the same execution chain must maintain the same `recipeExecutionNumber`:

- Exec 1: Step 1 → Step 2 → Step 3 (all have executionNumber = 1)
- Exec 2: Step 1 → Step 2 → Step 3 (all have executionNumber = 2)

### 6. Recipe → Product → Project Hierarchy

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

## 🔧 Development Workflow

### Essential Commands

```bash
npm run dev          # Start with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to dist/
npm run seed         # Populate database with test data
```

### Database Seeding

Run `npm run seed` to populate the database with test users, devices, recipes, etc. Useful for development and testing.

**Location:** `src/utils/seed.ts`

### Environment Variables

Copy `.env.example` to `.env`. Key variables:

- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: Authentication token secret
- `PORT`: Server port (default: 3000)
- `CORS_ORIGIN`: Comma-separated allowed origins

## 📁 Key Files to Reference

### Models (`src/models/`)

- **`Project.ts`**: Live references only, pre-save progress calculation hook
- **`Task.ts`**: Task lifecycle with execution tracking fields (`recipeExecutionNumber`, `totalRecipeExecutions`, `stepOrder`, `isLastStepInRecipe`)
- **`Recipe.ts`**: Steps with `IRecipeStep` interface, soft delete support
- **`Product.ts`**: Products with recipe references and quantities, soft delete support
- **`RecipeSnapshot.ts`**: Immutable recipe snapshots with versioning (separate collection)
- **`ProductSnapshot.ts`**: Immutable product snapshots with versioning (separate collection)

### Controllers (`src/controllers/`)

- **`projectController.ts`**:
  - `createProject()`: Stores only live references (no snapshot creation)
  - `updateProject()`: Generates ALL first-step tasks for ALL executions on ACTIVE status
- **`taskController.ts`**:
  - `completeTask()`: Uses RecipeSnapshot model, creates next step with SAME execution number, increments producedQuantity when `isLastStepInRecipe=true`
  - `createTask()`: For standalone tasks only, creates snapshot via SnapshotService

### Services (`src/services/`)

- **`snapshotService.ts`**:
  - `getOrCreateRecipeSnapshot()`: Smart caching (compares createdAt vs updatedAt)
  - `getOrCreateProductSnapshot()`: Creates product snapshots with recipe snapshot references

### Middleware (`src/middleware/`)

- **`auth.ts`**: JWT authentication (`authenticateToken` middleware)
- **`upload.ts`**: Multer file upload configuration for media

## � Authentication State

**⚠️ AUTHENTICATION CURRENTLY DISABLED** (as of Oct 29, 2025)

- `src/middleware/auth.ts`: `authenticateToken` and `requireRole` middleware bypass all checks
- All routes are accessible without authentication tokens
- Console warnings indicate disabled state
- See `AUTH_TEMPORARILY_DISABLED.md` for re-enable instructions

When implementing auth-dependent features, be aware routes are currently open.

## 📤 Task Assignment & Worker Workflow

Tasks are assigned to **device types**, not specific devices or workers:

1. **Task Creation**: Task gets `deviceTypeId` from recipe step
2. **Worker Picks Task**: Workers at devices of matching type can claim any PENDING task
3. **Task Execution**: Worker assigns `deviceId` and `workerId` when status changes to `ONGOING`
4. **Quality Control**: Tasks have `qualityData` field (no specific workflow currently defined)

**Key insight**: Multiple workers at different devices of the same type can pick from the same task pool.

## 📁 Media File Handling

Files uploaded via Multer are stored in `uploads/media/` with standardized naming:

**Naming Convention:** `{timestamp}-{randomhash}-{sanitizedOriginalName}`

Example: `1698765432000-a3f8b2c1d4e5-blueprint.pdf`

**Implementation:**

- `src/middleware/upload.ts`: Multer configuration with storage and file filters
- Supported: Images (jpeg, png, gif, webp, svg), Documents (pdf, docx, xlsx, pptx), Videos (mp4, avi, mov)
- Max file size: 50MB (configurable)
- Files linked to tasks/recipes via Media model with metadata

## 🚨 Common Pitfalls

1. **Don't use embedded snapshots - they no longer exist in projects**

   - ❌ WRONG: `project.products[].snapshot.recipes[].steps`
   - ✅ CORRECT: Use `RecipeSnapshot.findById(task.recipeSnapshotId)`

2. **Always use SnapshotService for snapshot creation**

   - Smart caching prevents duplicate snapshots
   - Compares snapshot `createdAt` vs live document `updatedAt`

3. **Maintain execution number through task chains**

   - Next step task must have SAME `recipeExecutionNumber`
   - Copy all execution tracking fields: `recipeExecutionNumber`, `totalRecipeExecutions`, `stepOrder`, `isLastStepInRecipe`

4. **ProducedQuantity increment logic**

   - Only increment when `task.isLastStepInRecipe === true`
   - For products: `floor(completedExecutions / recipe.quantity)`
   - For standalone recipes: Direct increment

5. **Update `api_spec/types/` when changing API contracts**

   - Changes must be committed to the submodule separately

6. **DeviceTypeId vs DeviceId**

   - Tasks require `deviceTypeId` (from recipe step) at creation
   - `deviceId` (specific device) is assigned when task becomes `ONGOING`

7. **Progress auto-calculation**

   - Project progress is calculated by pre-save hook based on `producedQuantity / targetQuantity`
   - Don't manually set `progress` field

8. **Task creation workflow**

   - Project tasks are auto-generated on activation (ALL first-step tasks upfront)
   - Manual creation via API is for standalone tasks only
   - Snapshots are created during task generation, not project creation

9. **File naming convention**
   - Don't manually construct file paths; use the naming pattern from `upload.ts`
   - Always sanitize original filenames (replace special chars with underscores)

## 🎨 Code Style

- **TypeScript strict mode** enabled
- **Interface naming**: Prefix with `I` (e.g., `ITask`, `IProject`)
- **Response format**: All endpoints return `APIResponse<T>` with `success`, `message`, and optional `data`
- **Populate**: Use `.populate()` for referenced documents, but prefer snapshots in project context
- **Error handling**: Always wrap in try-catch, return appropriate HTTP status codes

## 📦 Dependencies

- **mongoose**: MongoDB ODM with schemas and virtuals
- **express**: Web framework with TypeScript types
- **jsonwebtoken + bcryptjs**: Authentication
- **multer**: File upload handling
- **mqtt**: Real-time device communication (configured in `src/config/mqtt.ts`)
- **helmet + cors + express-rate-limit**: Security middleware

## 🧪 Testing

Currently no automated tests configured. When adding tests:

- Use snapshot data to test task workflows
- Mock database connections
- Test task auto-generation on project activation

---

**Last Updated:** November 2025 | **Architecture Version:** Deferred snapshots with execution tracking and quantity management
