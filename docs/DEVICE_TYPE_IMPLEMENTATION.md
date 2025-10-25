# DeviceType API Implementation

## Overview

The DeviceType API groups devices of the same type together, allowing flexible task assignment to any available device of the required type rather than being locked to a specific device.

## Architecture Changes

### 1. New Model: DeviceType

**Purpose:** Categorize devices by type (e.g., "CNC Machine", "3D Printer", "Welding Robot")

**Schema:**

```typescript
{
  name: string;              // Required, unique (e.g., "CNC Machine Type A")
  description?: string;      // Optional description
  specifications?: {         // Optional flexible specifications
    maxDimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string;
    };
    maxWeight?: {
      value?: number;
      unit?: string;
    };
    [key: string]: any;     // Allow any custom specifications
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Model Updates

#### Device Model (Updated)

- **Added:** `deviceTypeId: ObjectId` - Required reference to DeviceType
- **Purpose:** Links each physical device to its type category

#### Recipe Model (Updated)

- **Changed:** `RecipeStep.deviceId` → `RecipeStep.deviceTypeId`
- **Type:** `string` → `ObjectId`
- **Purpose:** Recipe steps now specify device TYPE needed, not specific device

#### Task Model (Updated)

- **Added:** `deviceTypeId: ObjectId` - Required, copied from recipe step
- **Changed:** `deviceId` type from `string` to `ObjectId`
- **Validation:**
  - `deviceId` optional when `status = PENDING`
  - `deviceId` required when `status = ONGOING` or `COMPLETED`
  - Device must match the required deviceTypeId

## Task Assignment Flow

### Before (Old System)

```
Recipe Step → Specific Device (e.g., "Device-123")
           ↓
Task → Must use Device-123 (no flexibility)
```

### After (New System)

```
Recipe Step → Device Type (e.g., "CNC Machine")
           ↓
Task → Can use any ONLINE CNC Machine
    → Worker selects Device-456 or Device-789 when starting
```

## API Endpoints

### Base URL: `/api/device-types`

All endpoints require authentication (`Authorization: Bearer <token>`)

---

### 1. Get All Device Types

**Endpoint:** `GET /api/device-types`

**Response:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "6789abc...",
      "name": "CNC Machine",
      "description": "Computer Numerical Control machines for precision cutting",
      "specifications": {
        "maxDimensions": {
          "length": 1000,
          "width": 500,
          "height": 300,
          "unit": "mm"
        }
      },
      "createdAt": "2025-10-25T10:00:00Z",
      "updatedAt": "2025-10-25T10:00:00Z"
    }
  ]
}
```

---

### 2. Get Device Type by ID

**Endpoint:** `GET /api/device-types/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "6789abc...",
    "name": "CNC Machine",
    "description": "...",
    "specifications": {...}
  }
}
```

---

### 3. Get All Devices of a Type

**Endpoint:** `GET /api/device-types/:id/devices`

**Purpose:** Get all devices (any status) of a specific type

**Response:**

```json
{
  "success": true,
  "deviceType": {
    "_id": "6789abc...",
    "name": "CNC Machine"
  },
  "count": 5,
  "data": [
    {
      "_id": "device123",
      "name": "CNC-A-001",
      "type": "CNC Milling",
      "deviceTypeId": "6789abc...",
      "status": "ONLINE",
      "location": "Factory Floor A"
    },
    {
      "_id": "device456",
      "name": "CNC-A-002",
      "type": "CNC Milling",
      "deviceTypeId": "6789abc...",
      "status": "MAINTENANCE",
      "location": "Factory Floor B"
    }
  ]
}
```

---

### 4. Get Available Devices of a Type

**Endpoint:** `GET /api/device-types/:id/devices/available`

**Purpose:** Get only ONLINE devices of a specific type (for task assignment)

**Response:**

```json
{
  "success": true,
  "deviceType": {
    "_id": "6789abc...",
    "name": "CNC Machine"
  },
  "count": 3,
  "data": [
    {
      "_id": "device123",
      "name": "CNC-A-001",
      "status": "ONLINE",
      "location": "Factory Floor A"
    }
  ]
}
```

---

### 5. Create Device Type

**Endpoint:** `POST /api/device-types`

**Request Body:**

```json
{
  "name": "3D Printer",
  "description": "Additive manufacturing machines",
  "specifications": {
    "maxDimensions": {
      "length": 300,
      "width": 300,
      "height": 400,
      "unit": "mm"
    },
    "materials": ["PLA", "ABS", "PETG"],
    "layerHeight": "0.1-0.4mm"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Device type created successfully",
  "data": {
    "_id": "6789xyz...",
    "name": "3D Printer",
    "description": "...",
    "specifications": {...}
  }
}
```

---

### 6. Update Device Type

**Endpoint:** `PUT /api/device-types/:id`

**Request Body:** (all fields optional)

```json
{
  "name": "3D Printer Pro",
  "description": "Updated description",
  "specifications": {
    "maxDimensions": {
      "length": 400,
      "width": 400,
      "height": 500,
      "unit": "mm"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Device type updated successfully",
  "data": {...}
}
```

---

### 7. Delete Device Type

**Endpoint:** `DELETE /api/device-types/:id`

**Cascade Prevention:**

- Cannot delete if any devices reference it
- Cannot delete if any recipe steps reference it
- Cannot delete if any tasks reference it

**Response (Success):**

```json
{
  "success": true,
  "message": "Device type deleted successfully",
  "data": {...}
}
```

**Response (Error - Has Dependencies):**

```json
{
  "success": false,
  "message": "Cannot delete device type: It is referenced by device \"CNC-A-001\". Please reassign or delete dependent devices first."
}
```

---

## Updated Workflows

### Creating a Recipe with Device Types

```json
POST /api/recipes
{
  "name": "Steel Frame Assembly",
  "rawMaterials": [...],
  "steps": [
    {
      "order": 1,
      "name": "Cut steel bars",
      "description": "...",
      "estimatedDuration": 30,
      "deviceTypeId": "6789abc...",  // CNC Machine type
      "qualityChecks": [...]
    },
    {
      "order": 2,
      "name": "Weld joints",
      "description": "...",
      "estimatedDuration": 45,
      "deviceTypeId": "6789def...",  // Welding Robot type
      "qualityChecks": [...]
    }
  ]
}
```

### Creating a Task

```json
POST /api/tasks
{
  "title": "Cut steel bars - Batch #123",
  "projectId": "proj123",
  "recipeId": "recipe456",
  "recipeStepId": "step_object_id",
  "deviceTypeId": "6789abc...",  // Required: from recipe step
  "workerId": "user123",          // Optional at creation
  "deviceId": null,               // Optional at creation (PENDING)
  "status": "PENDING"
}
```

### Starting a Task (Worker Flow)

**Step 1:** Get available devices for the task

```
GET /api/device-types/:deviceTypeId/devices/available
```

**Step 2:** Worker selects a device and starts task

```json
PUT /api/tasks/:taskId
{
  "status": "ONGOING",
  "deviceId": "device123",  // Selected from available devices
  "workerId": "user123"
}
```

**Validation:** Backend validates:

- Device exists
- Device status is ONLINE
- Device's deviceTypeId matches task's deviceTypeId
- workerId is provided

---

## Migration Notes

### For Existing Data (Manual Migration Required)

**Step 1: Create Device Types**

```bash
# Create device types for all existing device categories
POST /api/device-types { "name": "CNC Machine" }
POST /api/device-types { "name": "Welding Robot" }
POST /api/device-types { "name": "3D Printer" }
```

**Step 2: Update Devices**

```bash
# Add deviceTypeId to all existing devices
PUT /api/devices/:id { "deviceTypeId": "..." }
```

**Step 3: Update Recipes**

```bash
# Change recipe steps from deviceId (string) to deviceTypeId (ObjectId)
# This may require custom migration script or manual update
```

**Step 4: Update Tasks**

```bash
# Add deviceTypeId to existing tasks
# Change deviceId from string to ObjectId
```

### Migration Script Recommendations

```typescript
// Example migration pseudocode
async function migrateToDeviceTypes() {
  // 1. Create device type mapping
  const deviceTypeMap = new Map();

  // 2. For each unique device.type, create DeviceType
  const uniqueTypes = await Device.distinct("type");
  for (const type of uniqueTypes) {
    const deviceType = await DeviceType.create({ name: type });
    deviceTypeMap.set(type, deviceType._id);
  }

  // 3. Update all devices with deviceTypeId
  for (const device of await Device.find()) {
    device.deviceTypeId = deviceTypeMap.get(device.type);
    await device.save();
  }

  // 4. Update recipes (requires manual review)
  // Map old deviceId strings to new deviceTypeId ObjectIds

  // 5. Update tasks similarly
}
```

---

## Benefits

### ✅ Flexibility

- Tasks not locked to specific devices
- Better load balancing across multiple machines
- Handle device maintenance without blocking tasks

### ✅ Scalability

- Easy to add new devices of existing types
- No need to update recipes when adding devices

### ✅ Efficiency

- Workers can choose any available device
- Reduces bottlenecks from device-specific assignments

### ✅ Data Integrity

- Cascade prevention protects relationships
- Validation ensures device type matching

---

**Last Updated:** October 25, 2025  
**Version:** 1.0 (Initial Implementation)
