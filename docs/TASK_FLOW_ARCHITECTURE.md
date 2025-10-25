# Task Flow Architecture - Visual Guide

## 🔄 Complete Task Completion Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PROJECT                                     │
│  {                                                                   │
│    recipes: [                                                        │
│      {                                                               │
│        recipeId: ObjectId("recipe_001"),                            │
│        snapshot: {                                                   │
│          steps: [                                                    │
│            { _id: "step_1", order: 1, name: "Mix" },      ◄────┐   │
│            { _id: "step_2", order: 2, name: "Heat" },     ◄────┼─┐ │
│            { _id: "step_3", order: 3, name: "Cool" }      ◄────┼─┼─┐
│          ]                                                       │ │ │
│        },                                                        │ │ │
│        targetQuantity: 10,                                       │ │ │
│        producedQuantity: 0  ◄── Incremented when last step done │ │ │
│      }                                                           │ │ │
│    ]                                                             │ │ │
│  }                                                               │ │ │
└──────────────────────────────────────────────────────────────────┼─┼─┘
                                                                   │ │
        ┌──────────────────────────────────────────────────────────┘ │
        │  ┌───────────────────────────────────────────────────────────┘
        │  │
        ▼  ▼
┌───────────────────────────────────────────────────────────────────┐
│                          TASKS                                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Task 1 (Mix):                                                    │
│  {                                                                │
│    recipeId: "recipe_001",                                        │
│    recipeStepId: "step_1",    ◄── References step _id           │
│    status: "PENDING"                                             │
│  }                                                               │
│         │                                                        │
│         │ POST /api/tasks/task_1/complete                       │
│         │ { workerId: "worker_001" }                            │
│         ▼                                                        │
│  ┌──────────────────────────────────────┐                       │
│  │  1. Mark task COMPLETED               │                       │
│  │  2. Check: order = 1, next = 2?      │                       │
│  │  3. YES → Create Task 2               │                       │
│  └──────────────────────────────────────┘                       │
│         │                                                        │
│         ▼                                                        │
│  Task 2 (Heat): ✨ AUTO-CREATED                                 │
│  {                                                               │
│    recipeId: "recipe_001",                                       │
│    recipeStepId: "step_2",    ◄── Next step                     │
│    status: "PENDING"                                            │
│  }                                                              │
│         │                                                       │
│         │ POST /api/tasks/task_2/complete                      │
│         ▼                                                       │
│  ┌──────────────────────────────────────┐                      │
│  │  1. Mark task COMPLETED               │                      │
│  │  2. Check: order = 2, next = 3?      │                      │
│  │  3. YES → Create Task 3               │                      │
│  └──────────────────────────────────────┘                      │
│         │                                                       │
│         ▼                                                       │
│  Task 3 (Cool): ✨ AUTO-CREATED                                │
│  {                                                              │
│    recipeId: "recipe_001",                                      │
│    recipeStepId: "step_3",    ◄── Last step                    │
│    status: "PENDING"                                           │
│  }                                                             │
│         │                                                      │
│         │ POST /api/tasks/task_3/complete                     │
│         ▼                                                      │
│  ┌──────────────────────────────────────┐                     │
│  │  1. Mark task COMPLETED               │                     │
│  │  2. Check: order = 3, next = 4?      │                     │
│  │  3. NO → This is LAST STEP           │                     │
│  │  4. Increment producedQuantity        │                     │
│  │  5. Recalculate progress              │                     │
│  └──────────────────────────────────────┘                     │
│         │                                                      │
│         ▼                                                      │
│  Recipe execution complete!                                   │
│  producedQuantity: 1                                          │
│  Project progress updated                                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 🎯 Task Completion Logic

```
POST /api/tasks/:id/complete
         │
         ▼
┌────────────────────────┐
│ 1. Validate Task       │
│    - Exists?           │
│    - workerId provided?│
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ 2. Get Project         │
│    - Find recipe       │
│    - Get snapshot      │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ 3. Find Current Step   │
│    - Match recipeStepId│
│    - Get order number  │
└───────┬────────────────┘
        │
        ▼
┌────────────────────────┐
│ 4. Mark COMPLETED      │
│    - status = COMPLETED│
│    - completedAt = now │
│    - progress = 100    │
│    - Calculate duration│
└───────┬────────────────┘
        │
        ▼
    ┌───┴────┐
    │ Next?  │
    └───┬────┘
        │
    ┌───┴────┐
   YES      NO
    │        │
    ▼        ▼
┌────────┐ ┌──────────────────┐
│ Create │ │ Increment        │
│ Next   │ │ producedQuantity │
│ Task   │ │ Recalc Progress  │
└────────┘ └──────────────────┘
```

## 📊 Data Relationships

```
PROJECT
  │
  ├─ products[]
  │    └─ productId (reference)
  │    └─ snapshot (immutable)
  │    └─ targetQuantity
  │    └─ producedQuantity ◄── Updated when product tasks complete
  │
  └─ recipes[]
       └─ recipeId (reference)
       └─ snapshot
       │    └─ steps[]
       │         └─ _id (auto-generated) ◄──────┐
       │         └─ order                        │
       │         └─ name                         │
       │         └─ deviceId                     │
       │         └─ ...                          │
       └─ targetQuantity                         │
       └─ producedQuantity ◄── Updated           │
                                                  │
                                                  │
TASK                                              │
  ├─ projectId ──────► PROJECT                   │
  ├─ recipeId ───────► recipes[].recipeId        │
  ├─ productId ──────► products[].productId (optional)
  ├─ recipeStepId ───► recipes[].snapshot.steps[]._id
  ├─ workerId ───────► User
  ├─ deviceId
  ├─ status
  └─ ...
```

## 🔐 Validation Rules

```
┌─────────────────────────────────────────────────────────────┐
│ Task Creation Validation                                     │
├─────────────────────────────────────────────────────────────┤
│ ✅ projectId must exist                                      │
│ ✅ recipeId must exist in project.recipes[]                 │
│ ✅ recipeStepId must exist in recipe.snapshot.steps[]       │
│ ⚠️  workerId optional at creation                           │
│ ⚠️  productId optional (for product-specific tasks)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Task Status Change Validation (Pre-Save Hook)               │
├─────────────────────────────────────────────────────────────┤
│ 🔴 ONGOING  → workerId REQUIRED                             │
│ 🔴 COMPLETED → workerId REQUIRED                            │
│ ✅ PENDING  → workerId optional                             │
│ ✅ PAUSED   → workerId optional                             │
│ ✅ FAILED   → workerId optional                             │
│                                                             │
│ Auto-Actions:                                               │
│ • ONGOING   → Set startedAt if not set                     │
│ • COMPLETED → Set completedAt if not set                   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 API Request/Response Flow

### **Complete Task (Middle Step)**

```http
POST /api/tasks/task_002/complete
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "workerId": "507f1f77bcf86cd799439011",
  "notes": "Temperature reached 180°C",
  "qualityData": {
    "temperature": 180,
    "duration": 45,
    "passed": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Task completed and next task created",
  "data": {
    "completedTask": {
      "_id": "task_002",
      "status": "COMPLETED",
      "completedAt": "2025-10-25T10:30:00Z",
      "actualDuration": 45,
      "progress": 100
    },
    "nextTask": {
      "_id": "task_003",
      "title": "Cool - Project Week-25",
      "recipeStepId": "step_3",
      "status": "PENDING",
      "priority": "HIGH"
    },
    "isLastStep": false,
    "project": {
      "_id": "proj_001",
      "progress": 66
    }
  }
}
```

### **Complete Task (Last Step)**

```http
POST /api/tasks/task_003/complete
Content-Type: application/json

{
  "workerId": "507f1f77bcf86cd799439011",
  "notes": "Cooling complete"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Task completed and recipe execution finished",
  "data": {
    "completedTask": {
      "_id": "task_003",
      "status": "COMPLETED",
      "completedAt": "2025-10-25T11:00:00Z"
    },
    "nextTask": null,
    "isLastStep": true,
    "project": {
      "_id": "proj_001",
      "progress": 100
    }
  }
}
```

## 🎨 Status Transitions

```
Task Lifecycle:

    PENDING ──────┐
       │          │
       │          │ POST /status
       │          │ {status: "ONGOING"}
       │          │
       ▼          │
    ONGOING ──────┤
       │          │
       │          │ POST /complete
       │          │ or POST /status
       │          │ {status: "COMPLETED"}
       ▼          │
   COMPLETED ─────┘

   Alternative Paths:
   • PENDING → FAILED
   • ONGOING → PAUSED → ONGOING
   • ONGOING → FAILED

   Required Fields by Status:
   • ONGOING: workerId required
   • COMPLETED: workerId required
   • Others: workerId optional
```

## 💡 Key Design Decisions

### ✅ **Order-Based Next Step**

- **Why:** Simple and predictable
- **How:** `nextStep.order = currentStep.order + 1`
- **Alternative:** Could use `dependsOn` graph traversal (more complex)

### ✅ **Immutable Step References**

- **Why:** Tasks reference snapshot.\_id, not master recipe
- **Benefit:** Recipe changes don't affect active tasks

### ✅ **Auto-Create Next Task**

- **Why:** Reduces manual work
- **Benefit:** Seamless workflow, less errors

### ✅ **WorkerId Validation**

- **Why:** Accountability and tracking
- **When:** Required for ONGOING/COMPLETED
- **How:** Pre-save hook validation

### ✅ **Progress Auto-Calculation**

- **Why:** Always accurate
- **Trigger:** When producedQuantity changes
- **Method:** Pre-save hook on Project

---

**Created:** October 25, 2025
**Status:** ✅ Production Ready
