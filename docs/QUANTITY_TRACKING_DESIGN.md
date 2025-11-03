# Quantity Tracking & Task Generation Design

## 🎯 Overview

This document explains how the smart factory system tracks quantities and generates tasks to ensure the correct number of recipe executions are created based on project requirements.

## 📊 Data Model

### Project Structure

```typescript
Project {
  products: [
    {
      productId: ObjectId,          // Reference to Product
      targetQuantity: 10,            // Want to produce 10 units
      producedQuantity: 0            // How many completed so far
    }
  ],
  recipes: [
    {
      recipeId: ObjectId,            // Reference to Recipe (standalone)
      targetQuantity: 5,             // Want to execute 5 times
      producedQuantity: 0            // How many completed so far
    }
  ]
}
```

### Product Structure

```typescript
Product {
  recipes: [
    {
      recipeId: ObjectId,            // Reference to Recipe
      quantity: 2                    // This recipe runs 2 times per product unit
    }
  ]
}
```

### Task Structure (NEW)

```typescript
Task {
  recipeSnapshotId: ObjectId,        // Immutable recipe snapshot
  recipeId: ObjectId,                // Original recipe reference
  productId?: ObjectId,              // If part of product
  recipeStepId: ObjectId,            // Step within snapshot
  recipeExecutionNumber: 3,          // This is execution #3
  totalRecipeExecutions: 20,         // Out of 20 total
  stepOrder: 1,                      // Step order in recipe
  isLastStepInRecipe: false,         // Is this the final step?
  status: "PENDING"
}
```

## 🔢 Calculation Logic

### Example Scenario

**Project Setup:**

- Product A: targetQuantity = 10
  - Recipe X: quantity = 2 (runs twice per product)
  - Recipe Y: quantity = 1 (runs once per product)
- Recipe Z: targetQuantity = 5 (standalone recipe)

**Calculated Total Executions:**

- Recipe X: 10 × 2 = **20 executions**
- Recipe Y: 10 × 1 = **10 executions**
- Recipe Z: **5 executions**

### Task Generation on Project Activation

When project status changes to `ACTIVE`:

1. **For each Product:**

   ```typescript
   for (product in project.products) {
     for (productRecipe in product.recipes) {
       totalExecutions = product.targetQuantity × productRecipe.quantity;

       // Create snapshot once (smart caching)
       recipeSnapshot = SnapshotService.getOrCreateRecipeSnapshot(recipeId);

       // Get first step
       firstStep = recipeSnapshot.steps.find(step => step.order === 1);
       maxStepOrder = max(recipeSnapshot.steps.map(s => s.order));

       // Create ALL first-step tasks upfront
       for (execution = 1; execution <= totalExecutions; execution++) {
         Task.create({
           title: `${firstStep.name} - Execution ${execution}/${totalExecutions}`,
           projectId,
           productId: product.productId,
           recipeId: productRecipe.recipeId,
           recipeSnapshotId: recipeSnapshot._id,
           recipeStepId: firstStep._id,
           recipeExecutionNumber: execution,
           totalRecipeExecutions: totalExecutions,
           stepOrder: firstStep.order,
           isLastStepInRecipe: (firstStep.order === maxStepOrder),
           deviceTypeId: firstStep.deviceTypeId,
           status: "PENDING",
           priority: project.priority
         });
       }
     }
   }
   ```

2. **For each Standalone Recipe:**
   ```typescript
   for (recipe in project.recipes) {
     totalExecutions = recipe.targetQuantity;

     recipeSnapshot = SnapshotService.getOrCreateRecipeSnapshot(
       recipe.recipeId
     );
     firstStep = recipeSnapshot.steps.find((step) => step.order === 1);
     maxStepOrder = max(recipeSnapshot.steps.map((s) => s.order));

     // Create ALL first-step tasks upfront
     for (execution = 1; execution <= totalExecutions; execution++) {
       Task.create({
         title: `${firstStep.name} - Execution ${execution}/${totalExecutions}`,
         projectId,
         recipeId: recipe.recipeId,
         recipeSnapshotId: recipeSnapshot._id,
         recipeStepId: firstStep._id,
         recipeExecutionNumber: execution,
         totalRecipeExecutions: totalExecutions,
         stepOrder: firstStep.order,
         isLastStepInRecipe: firstStep.order === maxStepOrder,
         deviceTypeId: firstStep.deviceTypeId,
         status: "PENDING",
         priority: project.priority
       });
     }
   }
   ```

## ⚙️ Task Completion & Progression

### When a Task is Completed

```typescript
async function completeTask(taskId) {
  const task = await Task.findById(taskId).populate("recipeSnapshotId");

  // Mark task as completed
  task.status = "COMPLETED";
  task.completedAt = new Date();
  await task.save();

  // If this is NOT the last step, create next step task
  if (!task.isLastStepInRecipe) {
    const recipeSnapshot = task.recipeSnapshotId;
    const nextStep = recipeSnapshot.steps.find(
      (step) => step.order === task.stepOrder + 1
    );

    const maxStepOrder = Math.max(...recipeSnapshot.steps.map((s) => s.order));

    // Create next step task for SAME execution
    await Task.create({
      title: `${nextStep.name} - Execution ${task.recipeExecutionNumber}/${task.totalRecipeExecutions}`,
      projectId: task.projectId,
      productId: task.productId,
      recipeId: task.recipeId,
      recipeSnapshotId: task.recipeSnapshotId,
      recipeStepId: nextStep._id,
      recipeExecutionNumber: task.recipeExecutionNumber, // SAME execution
      totalRecipeExecutions: task.totalRecipeExecutions,
      stepOrder: nextStep.order,
      isLastStepInRecipe: nextStep.order === maxStepOrder,
      deviceTypeId: nextStep.deviceTypeId,
      status: "PENDING",
      priority: task.priority
    });
  }

  // If this IS the last step, increment producedQuantity
  if (task.isLastStepInRecipe) {
    await incrementProducedQuantity(task);
  }
}
```

### Incrementing Produced Quantity

```typescript
async function incrementProducedQuantity(completedTask) {
  const project = await Project.findById(completedTask.projectId);

  if (completedTask.productId) {
    // Task is part of a product
    const product = project.products.find((p) =>
      p.productId.equals(completedTask.productId)
    );

    // Get the product details to find recipe quantity
    const productDoc = await Product.findById(completedTask.productId);
    const productRecipe = productDoc.recipes.find((r) =>
      r.recipeId.equals(completedTask.recipeId)
    );

    // Increment based on how many recipe executions complete one product unit
    // If recipe runs 2 times per product, every 2 completions = 1 product
    const executionsPerUnit = productRecipe.quantity;

    // Count completed executions for this recipe
    const completedExecutions = await Task.countDocuments({
      projectId: project._id,
      productId: completedTask.productId,
      recipeId: completedTask.recipeId,
      isLastStepInRecipe: true,
      status: "COMPLETED"
    });

    // Calculate how many product units completed
    const completedUnits = Math.floor(completedExecutions / executionsPerUnit);
    product.producedQuantity = completedUnits;
  } else {
    // Standalone recipe - direct increment
    const recipe = project.recipes.find((r) =>
      r.recipeId.equals(completedTask.recipeId)
    );
    recipe.producedQuantity += 1;
  }

  await project.save(); // Progress auto-calculated by pre-save hook
}
```

## 🔍 Query Patterns

### Find all pending tasks for a specific execution

```typescript
Task.find({
  projectId,
  recipeId,
  recipeExecutionNumber: 3,
  status: "PENDING"
});
```

### Find next step in current execution

```typescript
Task.findOne({
  projectId,
  recipeSnapshotId,
  recipeExecutionNumber: currentTask.recipeExecutionNumber,
  stepOrder: currentTask.stepOrder + 1
});
```

### Check if recipe execution is complete

```typescript
Task.findOne({
  projectId,
  recipeId,
  recipeExecutionNumber,
  isLastStepInRecipe: true,
  status: "COMPLETED"
});
```

### Count completed recipe executions

```typescript
Task.countDocuments({
  projectId,
  recipeId,
  isLastStepInRecipe: true,
  status: "COMPLETED"
});
```

## 📈 Progress Tracking

Project progress is automatically calculated:

```typescript
// Project.pre("save") hook
totalProduced = sum(products[].producedQuantity) + sum(recipes[].producedQuantity);
totalTarget = sum(products[].targetQuantity) + sum(recipes[].targetQuantity);
progress = (totalProduced / totalTarget) * 100;
```

## 🔄 Parallel Execution Support

Multiple workers can work on different executions of the same recipe simultaneously:

- Execution 1, Step 1 → Worker A on Device X
- Execution 2, Step 1 → Worker B on Device Y
- Execution 3, Step 1 → Worker C on Device Z

All pending first-step tasks are visible and can be picked up independently.

## ✅ Validation Checks

### On Task Creation

- `recipeExecutionNumber` must be between 1 and `totalRecipeExecutions`
- `stepOrder` must match step's order in `recipeSnapshotId`
- `isLastStepInRecipe` must be true if step is final step in recipe

### On Task Completion

- All previous steps in the same execution should be completed
- Next step must exist if `isLastStepInRecipe` is false

## 🎯 Benefits of This Design

1. **Transparency**: Workers see all pending tasks from all executions
2. **Parallel Execution**: Multiple executions can run simultaneously
3. **Accurate Tracking**: Each execution is tracked individually
4. **Flexible Progress**: Easy to calculate completion percentage
5. **Immutability**: Recipe snapshots ensure consistency across all executions
6. **Query Efficiency**: Compound indexes support fast queries by execution number

---

**Last Updated:** November 3, 2025
