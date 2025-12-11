# Deferred Snapshot Pattern (CRITICAL!)

## Most Important Rule
Snapshots are created **at task generation time**, not at project creation. Projects store only **live references** to products and recipes.

## Correct Usage

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
```

## Wrong Usage

```typescript
// ❌ WRONG: Don't look for embedded snapshots in projects
const firstStep = project.products[0].snapshot.recipes[0].steps[0]; // No longer exists!
```

## Key Locations

- `src/models/RecipeSnapshot.ts`: Separate collection with versioning and smart caching
- `src/models/ProductSnapshot.ts`: Separate collection with recipe snapshot references
- `src/services/snapshotService.ts`: Smart caching with `getOrCreateRecipeSnapshot()`
- `src/models/Project.ts`: Only stores live references (`productId`, `recipeId`) with quantities
- `src/controllers/projectController.ts`: `updateProject()` creates snapshots during task generation
- `src/controllers/taskController.ts`: `completeTask()` uses `RecipeSnapshot` model

## SnapshotService Usage

**Always use SnapshotService for snapshot creation:**
- Smart caching prevents duplicate snapshots
- Compares snapshot `createdAt` vs live document `updatedAt`
- Use `getOrCreateRecipeSnapshot(recipeId)` and `getOrCreateProductSnapshot(productId)`

## Rules

1. **Never create snapshots at project creation** - only at task generation time
2. **Always use SnapshotService** - don't create snapshots directly
3. **Projects store live references only** - no embedded snapshot data
4. **Tasks reference snapshots** - use `task.recipeSnapshotId` to fetch snapshot data

