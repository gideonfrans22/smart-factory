# Project Model - Visual Structure

## 🏗️ New Schema Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROJECT                                  │
├─────────────────────────────────────────────────────────────────┤
│ • _id: ObjectId                                                  │
│ • name: string                                                   │
│ • description?: string                                           │
│ • status: enum                                                   │
│ • priority: enum                                                 │
│ • startDate: Date                                                │
│ • endDate: Date                                                  │
│ • deadline?: Date                                                │
│ • progress: number (auto-calculated)                             │
│ • createdBy: ObjectId → User                                     │
│ • createdAt: Date                                                │
│ • updatedAt: Date                                                │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ PRODUCTS ARRAY                                            │   │
│ ├──────────────────────────────────────────────────────────┤   │
│ │ [                                                         │   │
│ │   {                                                       │   │
│ │     productId: ObjectId ──────────┐                      │   │
│ │     snapshot: {                   │ (reference for       │   │
│ │       designNumber: string        │  linking, but       │   │
│ │       productName: string         │  snapshot is used   │   │
│ │       customerName?: string       │  for data)          │   │
│ │       quantityUnit?: string       │                      │   │
│ │       recipes: [                  │                      │   │
│ │         {                         │                      │   │
│ │           recipeId: string        │                      │   │
│ │           quantity: number        │                      │   │
│ │         }                         │                      │   │
│ │       ]                           │                      │   │
│ │     },                            │                      │   │
│ │     targetQuantity: number ◄──────┼──────┐               │   │
│ │     producedQuantity: number ◄────┼──────┤               │   │
│ │   }                               │      │               │   │
│ │ ]                                 │      │               │   │
│ └───────────────────────────────────┼──────┼───────────────┘   │
│                                     │      │                    │
│ ┌───────────────────────────────────┼──────┼───────────────┐   │
│ │ RECIPES ARRAY                     │      │               │   │
│ ├───────────────────────────────────┼──────┼───────────────┤   │
│ │ [                                 │      │               │   │
│ │   {                               │      │               │   │
│ │     recipeId: ObjectId ───────────┤      │               │   │
│ │     snapshot: {                   │      │               │   │
│ │       recipeNumber?: string       │      │               │   │
│ │       version: number             │      │               │   │
│ │       name: string                │      │               │   │
│ │       description?: string        │      │               │   │
│ │       steps: [                    │      │               │   │
│ │         {                         │      │               │   │
│ │           stepId: string          │      │               │   │
│ │           order: number           │      │               │   │
│ │           name: string            │      │               │   │
│ │           description: string     │      │               │   │
│ │           deviceId: string        │      │               │   │
│ │           ...                     │      │               │   │
│ │         }                         │      │               │   │
│ │       ],                          │      │               │   │
│ │       estimatedDuration: number   │      │               │   │
│ │     },                            │      │               │   │
│ │     targetQuantity: number ◄──────┼──────┤               │   │
│ │     producedQuantity: number ◄────┘      │               │   │
│ │   }                                      │               │   │
│ │ ]                                        │               │   │
│ └──────────────────────────────────────────┼───────────────┘   │
│                                            │                    │
│ ┌──────────────────────────────────────────┼───────────────┐   │
│ │ PROGRESS CALCULATION (Pre-save Hook)     │               │   │
│ ├──────────────────────────────────────────┼───────────────┤   │
│ │                                          │               │   │
│ │  totalProduced = Σ products.produced ────┘               │   │
│ │                + Σ recipes.produced                      │   │
│ │                                                           │   │
│ │  totalTarget = Σ products.target                         │   │
│ │              + Σ recipes.target                          │   │
│ │                                                           │   │
│ │  progress = (totalProduced / totalTarget) × 100          │   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 Relationships

```
┌─────────────┐          ┌─────────────┐
│   Product   │          │   Recipe    │
│  (Master)   │          │  (Master)   │
└──────┬──────┘          └──────┬──────┘
       │                        │
       │ Can be updated         │ Can be updated
       │ freely                 │ freely
       │                        │
       ▼                        ▼
┌──────────────────────────────────────┐
│           PROJECT                     │
│  (Contains immutable snapshots)      │
│                                       │
│  • Product snapshots frozen           │
│  • Recipe snapshots frozen            │
│  • Only quantities can change         │
└──────────────────────────────────────┘
       │
       │ One-to-Many
       │
       ▼
┌─────────────┐
│    Task     │
│             │
│ • projectId │
│ • recipeId  │────┐ References recipe in
│ • productId │    │ project snapshot
│ • stepId    │────┘ Step exists in snapshot
└─────────────┘
```

## 🔐 Cascade Protection

```
DELETE Product/Recipe Attempt
         │
         ▼
┌────────────────────────┐
│  Check if used in      │
│  ANY project?          │
└───────┬────────────────┘
        │
    ┌───┴───┐
    │       │
   YES     NO
    │       │
    ▼       ▼
┌──────┐  ┌──────┐
│ 400  │  │ 200  │
│Error │  │ OK   │
└──────┘  └──────┘
```

## 📊 Data Flow Example

```
1. CREATE PROJECT
   └─→ Fetch Product from DB
       └─→ Create Product Snapshot
           └─→ Store in Project.products[]

   └─→ Fetch Recipe from DB
       └─→ Create Recipe Snapshot
           └─→ Store in Project.recipes[]

   └─→ Calculate Progress (0%)
       └─→ Save Project

2. TASK COMPLETION
   └─→ Task completes recipe step
       └─→ Is last step?
           ├─→ YES: Increment producedQuantity
           │        └─→ Save Project
           │             └─→ Progress auto-recalculates
           │
           └─→ NO: Create next task
                   └─→ Use snapshot steps

3. UPDATE MASTER RECIPE
   └─→ Recipe v1 → Recipe v2
       └─→ Active projects still use v1 snapshot ✓
       └─→ New projects will get v2 snapshot ✓
```

## 🎯 Key Design Decisions

### ✅ **Snapshot at Creation**

- **Why:** Immutability, audit trail, worker clarity
- **When:** Project creation only
- **What:** Full product/recipe details including all recipe steps

### ✅ **Reference + Snapshot**

- **Reference:** For linking and cascade checks
- **Snapshot:** For actual data used in project

### ✅ **Equal Weight Progress**

- **Why:** Simplicity
- **Formula:** All products and recipes weighted equally
- **Auto-calculated:** On every save

### ✅ **Cascade Prevention**

- **Scope:** ANY project (active, completed, cancelled)
- **Why:** Historical integrity and compliance
- **Result:** Must archive/delete projects before deleting product/recipe

---

**Created:** October 25, 2025
