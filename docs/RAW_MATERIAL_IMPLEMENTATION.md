# Raw Material Management System - Implementation Summary

**Date:** October 25, 2025  
**Status:** ✅ Complete

---

## 🎯 Overview

Implemented a complete **Raw Material Management System** that integrates with the existing Recipe and Project models. Raw materials can now be tracked, managed, and automatically snapshotted when used in projects for full traceability and immutability.

---

## 📋 Implementation Details

### **1. RawMaterial Model** (`src/models/RawMaterial.ts`)

#### **Schema Structure:**

```typescript
interface IRawMaterial {
  materialCode: string; // Unique identifier (e.g., "MAT-001")
  name: string; // Material name (e.g., "Steel Plate")
  materialType: string; // Type (e.g., "METAL", "PLASTIC")
  specifications?: {
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string; // e.g., "mm", "cm", "m"
    };
    weight?: {
      value?: number;
      unit?: string; // e.g., "kg", "g"
    };
    color?: string;
  };
  supplier?: string; // Optional supplier name
  unit?: string; // Optional unit of measure
  currentStock?: number; // Optional current stock quantity
}
```

#### **Key Features:**

- ✅ Unique `materialCode` (auto-uppercase, indexed)
- ✅ Flexible `specifications` object for custom properties
- ✅ Optional fields for supplier, unit, stock tracking
- ✅ Timestamps (createdAt, updatedAt)

---

### **2. Recipe Model Updates** (`src/models/Recipe.ts`)

#### **New Field:**

```typescript
interface IRecipe {
  // ... existing fields
  rawMaterials: IRawMaterialReference[];
  // ... other fields
}

interface IRawMaterialReference {
  materialId: ObjectId; // Reference to RawMaterial
  quantityRequired: number; // Quantity needed per unit produced
}
```

#### **Integration:**

- ✅ Recipes can now reference **multiple raw materials**
- ✅ Each reference tracks `quantityRequired` per unit produced
- ✅ Validated on recipe creation/update

---

### **3. Project Model Updates** (`src/models/Project.ts`)

#### **New Snapshot Structure:**

```typescript
interface IProjectRecipeSnapshot {
  // ... existing fields
  rawMaterials: IProjectRawMaterialReference[];
  // ... other fields
}

interface IProjectRawMaterialReference {
  materialId: ObjectId;
  snapshot: IProjectRawMaterialSnapshot; // Full material data frozen
  quantityRequired: number;
}

interface IProjectRawMaterialSnapshot {
  materialCode: string;
  name: string;
  materialType: string;
  specifications?: ISpecifications;
  supplier?: string;
  unit?: string;
}
```

#### **Snapshot Behavior:**

- ✅ When project is created, raw materials are **frozen as snapshots**
- ✅ Changes to master raw material data don't affect active projects
- ✅ Full traceability for audit and compliance

---

### **4. API Endpoints** (`/api/raw-materials`)

All endpoints require authentication via JWT token.

#### **GET /api/raw-materials**

Get all raw materials.

**Response:**

```json
{
  "success": true,
  "message": "Raw materials retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "materialCode": "MAT-001",
      "name": "Steel Plate",
      "materialType": "METAL",
      "specifications": {
        "dimensions": {
          "length": 1000,
          "width": 500,
          "height": 5,
          "unit": "mm"
        },
        "weight": {
          "value": 15.5,
          "unit": "kg"
        },
        "color": "Silver"
      },
      "supplier": "ABC Steel Co.",
      "unit": "sheet",
      "currentStock": 50,
      "createdAt": "2025-10-25T10:00:00Z",
      "updatedAt": "2025-10-25T10:00:00Z"
    }
  ]
}
```

---

#### **GET /api/raw-materials/:id**

Get raw material by ID.

**Response:**

```json
{
  "success": true,
  "message": "Raw material retrieved successfully",
  "data": {
    /* Raw material object */
  }
}
```

---

#### **POST /api/raw-materials**

Create new raw material.

**Request Body:**

```json
{
  "materialCode": "MAT-002",
  "name": "Aluminum Rod",
  "materialType": "METAL",
  "specifications": {
    "dimensions": {
      "length": 3000,
      "width": 50,
      "height": 50,
      "unit": "mm"
    },
    "weight": {
      "value": 2.5,
      "unit": "kg"
    },
    "color": "Silver"
  },
  "supplier": "XYZ Metals",
  "unit": "piece",
  "currentStock": 100
}
```

**Response:**

```json
{
  "success": true,
  "message": "Raw material created successfully",
  "data": {
    /* Created raw material */
  }
}
```

**Validation:**

- `materialCode`, `name`, `materialType` are **required**
- `materialCode` must be **unique**
- `currentStock` must be >= 0 if provided

---

#### **PUT /api/raw-materials/:id**

Update existing raw material.

**Request Body:** (all fields optional)

```json
{
  "name": "Updated Name",
  "specifications": {
    "dimensions": {
      "length": 3500
    }
  },
  "currentStock": 150
}
```

**Response:**

```json
{
  "success": true,
  "message": "Raw material updated successfully",
  "data": {
    /* Updated raw material */
  }
}
```

---

#### **DELETE /api/raw-materials/:id**

Delete raw material (with cascade prevention).

**Response (Success):**

```json
{
  "success": true,
  "message": "Raw material deleted successfully",
  "data": null
}
```

**Response (Conflict - Used in Recipe):**

```json
{
  "success": false,
  "error": "CONFLICT",
  "message": "Cannot delete raw material. It is used in recipe: Welding Process (REC-001)"
}
```

---

### **5. Controller Logic**

#### **rawMaterialController.ts**

- ✅ Full CRUD operations
- ✅ Cascade deletion prevention (checks if used in recipes)
- ✅ Duplicate `materialCode` detection
- ✅ Input validation

#### **recipeController.ts Updates**

- ✅ `createRecipe`: Validates raw materials exist before creating recipe
- ✅ `updateRecipe`: Allows updating raw materials with validation
- ✅ Both functions verify `materialId` references valid raw materials

#### **projectController.ts Updates**

- ✅ `createProject`:
  - Populates raw materials when fetching recipe
  - Creates **full snapshots** of all raw materials
  - Stores snapshots in recipe snapshot within project

---

## 🔄 Data Flow

### **Creating a Recipe with Raw Materials:**

```
1. User sends recipe data with rawMaterials array
2. Controller validates each materialId exists
3. Recipe created with references to raw materials
4. Recipe stored with materialId + quantityRequired
```

### **Creating a Project:**

```
1. User creates project with recipeId
2. Controller fetches recipe with .populate('rawMaterials.materialId')
3. For each raw material:
   - Extract full material data
   - Create immutable snapshot
   - Store in project.recipes[].snapshot.rawMaterials[]
4. Project saved with frozen raw material data
```

### **Recipe Execution:**

```
- Tasks reference recipe snapshot in project
- Raw material data is immutable (from snapshot)
- Quantity calculations use snapshot values
- Master raw material updates don't affect active projects
```

---

## 🔐 Data Integrity

### **Cascade Prevention:**

1. **RawMaterial → Recipe:**

   - Cannot delete raw material if used in any recipe
   - Check: `Recipe.findOne({ "rawMaterials.materialId": id })`

2. **Recipe → Project:**
   - Cannot delete recipe if used in any project (existing logic)

### **Validation Chain:**

```
Raw Material Creation
  ↓
Recipe Creation (validates materials exist)
  ↓
Project Creation (snapshots materials)
  ↓
Task Execution (uses snapshot data)
```

---

## 📊 Example Usage Flow

### **Step 1: Create Raw Materials**

```bash
POST /api/raw-materials
{
  "materialCode": "MAT-STEEL-001",
  "name": "Stainless Steel Sheet",
  "materialType": "METAL",
  "specifications": {
    "dimensions": { "length": 2000, "width": 1000, "height": 3, "unit": "mm" },
    "weight": { "value": 20, "unit": "kg" },
    "color": "Silver"
  },
  "supplier": "Steel Corp",
  "unit": "sheet",
  "currentStock": 100
}

POST /api/raw-materials
{
  "materialCode": "MAT-PLASTIC-001",
  "name": "ABS Plastic Pellets",
  "materialType": "PLASTIC",
  "specifications": {
    "weight": { "value": 25, "unit": "kg" },
    "color": "Black"
  },
  "unit": "kg",
  "currentStock": 500
}
```

### **Step 2: Create Recipe with Raw Materials**

```bash
POST /api/recipes
{
  "recipeNumber": "REC-WELD-001",
  "name": "Steel Welding Process",
  "description": "Weld steel sheets together",
  "rawMaterials": [
    {
      "materialId": "507f1f77bcf86cd799439011",  // MAT-STEEL-001
      "quantityRequired": 2  // 2 sheets per unit
    }
  ],
  "steps": [
    {
      "name": "Cut Steel",
      "description": "Cut steel to size",
      "estimatedDuration": 30,
      "deviceId": "device_laser_cutter"
    },
    {
      "name": "Weld Pieces",
      "description": "Weld cut pieces",
      "estimatedDuration": 45,
      "deviceId": "device_welding_station"
    }
  ]
}
```

### **Step 3: Create Project (Auto-Snapshots Raw Materials)**

```bash
POST /api/projects
{
  "name": "Q4 Production Run",
  "recipes": [
    {
      "recipeId": "recipe_weld_001",
      "targetQuantity": 50  // Need 50 units
    }
  ],
  "startDate": "2025-11-01",
  "endDate": "2025-11-30"
}
```

**Result:** Project created with:

- Recipe snapshot containing **frozen raw material data**
- Material specifications locked in (won't change even if master data updated)
- Quantity tracking: 50 units \* 2 sheets = 100 sheets needed

### **Step 4: Execute Tasks**

Tasks reference the project's recipe snapshot, which includes immutable raw material data.

---

## 🎨 Database Schema Relationships

```
┌─────────────────┐
│  RawMaterial    │
│  - materialCode │
│  - name         │
│  - type         │
│  - specs        │
└────────┬────────┘
         │
         │ Reference (materialId)
         ▼
┌─────────────────┐
│     Recipe      │
│  - name         │
│  - rawMaterials:│
│    - materialId │◄──── Validation (must exist)
│    - quantity   │
│  - steps        │
└────────┬────────┘
         │
         │ Reference (recipeId)
         ▼
┌─────────────────┐
│    Project      │
│  - name         │
│  - recipes:     │
│    - recipeId   │
│    - snapshot:  │◄──── Includes raw material snapshots
│      - rawMats[]│      (frozen, immutable)
└─────────────────┘
         │
         │ Reference (projectId)
         ▼
┌─────────────────┐
│      Task       │
│  - projectId    │
│  - recipeId     │
│  - stepId       │◄──── Uses snapshot data from project
└─────────────────┘
```

---

## ✅ Testing Checklist

### **Raw Material CRUD:**

- [ ] Create raw material with all fields
- [ ] Create raw material with only required fields
- [ ] Get all raw materials
- [ ] Get raw material by ID
- [ ] Update raw material
- [ ] Delete unused raw material
- [ ] Try deleting raw material used in recipe (should fail)

### **Recipe Integration:**

- [ ] Create recipe with raw materials
- [ ] Create recipe without raw materials
- [ ] Update recipe to add raw materials
- [ ] Update recipe to remove raw materials
- [ ] Try creating recipe with invalid materialId (should fail)

### **Project Snapshots:**

- [ ] Create project with recipe containing raw materials
- [ ] Verify raw material snapshots in project data
- [ ] Update master raw material data
- [ ] Verify project snapshot remains unchanged

### **Cascade Prevention:**

- [ ] Try deleting raw material used in recipe
- [ ] Delete recipe, then delete raw material
- [ ] Verify proper error messages

---

## 🚀 Next Steps

1. **Testing:** Test all endpoints with Postman/API client
2. **UI Integration:** Update frontend to:
   - Display raw materials in recipe editor
   - Show material specifications in project view
   - Track material consumption vs. available stock
3. **Stock Management:** Consider adding:
   - Stock consumption tracking when tasks complete
   - Low stock alerts
   - Automatic reorder points
4. **Reporting:** Add analytics for:
   - Material usage by recipe
   - Cost tracking per material
   - Waste percentage calculations

---

## 📝 Breaking Changes

### **Recipe Model:**

- Added `rawMaterials` array field (empty array if not provided)
- Recipes created before this update will have `rawMaterials: []`

### **Project Model:**

- Recipe snapshots now include `rawMaterials` array
- Projects created before this update will have empty raw materials in snapshots

### **API Changes:**

- **No breaking changes** to existing endpoints
- New optional `rawMaterials` field in recipe creation/update

---

## 📚 File Changes Summary

### **Created:**

- `src/models/RawMaterial.ts` - New model
- `src/controllers/rawMaterialController.ts` - CRUD controller
- `src/routes/rawMaterials.ts` - API routes

### **Modified:**

- `src/models/Recipe.ts` - Added `rawMaterials` array
- `src/models/Project.ts` - Added raw material snapshot structures
- `src/models/index.ts` - Exported RawMaterial model
- `src/controllers/recipeController.ts` - Raw material validation
- `src/controllers/projectController.ts` - Snapshot creation with materials
- `src/index.ts` - Registered raw materials routes

---

**Status:** ✅ **All Implementation Complete**  
**Ready for:** Testing and Frontend Integration
