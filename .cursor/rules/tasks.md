# Task Generation and Execution Tracking

## Task Auto-Generation

When a project status changes to `ACTIVE`, the system creates **ALL first-step tasks for ALL executions** upfront.

### Pattern

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

## Task Completion Logic

**Task completion triggers next step creation** in `completeTask()`:

1. Fetch recipe snapshot: `await RecipeSnapshot.findById(task.recipeSnapshotId)`
2. If NOT last step: Create next step with **SAME execution number**
3. Copy execution tracking fields: `recipeExecutionNumber`, `totalRecipeExecutions`, `stepOrder`, `isLastStepInRecipe`
4. If IS last step: Increment `producedQuantity` with proper calculation

## Execution Number Propagation

Tasks in the same execution chain must maintain the same `recipeExecutionNumber`:

- Exec 1: Step 1 → Step 2 → Step 3 (all have executionNumber = 1)
- Exec 2: Step 1 → Step 2 → Step 3 (all have executionNumber = 2)

## Task Assignment Workflow

Tasks are assigned to **device types**, not specific devices or workers:

1. **Task Creation**: Task gets `deviceTypeId` from recipe step
2. **Worker Picks Task**: Workers at devices of matching type can claim any PENDING task
3. **Task Execution**: Worker assigns `deviceId` and `workerId` when status changes to `ONGOING`
4. **Quality Control**: Tasks have `qualityData` field (no specific workflow currently defined)

**Key insight**: Multiple workers at different devices of the same type can pick from the same task pool.

## Task Creation Rules

- Project tasks are auto-generated on activation (ALL first-step tasks upfront)
- Manual creation via API is for standalone tasks only
- Snapshots are created during task generation, not project creation
- Tasks require `deviceTypeId` (from recipe step) at creation
- `deviceId` (specific device) is assigned when task becomes `ONGOING`

## Task Fields

- `recipeExecutionNumber`: Which execution (1 to N)
- `totalRecipeExecutions`: Total number of executions needed
- `stepOrder`: Order of step within recipe
- `isLastStepInRecipe`: Boolean indicating if this is the final step
- `recipeSnapshotId`: Reference to immutable recipe snapshot
- `deviceTypeId`: Required at creation (from recipe step)
- `deviceId`: Assigned when task becomes ONGOING
- `workerId`: Assigned when task becomes ONGOING

