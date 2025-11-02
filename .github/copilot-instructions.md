# Smart Factory Backend - AI Coding Agent Instructions

## 🏗️ Architecture Overview

This is a **TypeScript + Express + MongoDB** backend for a smart factory management system. The core pattern is **snapshot-based immutability** for historical data integrity.

### Key Components

- **Projects**: Top-level containers with **Products** OR standalone **Recipes**
- **Recipes**: Multi-step manufacturing processes with raw materials and device requirements
- **Tasks**: Executable work items auto-generated from recipe steps
- **Snapshots**: Immutable copies of data captured at project creation time

## 🎯 Critical Patterns

### 1. Snapshot Pattern (Most Important!)

Projects store **immutable snapshots** of products, recipes, steps, and raw materials. This ensures historical data remains unchanged even if original documents are modified.

```typescript
// ✅ CORRECT: Use snapshot data for tasks
const firstStep = projectProduct.snapshot.recipes[0].steps.find(
  (s) => s.order === 1
);

// ❌ WRONG: Don't fetch live Recipe document
const recipe = await Recipe.findById(recipeId); // Violates immutability
```

**Key locations:**

- `src/models/Project.ts`: Defines snapshot interfaces (`IProjectProductSnapshot`, `IProjectRecipeSnapshot`, `IProjectRawMaterialSnapshot`)
- `src/controllers/projectController.ts`: Creates snapshots in `createProject()` by populating and copying data
- `src/controllers/taskController.ts`: `completeTask()` must use snapshot steps, not live recipes

### 2. Task Auto-Generation Workflow

When a project status changes to `ACTIVE`, the system auto-creates PENDING tasks for the first step of each recipe:

```typescript
// In updateProject() when isActivating === true:
// 1. Iterate project.products[].snapshot.recipes[]
// 2. Find first step (order === 1) from snapshot.steps[]
// 3. Create Task with productId, recipeId, recipeStepId, deviceTypeId
// 4. Title format: "{stepName} - {productName} - {projectName}"
```

**Task completion triggers next task creation** in `completeTask()`:

- Find current step in snapshot
- Identify next step by order
- Create new PENDING task for next step

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

### 5. Recipe → Product → Project Hierarchy

```
Recipe (template)
  ├─ steps[] with deviceTypeId, estimatedDuration
  ├─ rawMaterials[] with quantities
  └─ Used by ↓

Product
  ├─ recipes[] array with { recipeId, quantity }
  └─ Used by ↓

Project
  ├─ products[] with full snapshots (including recipe details)
  ├─ recipes[] for standalone recipes
  └─ Generates → Tasks (one per step execution)
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

- **`Project.ts`**: Snapshot interfaces and pre-save progress calculation hook
- **`Task.ts`**: Task lifecycle with status enum (`PENDING`, `ONGOING`, `PAUSED`, `COMPLETED`, `FAILED`)
- **`Recipe.ts`**: Steps with `IRecipeStep` interface, dependencies via `dependsOn[]`
- **`Product.ts`**: Products with recipe references and quantities

### Controllers (`src/controllers/`)

- **`projectController.ts`**:
  - `createProject()`: Creates snapshots by populating raw materials
  - `updateProject()`: Auto-generates tasks on status change to ACTIVE (lines ~440-540)
- **`taskController.ts`**:
  - `completeTask()`: Marks task complete, auto-creates next step task
  - Always reads from project snapshots, not live Recipe documents

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

## �🚨 Common Pitfalls

1. **Don't fetch live Recipe/Product documents when working with project tasks**

   - Use `project.products[].snapshot` or `project.recipes[].snapshot`

2. **Update `api_spec/types/` when changing API contracts**

   - Changes must be committed to the submodule separately

3. **DeviceTypeId vs DeviceId**

   - Tasks require `deviceTypeId` (from recipe step) at creation
   - `deviceId` (specific device) is assigned when task becomes `ONGOING`

4. **Progress auto-calculation**

   - Project progress is calculated by pre-save hook based on `producedQuantity / targetQuantity`
   - Don't manually set `progress` field

5. **Task creation requires populated data**

   - When creating tasks in `updateProject()`, ensure snapshots include full step details (name, description, estimatedDuration, deviceTypeId)

6. **File naming convention**
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

**Last Updated:** November 2025 | **Architecture Version:** Snapshot-based with auto-task generation
