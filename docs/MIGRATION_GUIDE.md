# Quick Reference - Field Name Changes

> **⚡ Quick lookup for developers migrating from old documentation**

## Recipe Model

| ❌ OLD (Deprecated) | ✅ NEW (Current) | Notes                                       |
| ------------------- | ---------------- | ------------------------------------------- |
| `productCode`       | _removed_        | Use optional `recipeNumber` if needed       |
| `stepId: "STEP_1"`  | `step._id`       | Auto-generated ObjectId by MongoDB          |
| `mediaId: "uuid"`   | `media._id`      | Auto-generated ObjectId by MongoDB          |
| _not present_       | `rawMaterials[]` | Array of `{ materialId, quantityRequired }` |

**Example - OLD vs NEW:**

```javascript
// ❌ OLD (Don't use)
{
  "productCode": "PROD-001",
  "steps": [
    {
      "stepId": "STEP_1",  // Manual ID
      "title": "Cut steel"
    }
  ]
}

// ✅ NEW (Use this)
{
  "recipeNumber": "PROD-001",  // Optional
  "rawMaterials": [
    { "materialId": "6789...", "quantityRequired": 5 }
  ],
  "steps": [
    {
      // No stepId - MongoDB generates _id automatically
      "title": "Cut steel"
    }
  ]
}
```

## Task Model

| ❌ OLD (Deprecated) | ✅ NEW (Current) | Notes                                   |
| ------------------- | ---------------- | --------------------------------------- |
| `assignedTo`        | `workerId`       | Reference to User who performs the task |
| _not present_       | `recipeId`       | Reference to Recipe                     |
| _not present_       | `productId`      | Reference to Product                    |
| _not present_       | `recipeStepId`   | Reference to specific step `_id`        |

**Example - OLD vs NEW:**

```javascript
// ❌ OLD (Don't use)
{
  "taskName": "Assembly",
  "assignedTo": "user123"
}

// ✅ NEW (Use this)
{
  "taskName": "Assembly",
  "workerId": "user123",
  "recipeId": "recipe456",
  "productId": "product789",
  "recipeStepId": "67890abc..."  // ObjectId from recipe.steps[n]._id
}
```

## Project Model

| ❌ OLD (Deprecated) | ✅ NEW (Current)      | Notes                                          |
| ------------------- | --------------------- | ---------------------------------------------- |
| Simple recipe refs  | Snapshot architecture | Projects store immutable snapshots             |
| _not present_       | `products[]`          | Array with productId + snapshot                |
| _not present_       | `recipes[]`           | Array with recipeId + snapshot + raw materials |

**Example - NEW Structure:**

```javascript
// ✅ NEW Project with Snapshots
{
  "projectName": "Order #1234",
  "products": [
    {
      "productId": "prod123",
      "snapshot": {
        "productName": "Steel Frame",
        "specifications": {...}
      }
    }
  ],
  "recipes": [
    {
      "recipeId": "recipe456",
      "snapshot": {
        "name": "Frame Assembly",
        "rawMaterials": [
          {
            "materialId": "mat789",
            "quantityRequired": 5,
            "snapshot": {
              "materialCode": "STEEL-001",
              "name": "Steel Bar",
              "specifications": {...}
            }
          }
        ],
        "steps": [...] // Includes auto-generated _id
      }
    }
  ]
}
```

## Common Migration Issues

### Issue 1: Accessing Recipe Steps

```javascript
// ❌ OLD (Breaks)
recipe.steps.find((s) => s.stepId === "STEP_1");

// ✅ NEW (Works)
recipe.steps.find((s) => s._id.toString() === stepObjectId);
// Or by index:
recipe.steps[0]._id;
```

### Issue 2: Creating Tasks

```javascript
// ❌ OLD (Field not found)
{
  "assignedTo": userId
}

// ✅ NEW (Correct field)
{
  "workerId": userId
}
```

### Issue 3: Recipe Media Upload

```javascript
// ❌ OLD (Manual IDs)
POST /api/recipes/:id/steps/:stepId/media
// stepId was a string like "STEP_1"

// ✅ NEW (ObjectId)
POST /api/recipe-media/:recipeId/steps/:stepId/media
// stepId is now ObjectId: "67890abcdef..."
```

### Issue 4: Querying Tasks

```javascript
// ❌ OLD (Field renamed)
Task.find({ assignedTo: userId });

// ✅ NEW (Use workerId)
Task.find({ workerId: userId });
```

## New Features You Should Use

### 1. Raw Materials

```javascript
// Add materials to recipe
{
  "name": "Product Assembly",
  "rawMaterials": [
    { "materialId": "mat123", "quantityRequired": 5 },
    { "materialId": "mat456", "quantityRequired": 2 }
  ]
}

// Create raw material
POST /api/raw-materials
{
  "materialCode": "STEEL-001",
  "name": "Steel Bar",
  "unit": "pieces",
  "specifications": {
    "length": "2m",
    "weight": "5kg",
    "color": "silver"
  }
}
```

### 2. Cascade Prevention

```javascript
// ❌ Cannot delete material used in recipes
DELETE /api/raw-materials/:id
// Response: 400 "Cannot delete: used in 3 recipes"

// ❌ Cannot delete recipe used in projects
DELETE /api/recipes/:id
// Response: 400 "Cannot delete: used in 2 projects"
```

### 3. Immutable Snapshots

```javascript
// Projects freeze data at creation time
// Changing a recipe doesn't affect existing projects

// 1. Create project (snapshots recipe v1)
POST /api/projects { recipes: ["recipe123"] }

// 2. Update recipe
PUT /api/recipes/recipe123 { name: "New Name" }

// 3. Project still has old name in snapshot
GET /api/projects/:id
// → recipes[0].snapshot.name = "Old Name" (frozen)
```

## Where to Find More Info

- **Full Schema:** `docs/MONGODB_SCHEMA.md`
- **Raw Materials:** `docs/RAW_MATERIAL_IMPLEMENTATION.md`
- **Task Flow:** `docs/TASK_FLOW_ARCHITECTURE.md`
- **All Docs Index:** `docs/README.md`

---

**Last Updated:** October 25, 2025
