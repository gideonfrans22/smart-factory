# Recipe Enhancements Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
│                    (Web/Mobile/Tablet UI)                       │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ HTTP/REST                          │ HTTP/REST
             │                                    │
┌────────────▼────────────────┐     ┌────────────▼───────────────┐
│   Recipe API Endpoints      │     │  Recipe Media Endpoints    │
│  /api/recipes/*             │     │  /api/recipes/*/media/*    │
└────────────┬────────────────┘     └────────────┬───────────────┘
             │                                    │
             │                                    │
┌────────────▼────────────────┐     ┌────────────▼───────────────┐
│  recipeController.ts        │     │  recipeMediaController.ts  │
│  - getRecipes()             │     │  - getStepMedia()          │
│  - createRecipe()           │     │  - uploadStepMedia()       │
│  - updateRecipe()           │     │  - uploadMultipleMedia()   │
│  - getDependencyGraph() ✨  │     │  - downloadStepMedia()     │
│  - ...                      │     │  - updateStepMedia()       │
└────────────┬────────────────┘     │  - deleteStepMedia()       │
             │                      └────────────┬───────────────┘
             │                                   │
             │                      ┌────────────▼───────────────┐
             │                      │   Upload Middleware        │
             │                      │   (multer)                 │
             │                      │  - Single file             │
             │                      │  - Multiple files (10 max) │
             │                      │  - 50MB limit              │
             │                      └────────────┬───────────────┘
             │                                   │
┌────────────▼───────────────────────────────────▼───────────────┐
│                        Recipe Model                             │
│                      (Recipe.ts)                                │
│                                                                 │
│  IRecipe {                                                      │
│    productCode: string                                          │
│    version: number                                              │
│    name: string                                                 │
│    steps: IRecipeStep[] ──────┐                                │
│    estimatedDuration: number   │                                │
│  }                             │                                │
│                                │                                │
│  IRecipeStep {                 │                                │
│    stepId: string              │                                │
│    order: number               │                                │
│    name: string                │                                │
│    estimatedDuration: number   │                                │
│    dependsOn: string[] ✨ ─────┼──> Dependency Validation       │
│    media: IRecipeStepMedia[] ✨┼──> Media Storage               │
│  }                             │                                │
│                                │                                │
│  IRecipeStepMedia {            │                                │
│    mediaId: string             │                                │
│    filename: string            │                                │
│    mimeType: string            │                                │
│    mediaType: enum             │                                │
│    filePath: string ───────────┼──> File System                │
│  }                             │                                │
└────────────┬───────────────────┴────────────────────────────────┘
             │
             │ Pre-Save Hook
             │
┌────────────▼───────────────────────────────────────────────────┐
│               Dependency Validation Logic                       │
│                                                                 │
│  1. Check all dependencies exist                                │
│  2. Build dependency graph                                      │
│  3. Detect circular dependencies (topological sort)             │
│  4. Throw error if invalid                                      │
└────────────┬───────────────────────────────────────────────────┘
             │
             │ Save to DB
             │
┌────────────▼───────────────────────────────────────────────────┐
│                      MongoDB Database                           │
│                                                                 │
│  Collection: recipes                                            │
│  - Documents with steps array                                   │
│  - Embedded media metadata                                      │
│  - Indexes: productCode+version (unique)                        │
└─────────────────────────────────────────────────────────────────┘

             ┌────────────────────────────────────┐
             │         File System                │
             │  /uploads/task-media/              │
             │  - Actual media files              │
             │  - Unique filenames                │
             │  - Organized by timestamp          │
             └────────────────────────────────────┘
```

---

## Dependency Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Create/Update Recipe                         │
│                  { steps: [...] }                               │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Extract Step IDs & Dependencies                    │
│                                                                 │
│  Step IDs: [STEP_1, STEP_2, STEP_3]                            │
│  Dependencies:                                                  │
│    STEP_1 → []                                                  │
│    STEP_2 → [STEP_1]                                            │
│    STEP_3 → [STEP_2]                                            │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│          Validate Dependencies Exist                            │
│                                                                 │
│  For each step:                                                 │
│    For each dependency:                                         │
│      ✓ Check if dependency exists in step IDs                  │
│      ✗ If not found → Error: "Step X depends on non-existent   │
│        step Y"                                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│        Check for Circular Dependencies                          │
│               (Kahn's Algorithm)                                │
│                                                                 │
│  1. Build dependency graph                                      │
│  2. Calculate in-degrees (# of dependencies)                    │
│  3. Topological sort:                                           │
│     - Start with nodes with in-degree = 0                       │
│     - Remove edges, update in-degrees                           │
│     - Continue until all processed                              │
│  4. If not all nodes processed → Circular dependency           │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Validation Result                            │
│                                                                 │
│  ✓ Valid → Save to database                                     │
│  ✗ Invalid → Return error                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Media Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               Client Uploads Media File(s)                      │
│                                                                 │
│  POST /api/recipes/:id/steps/:stepId/media                      │
│  Form Data:                                                     │
│    - file: [binary data]                                        │
│    - mediaType: "INSTRUCTION"                                   │
│    - description: "..."                                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Multer Middleware                             │
│                                                                 │
│  1. Parse multipart/form-data                                   │
│  2. Validate file type (50MB max)                               │
│  3. Generate unique filename                                    │
│  4. Save to /uploads/task-media/                                │
│  5. Attach file info to req.file                                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│            recipeMediaController.uploadStepMedia()              │
│                                                                 │
│  1. Validate mediaType                                          │
│  2. Find recipe by ID                                           │
│  3. Find step by stepId                                         │
│  4. Generate mediaId (UUID)                                     │
│  5. Create media object                                         │
│  6. Push to step.media array                                    │
│  7. Save recipe                                                 │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MongoDB Update                                │
│                                                                 │
│  Recipe.steps[i].media[] = [                                    │
│    {                                                            │
│      mediaId: "uuid",                                           │
│      filename: "1730451234-abc123-manual.pdf",                  │
│      originalName: "manual.pdf",                                │
│      mimeType: "application/pdf",                               │
│      fileSize: 2048576,                                         │
│      filePath: "/uploads/task-media/...",                       │
│      mediaType: "INSTRUCTION",                                  │
│      description: "...",                                        │
│      uploadedAt: Date                                           │
│    }                                                            │
│  ]                                                              │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Return Success                                │
│                                                                 │
│  {                                                              │
│    "success": true,                                             │
│    "message": "Media uploaded successfully",                    │
│    "data": { media object }                                     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependency Graph Calculation

```
Recipe with steps:
  STEP_1 (dependsOn: [])
  STEP_2 (dependsOn: [STEP_1])
  STEP_3 (dependsOn: [STEP_2])
  STEP_4 (dependsOn: [STEP_2])
  STEP_5 (dependsOn: [STEP_3, STEP_4])

┌─────────────────────────────────────────────────────────────────┐
│              Build Dependency Graph                             │
│                                                                 │
│  Graph:                                                         │
│    STEP_1 → []                                                  │
│    STEP_2 → [STEP_1]                                            │
│    STEP_3 → [STEP_2]                                            │
│    STEP_4 → [STEP_2]                                            │
│    STEP_5 → [STEP_3, STEP_4]                                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│           Calculate In-Degrees                                  │
│                                                                 │
│  STEP_1: 0 (no dependencies)                                    │
│  STEP_2: 1 (depends on STEP_1)                                  │
│  STEP_3: 1 (depends on STEP_2)                                  │
│  STEP_4: 1 (depends on STEP_2)                                  │
│  STEP_5: 2 (depends on STEP_3 and STEP_4)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│          Topological Sort (Kahn's Algorithm)                    │
│                                                                 │
│  Queue: [STEP_1] (in-degree = 0)                                │
│                                                                 │
│  Level 0:                                                       │
│    Process STEP_1                                               │
│    → Reduce in-degree of STEP_2 to 0                            │
│    → Add STEP_2 to queue                                        │
│                                                                 │
│  Level 1:                                                       │
│    Process STEP_2                                               │
│    → Reduce in-degree of STEP_3 to 0                            │
│    → Reduce in-degree of STEP_4 to 0                            │
│    → Add STEP_3, STEP_4 to queue                                │
│                                                                 │
│  Level 2:                                                       │
│    Process STEP_3, STEP_4 (can run in parallel)                │
│    → Reduce in-degree of STEP_5 to 0                            │
│    → Add STEP_5 to queue                                        │
│                                                                 │
│  Level 3:                                                       │
│    Process STEP_5                                               │
│    → All steps processed                                        │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Return Topological Order                        │
│                                                                 │
│  [                                                              │
│    { stepId: "STEP_1", level: 0, dependsOn: [] },              │
│    { stepId: "STEP_2", level: 1, dependsOn: ["STEP_1"] },      │
│    { stepId: "STEP_3", level: 2, dependsOn: ["STEP_2"] },      │
│    { stepId: "STEP_4", level: 2, dependsOn: ["STEP_2"] },      │
│    { stepId: "STEP_5", level: 3, dependsOn: ["STEP_3","STEP_4"]}│
│  ]                                                              │
│                                                                 │
│  Visualization:                                                 │
│                                                                 │
│           STEP_1 (Level 0)                                      │
│              │                                                  │
│              ▼                                                  │
│           STEP_2 (Level 1)                                      │
│              │                                                  │
│         ┌────┴────┐                                             │
│         ▼         ▼                                             │
│      STEP_3    STEP_4 (Level 2, parallel)                       │
│         └────┬────┘                                             │
│              ▼                                                  │
│           STEP_5 (Level 3)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                        Recipe                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ _id: ObjectId                                              │ │
│  │ productCode: "PROD-001"                                    │ │
│  │ version: 1                                                 │ │
│  │ name: "Assembly Recipe"                                    │ │
│  │ estimatedDuration: 90 (auto-calculated)                    │ │
│  │                                                            │ │
│  │ steps: [                                                   │ │
│  │   ┌──────────────────────────────────────────────────┐    │ │
│  │   │ Step 1                                           │    │ │
│  │   │ ────────────────────────────────────────────────│    │ │
│  │   │ stepId: "STEP_1"                                 │    │ │
│  │   │ order: 1                                         │    │ │
│  │   │ name: "Preparation"                              │    │ │
│  │   │ estimatedDuration: 30                            │    │ │
│  │   │ dependsOn: [] ✨                                 │    │ │
│  │   │                                                  │    │ │
│  │   │ media: [ ✨                                      │    │ │
│  │   │   {                                              │    │ │
│  │   │     mediaId: "uuid-1"                            │    │ │
│  │   │     filename: "1730-abc-manual.pdf"              │    │ │
│  │   │     mediaType: "INSTRUCTION"                     │    │ │
│  │   │     filePath: "/uploads/..."                     │    │ │
│  │   │   },                                             │    │ │
│  │   │   {                                              │    │ │
│  │   │     mediaId: "uuid-2"                            │    │ │
│  │   │     filename: "1730-def-diagram.png"             │    │ │
│  │   │     mediaType: "DIAGRAM"                         │    │ │
│  │   │     filePath: "/uploads/..."                     │    │ │
│  │   │   }                                              │    │ │
│  │   │ ]                                                │    │ │
│  │   └──────────────────────────────────────────────────┘    │ │
│  │                                                            │ │
│  │   ┌──────────────────────────────────────────────────┐    │ │
│  │   │ Step 2                                           │    │ │
│  │   │ ────────────────────────────────────────────────│    │ │
│  │   │ stepId: "STEP_2"                                 │    │ │
│  │   │ order: 2                                         │    │ │
│  │   │ name: "Assembly"                                 │    │ │
│  │   │ estimatedDuration: 60                            │    │ │
│  │   │ dependsOn: ["STEP_1"] ✨                         │    │ │
│  │   │ media: [...]  ✨                                 │    │ │
│  │   └──────────────────────────────────────────────────┘    │ │
│  │ ]                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────────────────────────┘
             │
             │ Referenced by
             │
┌────────────▼─────────────────────────────────────────────────────┐
│                        Project                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ _id: ObjectId                                              │ │
│  │ name: "Production Batch #001"                              │ │
│  │ recipeId: ObjectId ────────────┐ (references Recipe)       │ │
│  │ status: "ACTIVE"               │                           │ │
│  │ ...                            │                           │ │
│  └────────────────────────────────┼────────────────────────────┘ │
└─────────────────────────────────────┼────────────────────────────┘
                                      │
                                      │ Referenced by
                                      │
┌─────────────────────────────────────▼────────────────────────────┐
│                         Task                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ _id: ObjectId                                              │ │
│  │ title: "Preparation Task"                                  │ │
│  │ projectId: ObjectId (references Project)                   │ │
│  │ recipeStepId: "STEP_1" ──────┐ (references step in recipe)│ │
│  │ status: "ONGOING"            │                            │ │
│  │ ...                          │                            │ │
│  └──────────────────────────────┼─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                  Uses media from recipe step
                                   │
                                   ▼
                    /uploads/task-media/1730-abc-manual.pdf
                    /uploads/task-media/1730-def-diagram.png
```

---

## Request/Response Flow Examples

### Example 1: Create Recipe with Dependencies

```
Client                  Server                   Database
  │                       │                         │
  │  POST /api/recipes    │                         │
  │  { steps with        │                         │
  │    dependencies }    │                         │
  ├─────────────────────>│                         │
  │                       │                         │
  │                       │ Validate dependencies   │
  │                       │ (pre-save hook)         │
  │                       │                         │
  │                       │ Save recipe             │
  │                       ├────────────────────────>│
  │                       │                         │
  │                       │ Recipe saved            │
  │                       │<────────────────────────┤
  │                       │                         │
  │  201 Created          │                         │
  │  { recipe data }     │                         │
  │<─────────────────────┤                         │
  │                       │                         │
```

### Example 2: Upload Media to Step

```
Client                  Server                   File System
  │                       │                         │
  │  POST /media          │                         │
  │  multipart/form-data │                         │
  │  (file + metadata)   │                         │
  ├─────────────────────>│                         │
  │                       │                         │
  │                       │ Multer middleware       │
  │                       │ processes upload        │
  │                       │                         │
  │                       │ Save file               │
  │                       ├────────────────────────>│
  │                       │                         │
  │                       │ File saved              │
  │                       │<────────────────────────┤
  │                       │                         │
  │                       │ Update recipe.steps[].media
  │                       │ in MongoDB              │
  │                       │                         │
  │  201 Created          │                         │
  │  { media object }    │                         │
  │<─────────────────────┤                         │
  │                       │                         │
```

### Example 3: Get Dependency Graph

```
Client                  Server
  │                       │
  │  GET /dependency-graph│
  ├─────────────────────>│
  │                       │
  │                       │ Fetch recipe
  │                       │ Build dependency map
  │                       │ Run Kahn's algorithm
  │                       │ Calculate levels
  │                       │
  │  200 OK               │
  │  { topologicalOrder,  │
  │    dependencyGraph }  │
  │<─────────────────────┤
  │                       │
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Request Received                             │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Validation   │
      │ Layer        │
      └──┬────────┬──┘
         │        │
    ✓ Valid   ✗ Invalid
         │        │
         │        └──────> Return 400 Bad Request
         │                { error: "VALIDATION_ERROR" }
         │
         ▼
      ┌──────────────┐
      │ Authorization│
      │ Check        │
      └──┬────────┬──┘
         │        │
    ✓ Auth    ✗ Unauth
         │        │
         │        └──────> Return 401 Unauthorized
         │                { error: "UNAUTHORIZED" }
         │
         ▼
      ┌──────────────┐
      │ Business     │
      │ Logic        │
      └──┬────────┬──┘
         │        │
    ✓ Success ✗ Error
         │        │
         │        ├──────> Return 404 Not Found
         │        │        { error: "NOT_FOUND" }
         │        │
         │        ├──────> Return 409 Conflict
         │        │        { error: "CONFLICT" }
         │        │
         │        └──────> Return 500 Server Error
         │                 { error: "SERVER_ERROR" }
         │
         ▼
    Return 200/201 Success
    { success: true, data: {...} }
```

---

This architecture provides:

✅ **Scalability** - Modular design, easy to extend
✅ **Maintainability** - Clear separation of concerns
✅ **Reliability** - Comprehensive validation and error handling
✅ **Performance** - Efficient algorithms (topological sort O(V+E))
✅ **Security** - Authentication required, file validation
✅ **Flexibility** - Supports complex dependency graphs
