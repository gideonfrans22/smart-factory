# Raw Material — Implementation (current)

**Last updated:** April 2026 (Phase 6 — legacy field removal)

For migration history and rollout, see [raw-material-breaking-change-plan.md](./raw-material-breaking-change-plan.md).

---

## Overview

Raw materials are inventory rows linked to **`RawMaterialType`** (`materialType` ObjectId). Physical identity is **`materialType` + `dimensions.length/width/height`** (compound unique index when all are present).

Legacy fields **`materialCode`**, **`name`**, and **`specifications[]`** have been removed from the schema and API.

---

## Model (`src/modules/raw-material/raw-material.model.ts`)

| Field | Type | Notes |
|--------|------|--------|
| `materialType` | ObjectId → RawMaterialType | **Required** |
| `dimensions` | `{ length, width, height, unit? }` | **Required**; `length`/`width`/`height` required numbers |
| `weight` | `{ value?, unit? }` | Optional |
| `color` | string | Optional |
| `description` | string | Optional |
| `supplier` | string | Optional |
| `unit` | string | Optional |
| `currentStock` | number | Default 0 |
| `modifiedBy` | ObjectId → User | Optional |

**Indexes:** `{ materialType: 1 }`, compound unique on `materialType` + `dimensions.length` + `dimensions.width` + `dimensions.height` (partial filter when all dimension fields exist).

**Note:** `RawMaterialSpecification` in code is still used for **recipe line** `specification` / snapshot shapes, not as an array on `RawMaterial`.

---

## API (`/api/raw-materials`)

- **List:** `GET /api/raw-materials` — `search` matches supplier, description, and populated type `code`/`name` (via aggregation).
- **CRUD:** Create/update use `materialType` (ObjectId string) and root `dimensions` / `weight` / `color` (see Zod validators in `raw-material.validators.ts`).
- **Import:** Single **Raw Materials** sheet (`materialTypeCode`, `materialTypeName`, dims, weight, etc.); no separate Specifications sheet.

---

## Downstream

- **Recipe / product** populate `rawMaterials.materialId` with `materialType`, `description`, `supplier`, `unit`, `dimensions`, `weight`, `color`.
- **Recipe snapshots** (`SnapshotService`): `rawMaterialNumber` is raw material `_id` string; display `name` prefers **material type name** from populated `materialType`.

---

## Related files

- Types/DTOs: `raw-material.types.ts`, `api_spec/types/rawMaterial.ts`
- Repositories: `adapters/mongo/raw-material.repository.ts`, `raw-material.read.repository.ts`
- Excel: `adapters/excel/raw-material.excel.ts`
