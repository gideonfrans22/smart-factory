# Legacy Documentation

This folder contains **outdated documentation** from previous versions of the Smart Factory backend.

## Why These Files Are Outdated

These documents were created before major model refactoring and contain incorrect field names, structures, and examples:

### Breaking Changes That Invalidate These Docs:

1. **Recipe Model Changes:**

   - ❌ Removed `productCode` field
   - ❌ Removed manual `stepId` (now auto-generated MongoDB `_id`)
   - ❌ Removed manual `mediaId` (now auto-generated MongoDB `_id`)
   - ✅ Added `rawMaterials` array for material tracking
   - ✅ Added optional `recipeNumber` field

2. **Task Model Changes:**

   - ❌ Renamed `assignedTo` → `workerId`
   - ✅ Added `recipeId`, `productId`, `recipeStepId` fields

3. **Project Model Changes:**

   - ✅ Added `products[]` array with snapshots
   - ✅ Added `recipes[]` array with snapshots
   - ✅ Implemented immutable snapshot architecture

4. **New Features:**
   - ✅ Raw Material management system
   - ✅ Cascade deletion prevention
   - ✅ Material specifications tracking

## Current Documentation

**Please refer to these up-to-date files instead:**

- **`MONGODB_SCHEMA.md`** - Complete, current database schema
- **`RAW_MATERIAL_IMPLEMENTATION.md`** - Raw material system documentation
- **`TASK_FLOW_ARCHITECTURE.md`** - Current task flow (mostly accurate)
- **`PROJECT_STRUCTURE.md`** - Project organization
- **`API_IMPLEMENTATION_COMPLETE.md`** - Implementation status

## Legacy Files

### `RECIPE_ENHANCEMENTS_TESTING.md`

- Original testing guide with outdated examples
- All recipe creation examples use wrong field names
- Missing raw materials integration

### `RECIPE_ENHANCEMENTS_ARCHITECTURE.md`

- Original architecture document
- Shows manual ID generation (now automatic)
- Missing snapshot architecture
- Missing raw materials

### `BACKEND_API_SPECIFICATION.md`

- Original API specification
- Contains outdated schemas
- Missing new endpoints (raw materials, etc.)

---

**Last Updated:** October 25, 2025  
**Reason for Deprecation:** Major model refactoring and feature additions
