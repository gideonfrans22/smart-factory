# Common Pitfalls and Best Practices

## Critical Pitfalls to Avoid

### 1. Don't use embedded snapshots - they no longer exist in projects

❌ **WRONG:**
```typescript
const firstStep = project.products[0].snapshot.recipes[0].steps[0];
```

✅ **CORRECT:**
```typescript
const recipeSnapshot = await RecipeSnapshot.findById(task.recipeSnapshotId);
const firstStep = recipeSnapshot.steps.find((s) => s.order === 1);
```

### 2. Always use SnapshotService for snapshot creation

- Smart caching prevents duplicate snapshots
- Compares snapshot `createdAt` vs live document `updatedAt`
- Use `getOrCreateRecipeSnapshot()` and `getOrCreateProductSnapshot()`

### 3. Maintain execution number through task chains

- Next step task must have SAME `recipeExecutionNumber`
- Copy all execution tracking fields: `recipeExecutionNumber`, `totalRecipeExecutions`, `stepOrder`, `isLastStepInRecipe`

### 4. ProducedQuantity increment logic

- Only increment when `task.isLastStepInRecipe === true`
- For products: `floor(completedExecutions / recipe.quantity)`
- For standalone recipes: Direct increment

### 5. Update `api_spec/types/` when changing API contracts

- Changes must be committed to the submodule separately
- Always keep frontend and backend in sync

### 6. DeviceTypeId vs DeviceId

- Tasks require `deviceTypeId` (from recipe step) at creation
- `deviceId` (specific device) is assigned when task becomes `ONGOING`

### 7. Progress auto-calculation

- Project progress is calculated by pre-save hook based on `producedQuantity / targetQuantity`
- **Don't manually set `progress` field**

### 8. Task creation workflow

- Project tasks are auto-generated on activation (ALL first-step tasks upfront)
- Manual creation via API is for standalone tasks only
- Snapshots are created during task generation, not project creation

### 9. File naming convention

- Don't manually construct file paths; use the naming pattern from `upload.ts`
- Always sanitize original filenames (replace special chars with underscores)

## Development Workflow

### Essential Commands

```bash
npm run dev          # Start with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to dist/
npm run seed         # Populate database with test data
```

### Database Seeding

Run `npm run seed` to populate the database with test users, devices, recipes, etc.

**Location:** `src/utils/seed.ts`

### Environment Variables

Copy `.env.example` to `.env`. Key variables:

- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: Authentication token secret
- `PORT`: Server port (default: 3000)
- `CORS_ORIGIN`: Comma-separated allowed origins
- `MQTT_BROKER_URL`: MQTT broker URL
- `MQTT_USERNAME`: MQTT username
- `MQTT_PASSWORD`: MQTT password

## Testing Guidelines

Currently no automated tests configured. When adding tests:

- Use snapshot data to test task workflows
- Mock database connections
- Test task auto-generation on project activation

