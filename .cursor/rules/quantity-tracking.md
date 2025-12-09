# Quantity Tracking & Execution System

## Calculation Formulas

### For Products (with recipe quantities)

```typescript
totalExecutions = product.targetQuantity × productRecipe.quantity
// Example: Need 10 units, recipe makes 2 per execution → 20 total executions
```

### For Standalone Recipes

```typescript
totalExecutions = recipe.targetQuantity;
// Example: Need 5 executions → 5 total executions
```

## ProducedQuantity Increment Logic

**Only increments when `task.isLastStepInRecipe === true`**

### For Products

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

### For Standalone Recipes

```typescript
projectRecipe.producedQuantity += 1; // Direct increment
```

## Progress Calculation

- Project progress is calculated by pre-save hook based on `producedQuantity / targetQuantity`
- **Don't manually set `progress` field** - it's auto-calculated

## Rules

1. **ProducedQuantity increment logic**
   - Only increment when `task.isLastStepInRecipe === true`
   - For products: `floor(completedExecutions / recipe.quantity)`
   - For standalone recipes: Direct increment

2. **Progress auto-calculation**
   - Project progress is calculated by pre-save hook
   - Never manually set `progress` field

3. **Execution tracking**
   - Maintain same `recipeExecutionNumber` through task chains
   - Copy all execution tracking fields when creating next step

