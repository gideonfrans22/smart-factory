# Smart Factory Backend Documentation

Complete documentation for the Smart Factory backend API system.

## 📚 Core Documentation

### Database & Schema

**[MONGODB_SCHEMA.md](MONGODB_SCHEMA.md)** - _Most Important Reference_

- Complete schema definitions for all 14 MongoDB collections
- Field types, indexes, validation rules
- Query examples and relationships
- Current collections: Users, Devices, Tasks, TaskMedia, Projects, Recipes, RawMaterials, Products, Alerts, EmergencyReports, KPIData, Reports, ActivityLogs, Sessions

### Feature Documentation

**[DEVICE_TYPE_IMPLEMENTATION.md](DEVICE_TYPE_IMPLEMENTATION.md)** - _NEW Feature_

- Device type categorization system
- Flexible device assignment for tasks
- Worker can select from available devices
- Complete API endpoints and workflows
- Migration guide from old system

**[RAW_MATERIAL_IMPLEMENTATION.md](RAW_MATERIAL_IMPLEMENTATION.md)**

- Raw material inventory management system
- Material specifications (dimensions, weight, color)
- Recipe-to-material relationships
- Snapshot architecture for immutability
- Cascade deletion prevention
- Complete API endpoints with examples

**[TASK_FLOW_ARCHITECTURE.md](TASK_FLOW_ARCHITECTURE.md)**

- Task creation and assignment workflow
- Recipe step integration
- Product manufacturing flow
- Worker assignment (`workerId` field)
- Task dependencies and progress tracking

**[PROJECT_MODEL_ARCHITECTURE.md](PROJECT_MODEL_ARCHITECTURE.md)**

- Project structure and lifecycle
- Product and recipe snapshots
- Immutable data architecture
- Progress calculation
- Timeline tracking

### Project Information

**[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)**

- Complete project file organization
- Module responsibilities
- Directory structure

**[API_IMPLEMENTATION_COMPLETE.md](API_IMPLEMENTATION_COMPLETE.md)**

- Implementation status checklist
- Completed features
- Testing status

## 🏗️ System Architecture

### Key Architectural Patterns

**1. Snapshot-Based Immutability**

- Projects create immutable snapshots of products and recipes
- Raw material data frozen at project creation time
- Ensures manufacturing traceability and audit trails
- Changes to recipes/products don't affect active projects

**2. Auto-Generated ObjectIds**

- All MongoDB subdocuments use auto-generated `_id` fields
- Recipe steps: No manual `stepId`, use `step._id`
- Recipe media: No manual `mediaId`, use `media._id`
- Ensures uniqueness and simplifies references

**3. Cascade Prevention**

- Cannot delete raw materials used in recipes
- Cannot delete recipes used in projects
- Cannot delete products used in projects
- Protects data integrity across relationships

### Recent Breaking Changes

**October 2025 Refactoring:**

1. **Recipe Model:**

   - ❌ Removed: `productCode`, manual `stepId`, manual `mediaId`
   - ✅ Added: `rawMaterials[]` array, optional `recipeNumber`
   - ✅ Changed: Steps and media now use MongoDB `_id` (ObjectId)

2. **Task Model:**

   - ❌ Removed: `assignedTo` field
   - ✅ Added: `workerId`, `recipeId`, `productId`, `recipeStepId`
   - ✅ Purpose: Better integration with recipes and products

3. **Project Model:**

   - ✅ Added: `products[]` and `recipes[]` arrays
   - ✅ Added: Snapshot architecture with raw materials
   - ✅ Enhanced: Automatic progress calculation

4. **New Models:**
   - ✅ `RawMaterial` - Complete inventory system
   - ✅ `Product` - Product catalog management

## 📖 Quick Reference

### Most Common Operations

**Creating a Recipe with Raw Materials:**

```javascript
POST /api/recipes
{
  "name": "Steel Frame Assembly",
  "description": "Manufacturing process...",
  "rawMaterials": [
    { "materialId": "67...", "quantityRequired": 5 },
    { "materialId": "68...", "quantityRequired": 2 }
  ],
  "steps": [
    { "title": "Cut steel", "description": "..." }
  ]
}
```

**Creating a Project with Snapshots:**

```javascript
POST /api/projects
{
  "projectName": "Order #1234",
  "products": ["product_id_1"],
  "recipes": ["recipe_id_1"]
}
// Backend automatically creates immutable snapshots
```

**Assigning a Task to a Worker:**

```javascript
POST /api/tasks
{
  "taskName": "Assembly Step 1",
  "workerId": "user_id",  // Note: workerId, not assignedTo
  "recipeId": "recipe_id",
  "recipeStepId": "step_object_id"
}
```

## 🗂️ API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Core Resources

- `/api/users` - User management
- `/api/devices` - Device management
- `/api/projects` - Project CRUD with snapshots
- `/api/recipes` - Recipe CRUD with raw materials
- `/api/products` - Product catalog
- `/api/raw-materials` - Raw material inventory
- `/api/tasks` - Task management
- `/api/alerts` - Alert system
- `/api/reports` - Reporting
- `/api/kpi` - KPI tracking

### Media Management

- `/api/recipe-media` - Recipe step media uploads
- `/api/task-media` - Task documentation media

## ⚠️ Legacy Documentation

The `legacy/` folder contains outdated documentation from before the October 2025 refactoring. These files have incorrect field names, outdated schemas, and missing features.

**Do not use these files for reference:**

- ❌ `RECIPE_ENHANCEMENTS_TESTING.md`
- ❌ `RECIPE_ENHANCEMENTS_ARCHITECTURE.md`
- ❌ `BACKEND_API_SPECIFICATION.md`

See `legacy/README.md` for details on why these were deprecated.

## 🔍 Finding Information

**Need database schema?** → `MONGODB_SCHEMA.md`  
**Need raw material docs?** → `RAW_MATERIAL_IMPLEMENTATION.md`  
**Need task workflow?** → `TASK_FLOW_ARCHITECTURE.md`  
**Need project structure?** → `PROJECT_MODEL_ARCHITECTURE.md`  
**Need implementation status?** → `API_IMPLEMENTATION_COMPLETE.md`

---

**Last Updated:** October 25, 2025  
**Version:** 2.0 (Post-refactoring)
