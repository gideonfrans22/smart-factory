# Smart Factory Backend API Documentation

> **Purpose**: Comprehensive, AI-friendly reference for all API endpoints in the Smart Factory system.  
> **Format**: Optimized for LLM consumption with clear structure, types, and examples.  
> **Base URL**: `http://localhost:3001/api`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Device Types](#3-device-types)
4. [Devices](#4-devices)
5. [Raw Materials](#5-raw-materials)
6. [Recipes](#6-recipes)
7. [Recipe Media](#7-recipe-media)
8. [Products](#8-products)
9. [Projects](#9-projects)
10. [Tasks](#10-tasks)
11. [Task Media](#11-task-media)
12. [Alerts](#12-alerts)
13. [KPI](#13-kpi)
14. [Reports](#14-reports)

---

## Authentication & Authorization

**Header Format**: `Authorization: Bearer <access_token>`

**Roles**:

- `admin` - Full system access
- `manager` - Read/write for projects, tasks, reports
- `worker` - Read/write for assigned tasks only

**Public Endpoints** (No Auth):

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/devices/register`

---

## 1. Authentication

### 1.1 Login

```
POST /api/auth/login
Content-Type: application/json
```

**Request Body**:

```json
{
  "emailOrUsername": "admin@smartfactory.com", // Email (admin) or username (worker)
  "password": "admin123"
}
```

**Response 200**:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "admin",
      "email": "admin@smartfactory.com",
      "role": "admin",
      "name": "Admin User"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error 401**:

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email/username or password"
}
```

---

### 1.2 Register

```
POST /api/auth/register
Content-Type: application/json
```

**Request Body**:

```json
{
  "username": "worker01",
  "email": "worker@factory.com", // Optional for workers
  "password": "password123",
  "name": "John Worker",
  "role": "worker", // "admin" | "manager" | "worker"
  "department": "Production" // Optional
}
```

**Response 201**:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439012",
      "username": "worker01",
      "role": "worker",
      "name": "John Worker"
    }
  }
}
```

---

### 1.3 Get Profile

```
GET /api/auth/profile
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "email": "admin@smartfactory.com",
    "role": "admin",
    "name": "Admin User",
    "department": "Management",
    "createdAt": "2025-10-27T10:00:00Z"
  }
}
```

---

## 2. Users

**Auth Required**: Yes (Admin only)

### 2.1 List Users

```
GET /api/users?page=1&limit=10&role=worker
Authorization: Bearer <admin_token>
```

**Query Parameters**:

- `page` (number, default: 1) - Page number
- `limit` (number, default: 10) - Items per page
- `role` (string) - Filter by role: "admin" | "manager" | "worker"

**Response 200**:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "items": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "username": "worker01",
        "email": "worker@factory.com",
        "name": "John Worker",
        "role": "worker",
        "department": "Production",
        "createdAt": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### 2.2 Get User by ID

```
GET /api/users/:id
Authorization: Bearer <admin_token>
```

**Response 200**: Single user object

---

### 2.3 Create User

```
POST /api/users
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body**: Same as register

**Response 201**: Created user object

---

### 2.4 Update User

```
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body** (all optional):

```json
{
  "name": "Updated Name",
  "email": "newemail@factory.com",
  "password": "newpassword",
  "department": "Quality Control",
  "role": "manager"
}
```

**Response 200**: Updated user object

---

### 2.5 Delete User

```
DELETE /api/users/:id
Authorization: Bearer <admin_token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 3. Device Types

**Auth Required**: Yes  
**Purpose**: Categorize devices by type (e.g., "CNC Machine", "3D Printer")

### 3.1 List Device Types

```
GET /api/device-types
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "6789abc123def456",
      "name": "CNC Machine",
      "description": "Computer Numerical Control machines for precision cutting",
      "specifications": {
        "maxDimensions": {
          "length": 1000,
          "width": 500,
          "height": 300,
          "unit": "mm"
        },
        "maxWeight": {
          "value": 500,
          "unit": "kg"
        }
      },
      "createdAt": "2025-10-25T10:00:00Z",
      "updatedAt": "2025-10-25T10:00:00Z"
    }
  ]
}
```

---

### 3.2 Get Device Type by ID

```
GET /api/device-types/:id
Authorization: Bearer <token>
```

**Response 200**: Single device type object

---

### 3.3 Get Devices of Type

```
GET /api/device-types/:id/devices
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "deviceType": {
    "_id": "6789abc123def456",
    "name": "CNC Machine"
  },
  "count": 5,
  "data": [
    {
      "_id": "device123",
      "name": "CNC-A-001",
      "type": "CNC Milling",
      "deviceTypeId": "6789abc123def456",
      "status": "ONLINE",
      "location": "Factory Floor A"
    }
  ]
}
```

---

### 3.4 Get Available Devices of Type

```
GET /api/device-types/:id/devices/available
Authorization: Bearer <token>
```

**Purpose**: Get only ONLINE devices for task assignment

**Response 200**: Same as 3.3 but filtered to `status: "ONLINE"`

---

### 3.5 Create Device Type

```
POST /api/device-types
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "name": "3D Printer", // Required, unique
  "description": "Additive manufacturing machines", // Optional
  "specifications": {
    // Optional, flexible object
    "maxDimensions": {
      "length": 300,
      "width": 300,
      "height": 400,
      "unit": "mm"
    },
    "materials": ["PLA", "ABS", "PETG"]
  }
}
```

**Response 201**: Created device type object

---

### 3.6 Update Device Type

```
PUT /api/device-types/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**: Same fields as create (all optional)

**Response 200**: Updated device type object

---

### 3.7 Delete Device Type

```
DELETE /api/device-types/:id
Authorization: Bearer <token>
```

**Cascade Prevention**: Cannot delete if:

- Any devices reference it
- Any recipe steps reference it
- Any tasks reference it

**Response 200**:

```json
{
  "success": true,
  "message": "Device type deleted successfully"
}
```

**Error 400** (has dependencies):

```json
{
  "success": false,
  "message": "Cannot delete device type: It is referenced by device \"CNC-A-001\""
}
```

---

## 4. Devices

**Auth Required**: Yes (except register)

### 4.1 List Devices

```
GET /api/devices?status=ONLINE&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `status` (string) - "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR"
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**: Paginated devices

---

### 4.2 Get Device by ID

```
GET /api/devices/:id
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "_id": "device123",
    "name": "CNC-A-001",
    "type": "CNC Milling",
    "deviceTypeId": "6789abc123def456",
    "location": "Factory Floor A",
    "status": "ONLINE",
    "ipAddress": "192.168.1.100",
    "lastHeartbeat": "2025-10-27T10:00:00Z",
    "config": {
      "maxSpeed": 5000,
      "precision": "0.01mm"
    },
    "createdAt": "2025-10-25T10:00:00Z"
  }
}
```

---

### 4.3 Register Device

```
POST /api/devices/register
Content-Type: application/json
```

**No Auth Required** (for device self-registration)

**Request Body**:

```json
{
  "name": "CNC-A-002", // Required
  "type": "CNC Milling", // Required
  "deviceTypeId": "6789abc123def456", // Required (ObjectId)
  "location": "Factory Floor B", // Optional
  "status": "OFFLINE", // Optional, default: "OFFLINE"
  "ipAddress": "192.168.1.101", // Optional
  "macAddress": "00:1B:44:11:3A:B7", // Optional
  "config": {} // Optional
}
```

**Response 201**: Created device object

**Error 404** (device type not found):

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Device type not found: 6789abc123def456"
}
```

---

### 4.4 Update Device

```
PUT /api/devices/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body** (all optional):

```json
{
  "name": "CNC-A-002-Updated",
  "deviceTypeId": "6789abc123def999",
  "location": "Factory Floor C",
  "status": "MAINTENANCE",
  "ipAddress": "192.168.1.102",
  "config": { "maxSpeed": 6000 }
}
```

**Response 200**: Updated device object

---

### 4.5 Delete Device

```
DELETE /api/devices/:id
Authorization: Bearer <admin_token>
```

**Cascade Prevention**: Cannot delete if used in recipe steps

**Response 200**:

```json
{
  "success": true,
  "message": "Device deleted successfully"
}
```

**Error 409** (has dependencies):

```json
{
  "success": false,
  "error": "CONFLICT",
  "message": "Cannot delete device: It is referenced by recipe steps in recipe \"Steel Frame Assembly\""
}
```

---

## 5. Raw Materials

**Auth Required**: Yes

### 5.1 List Raw Materials

```
GET /api/raw-materials?search=steel&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `search` (string) - Search in materialCode, name, description
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**:

```json
{
  "success": true,
  "message": "Raw materials retrieved successfully",
  "data": {
    "items": [
      {
        "_id": "mat123",
        "materialCode": "STEEL-001",
        "name": "Steel Bar 10mm",
        "description": "High-grade steel bar",
        "unit": "pieces",
        "currentStock": 500,
        "specifications": {
          "length": "2m",
          "diameter": "10mm",
          "weight": "5kg",
          "material": "carbon steel"
        },
        "supplier": "Steel Corp",
        "createdAt": "2025-10-25T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 5.2 Get Raw Material by ID

```
GET /api/raw-materials/:id
Authorization: Bearer <token>
```

**Response 200**: Single raw material object

---

### 5.3 Create Raw Material

```
POST /api/raw-materials
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "materialCode": "STEEL-002", // Required, unique, auto-uppercase
  "name": "Steel Plate 5mm", // Required
  "description": "Flat steel plate", // Optional
  "unit": "sheets", // Optional (e.g., "pieces", "kg", "liters")
  "currentStock": 100, // Optional, default: 0
  "specifications": {
    // Optional, flexible object
    "thickness": "5mm",
    "dimensions": "1000x2000mm",
    "weight": "78.5kg"
  },
  "supplier": "Steel Corp" // Optional
}
```

**Response 201**: Created raw material object

---

### 5.4 Update Raw Material

```
PUT /api/raw-materials/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**: Same fields as create (all optional)

**Response 200**: Updated raw material object

---

### 5.5 Delete Raw Material

```
DELETE /api/raw-materials/:id
Authorization: Bearer <token>
```

**Cascade Prevention**: Cannot delete if used in any recipes

**Response 200**:

```json
{
  "success": true,
  "message": "Raw material deleted successfully"
}
```

**Error 400** (used in recipes):

```json
{
  "success": false,
  "message": "Cannot delete raw material: It is used in 3 recipe(s)"
}
```

---

## 6. Recipes

**Auth Required**: Yes

### 6.1 List Recipes

```
GET /api/recipes?search=frame&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `recipeNumber` (string) - Filter by recipe number
- `search` (string) - Search in name, recipeNumber, description
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**:

```json
{
  "success": true,
  "message": "Recipes retrieved successfully",
  "data": {
    "items": [
      {
        "_id": "recipe123",
        "recipeNumber": "RCP-001",
        "version": 1,
        "name": "Steel Frame Assembly",
        "description": "Complete assembly process for steel frames",
        "rawMaterials": [
          {
            "materialId": "mat123",
            "quantityRequired": 5
          }
        ],
        "steps": [
          {
            "_id": "step001",  // Auto-generated ObjectId
            "order": 1,
            "name": "Cut steel bars",
            "description": "Cut steel to specified lengths",
            "estimatedDuration": 30,  // minutes
            "deviceTypeId": "deviceType001",
            "qualityChecks": ["Measure length", "Check edges"],
            "dependsOn": [],  // Array of step ObjectIds
            "media": []
          }
        ],
        "estimatedDuration": 120,  // Total, auto-calculated
        "createdAt": "2025-10-25T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 6.2 Get Recipe by ID

```
GET /api/recipes/:id
Authorization: Bearer <token>
```

**Response 200**: Single recipe object with all steps and raw materials

---

### 6.3 Get Recipe by Number

```
GET /api/recipes/by-number/:recipeNumber?version=2
Authorization: Bearer <token>
```

**Query Parameters**:

- `version` (number, optional) - Get specific version (default: latest)

**Response 200**: Single recipe object

---

### 6.4 Create Recipe

```
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "recipeNumber": "RCP-002", // Optional, for versioning
  "version": 1, // Optional, default: 1
  "name": "Product Assembly", // Required
  "description": "Assembly process", // Optional
  "rawMaterials": [
    // Optional array
    {
      "materialId": "mat123", // Required, must exist
      "quantityRequired": 5 // Required, >= 0
    }
  ],
  "steps": [
    // Required, min 1 step
    {
      "order": 1, // Optional, auto-assigned
      "name": "Cut materials", // Required
      "description": "Cut to size", // Required
      "estimatedDuration": 30, // Required (minutes)
      "deviceTypeId": "deviceType001", // Required, must exist
      "qualityChecks": ["Check dimensions"], // Optional
      "dependsOn": [], // Optional, array of step ObjectIds
      "media": [] // Optional
    }
  ]
}
```

**Validation**:

- All `rawMaterials[].materialId` must exist
- All `steps[].deviceTypeId` must exist
- No circular dependencies in `steps[].dependsOn`
- Total `estimatedDuration` auto-calculated from steps

**Response 201**: Created recipe with auto-generated step `_id`s

---

### 6.5 Update Recipe

```
PUT /api/recipes/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (all optional):

```json
{
  "name": "Updated Recipe Name",
  "description": "Updated description",
  "rawMaterials": [ ... ],  // Replace entire array
  "steps": [ ... ]  // Replace entire array
}
```

**Response 200**: Updated recipe object

---

### 6.6 Delete Recipe

```
DELETE /api/recipes/:id
Authorization: Bearer <token>
```

**Cascade Prevention**: Cannot delete if used in any projects

**Response 200**:

```json
{
  "success": true,
  "message": "Recipe deleted successfully"
}
```

**Error 400** (used in projects):

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Cannot delete recipe. It is being used in one or more projects."
}
```

---

### 6.7 Create Recipe Version

```
POST /api/recipes/:id/version
Authorization: Bearer <token>
Content-Type: application/json
```

**Purpose**: Create new version of existing recipe

**Request Body** (all optional):

```json
{
  "name": "Updated name",
  "description": "Updated description",
  "steps": [ ... ]  // New steps
}
```

**Response 201**: New recipe with incremented version number

---

### 6.8 Get Dependency Graph

```
GET /api/recipes/:id/dependency-graph
Authorization: Bearer <token>
```

**Purpose**: Get topological order of steps based on dependencies

**Response 200**:

```json
{
  "success": true,
  "data": {
    "recipeId": "recipe123",
    "recipeNumber": "RCP-001",
    "version": 1,
    "topologicalOrder": [
      {
        "stepId": "step001",
        "name": "Cut steel bars",
        "order": 1,
        "dependsOn": [],
        "level": 0
      },
      {
        "stepId": "step002",
        "name": "Weld joints",
        "order": 2,
        "dependsOn": ["step001"],
        "level": 1
      }
    ],
    "dependencyGraph": {
      "step001": [],
      "step002": ["step001"]
    }
  }
}
```

**Error 400** (circular dependencies):

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Circular dependencies detected in recipe steps"
}
```

---

## 7. Recipe Media

**Auth Required**: Yes  
**Purpose**: Upload media (images, videos, PDFs) for recipe steps

### 7.1 Upload Media to Step

```
POST /api/recipes/:recipeId/steps/:stepId/media
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body** (FormData):

- `file` (File) - Required, the file to upload
- `mediaType` (string) - Required: "INSTRUCTION" | "DIAGRAM" | "VIDEO" | "QUALITY_CHECK"
- `description` (string) - Optional description

**Response 201**:

```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "recipeId": "recipe123",
    "stepId": "step001",
    "media": {
      "_id": "media001", // Auto-generated
      "filename": "1730025600000-diagram.png",
      "originalName": "cutting-diagram.png",
      "mimeType": "image/png",
      "fileSize": 524288,
      "filePath": "/uploads/recipe-media/1730025600000-diagram.png",
      "mediaType": "DIAGRAM",
      "description": "Cutting diagram for steel bars",
      "uploadedAt": "2025-10-27T10:00:00Z"
    }
  }
}
```

**Error 404** (recipe or step not found):

```json
{
  "success": false,
  "message": "Recipe or step not found"
}
```

---

### 7.2 Get Step Media

```
GET /api/recipes/:recipeId/steps/:stepId/media
Authorization: Bearer <token>
```

**Response 200**: Array of media objects for the step

---

### 7.3 Get Single Media

```
GET /api/recipes/:recipeId/steps/:stepId/media/:mediaId
Authorization: Bearer <token>
```

**Response 200**: Single media object

---

### 7.4 Update Media

```
PUT /api/recipes/:recipeId/steps/:stepId/media/:mediaId
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "mediaType": "QUALITY_CHECK",
  "description": "Updated description"
}
```

**Response 200**: Updated media object

---

### 7.5 Delete Media

```
DELETE /api/recipes/:recipeId/steps/:stepId/media/:mediaId
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

---

## 8. Products

**Auth Required**: Yes

### 8.1 List Products

```
GET /api/products?search=frame&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `search` (string) - Search in designNumber, productName, customerName
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "prod123",
        "designNumber": "DES-001",
        "productName": "Steel Frame Type A",
        "customerName": "ABC Manufacturing",
        "personInCharge": {
          "_id": "user123",
          "name": "John Manager"
        },
        "quantityUnit": "units",
        "recipes": [
          {
            "recipeId": "recipe123",  // ObjectId reference
            "quantity": 2
          }
        ],
        "createdAt": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 8.2 Get Product by ID

```
GET /api/products/:id
Authorization: Bearer <token>
```

**Response 200**: Single product with populated personInCharge

---

### 8.3 Create Product

```
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "designNumber": "DES-002", // Required, unique
  "productName": "Steel Frame Type B", // Required
  "customerName": "XYZ Corp", // Optional
  "personInCharge": "user123", // Required (User ObjectId)
  "quantityUnit": "units", // Optional (e.g., "units", "kg", "sets")
  "recipes": [
    // Optional array
    {
      "recipeId": "recipe123", // Required (Recipe ObjectId)
      "quantity": 2 // Required, >= 0
    }
  ]
}
```

**Response 201**: Created product object

---

### 8.4 Update Product

```
PUT /api/products/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**: Same fields as create (all optional)

**Response 200**: Updated product object

---

### 8.5 Delete Product

```
DELETE /api/products/:id
Authorization: Bearer <token>
```

**Cascade Prevention**: Cannot delete if used in any projects

**Response 200**:

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## 9. Projects

**Auth Required**: Yes

### 9.1 List Projects

```
GET /api/projects?status=ACTIVE&priority=HIGH&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `status` (string) - "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED"
- `priority` (string) - "LOW" | "MEDIUM" | "HIGH" | "URGENT"
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "proj123",
        "name": "Order #1234",
        "description": "Steel frame production run",
        "status": "ACTIVE",
        "priority": "HIGH",
        "startDate": "2025-10-27T00:00:00Z",
        "endDate": "2025-11-27T00:00:00Z",
        "products": [
          {
            "productId": "prod123",
            "snapshot": {
              "designNumber": "DES-001",
              "productName": "Steel Frame Type A",
              // ... frozen product data
            }
          }
        ],
        "recipes": [
          {
            "recipeId": "recipe123",
            "targetQuantity": 10,
            "producedQuantity": 3,
            "snapshot": {
              "name": "Frame Assembly",
              "version": 1,
              "steps": [ ... ],
              "rawMaterials": [
                {
                  "materialId": "mat123",
                  "quantityRequired": 5,
                  "snapshot": {
                    "materialCode": "STEEL-001",
                    "name": "Steel Bar 10mm",
                    // ... frozen material data
                  }
                }
              ]
            }
          }
        ],
        "progress": 30,  // Auto-calculated percentage
        "createdAt": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

**Key Concept - Snapshots**:

- Projects store **immutable snapshots** of products, recipes, and raw materials
- Changes to recipes/products don't affect active projects
- Ensures traceability and audit trails

---

### 9.2 Get Project by ID

```
GET /api/projects/:id
Authorization: Bearer <token>
```

**Response 200**: Single project with full snapshots

---

### 9.3 Create Project

```
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "name": "Order #1235", // Required
  "description": "Production order", // Optional
  "status": "PLANNING", // Optional, default: "PLANNING"
  "priority": "MEDIUM", // Optional, default: "MEDIUM"
  "startDate": "2025-11-01T00:00:00Z", // Optional
  "endDate": "2025-12-01T00:00:00Z", // Optional
  "products": ["prod123", "prod456"], // Optional, array of Product IDs
  "recipes": [
    // Optional, array of recipe targets
    {
      "recipeId": "recipe123",
      "targetQuantity": 10
    }
  ]
}
```

**Backend Actions**:

1. Validates all product and recipe IDs exist
2. Creates immutable snapshots of:
   - Products (with all data)
   - Recipes (with steps and media)
   - Raw materials (referenced by recipes)
3. Initializes `producedQuantity` to 0 for each recipe
4. Calculates initial `progress` (0%)

**Response 201**: Created project with snapshots

---

### 9.4 Update Project

```
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (all optional):

```json
{
  "name": "Updated Order Name",
  "description": "Updated description",
  "status": "ACTIVE",
  "priority": "URGENT",
  "startDate": "2025-11-01T00:00:00Z",
  "endDate": "2025-12-15T00:00:00Z"
}
```

**Note**: Cannot modify products, recipes, or snapshots after creation

**Response 200**: Updated project object

---

### 9.5 Delete Project

```
DELETE /api/projects/:id
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## 10. Tasks

**Auth Required**: Yes

### 10.1 List Tasks

```
GET /api/tasks?status=PENDING&projectId=proj123&workerId=user456
Authorization: Bearer <token>
```

**Query Parameters**:

- `status` (string) - "PENDING" | "ONGOING" | "PAUSED" | "COMPLETED" | "FAILED"
- `deviceId` (string) - Filter by device ObjectId
- `projectId` (string) - Filter by project ObjectId
- `recipeId` (string) - Filter by recipe ObjectId
- `productId` (string) - Filter by product ObjectId
- `workerId` (string) - Filter by assigned worker ObjectId
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "task123",
        "title": "Cut steel bars - Order #1234",
        "description": "Cut steel to specified lengths",
        "projectId": {
          "_id": "proj123",
          "name": "Order #1234",
          "status": "ACTIVE"
        },
        "recipeId": "recipe123",
        "productId": "prod123",  // Optional
        "recipeStepId": "step001",  // Step ObjectId from snapshot
        "deviceTypeId": "deviceType001",  // Required device type
        "deviceId": "device123",  // Assigned device (null when PENDING)
        "workerId": {
          "_id": "user456",
          "name": "John Worker",
          "username": "worker01"
        },
        "status": "PENDING",
        "priority": "MEDIUM",
        "estimatedDuration": 30,  // minutes
        "actualDuration": null,
        "pausedDuration": 0,
        "startedAt": null,
        "completedAt": null,
        "progress": 0,  // 0-100
        "notes": "",
        "qualityData": null,
        "createdAt": "2025-10-27T10:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 10.2 Get Task by ID

```
GET /api/tasks/:id
Authorization: Bearer <token>
```

**Response 200**: Single task with populated project and workerId

---

### 10.3 Create Task

```
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "title": "Weld joints - Batch #100", // Required
  "description": "Weld steel frame joints", // Optional
  "projectId": "proj123", // Required
  "recipeId": "recipe123", // Required (must exist in project)
  "productId": "prod123", // Optional (if task is product-specific)
  "recipeStepId": "step002", // Required (step ObjectId from project snapshot)
  "deviceId": null, // Optional, null when PENDING
  "workerId": "user456", // Optional
  "status": "PENDING", // Optional, default: "PENDING"
  "priority": "MEDIUM", // Optional, default: "MEDIUM"
  "estimatedDuration": 45, // Optional (auto-extracted from step)
  "notes": "Handle with care", // Optional
  "qualityData": {} // Optional
}
```

**Backend Actions**:

1. Validates project, recipe, and step exist
2. **Automatically extracts** `deviceTypeId` from recipe step in project snapshot
3. Validates step exists in recipe snapshot
4. Sets `estimatedDuration` from step if not provided

**Validation Rules**:

- `deviceId` optional when `status = PENDING`
- `deviceId` **required** when `status = ONGOING` or `COMPLETED`
- `workerId` **required** when `status = ONGOING` or `COMPLETED`
- Device must match required `deviceTypeId` (validated by model)

**Response 201**: Created task with extracted `deviceTypeId`

---

### 10.4 Update Task Status

```
POST /api/tasks/:id/status
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "status": "ONGOING", // Optional
  "notes": "Started work", // Optional
  "startTime": "2025-10-27T11:00:00Z", // Optional
  "endTime": null, // Optional
  "progress": 25 // Optional, 0-100
}
```

**Backend Actions**:

- Auto-sets `startedAt` when status → ONGOING
- Auto-sets `completedAt` when status → COMPLETED
- Auto-calculates `actualDuration` from start/end times

**Response 200**: Updated task object

---

### 10.5 Complete Task

```
POST /api/tasks/:id/complete
Authorization: Bearer <token>
Content-Type: application/json
```

**Purpose**: Complete task and automatically create next task

**Request Body**:

```json
{
  "workerId": "user456",  // Required (if not already set)
  "notes": "Completed successfully",  // Optional
  "qualityData": {  // Optional
    "passedChecks": true,
    "measurements": { ... }
  },
  "actualDuration": 42  // Optional (auto-calculated if not provided)
}
```

**Backend Actions**:

1. Marks current task as COMPLETED (100% progress)
2. Sets `completedAt` timestamp
3. Finds next step in recipe (by `order` field)
4. If next step exists:
   - **Extracts `deviceTypeId`** from next step
   - Creates new PENDING task for next step
   - Returns both completed task and new task
5. If no next step (last step):
   - Increments `project.recipes[].producedQuantity`
   - Recalculates project `progress`

**Response 200**:

```json
{
  "success": true,
  "message": "Task completed and next task created",
  "data": {
    "completedTask": { ... },
    "nextTask": {
      "_id": "task124",
      "title": "Quality check - Order #1234",
      "recipeStepId": "step003",
      "deviceTypeId": "deviceType002",  // Extracted from next step
      "status": "PENDING"
    },
    "isLastStep": false,
    "project": {
      "_id": "proj123",
      "progress": 35  // Updated progress
    }
  }
}
```

**Response 200** (last step):

```json
{
  "success": true,
  "message": "Task completed and recipe execution finished",
  "data": {
    "completedTask": { ... },
    "nextTask": null,
    "isLastStep": true,
    "project": {
      "_id": "proj123",
      "progress": 100
    }
  }
}
```

---

### 10.6 Delete Task

```
DELETE /api/tasks/:id
Authorization: Bearer <admin_token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

## 11. Task Media

**Auth Required**: Yes  
**Purpose**: Upload documentation for tasks (photos, videos, PDFs)

### 11.1 Upload Media to Task

```
POST /api/tasks/:taskId/media
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body** (FormData):

- `file` (File) - Required
- `description` (string) - Optional

**Response 201**:

```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "_id": "media123",
    "taskId": "task123",
    "filename": "1730025600000-photo.jpg",
    "originalName": "work-photo.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 1048576,
    "filePath": "/uploads/task-media/1730025600000-photo.jpg",
    "description": "Progress photo",
    "uploadedAt": "2025-10-27T11:00:00Z"
  }
}
```

---

### 11.2 Get Task Media

```
GET /api/tasks/:taskId/media
Authorization: Bearer <token>
```

**Response 200**: Array of media objects

---

### 11.3 Delete Task Media

```
DELETE /api/task-media/:id
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

---

## 12. Alerts

**Auth Required**: Yes

### 12.1 List Alerts

```
GET /api/alerts?type=ERROR&severity=high&isRead=false
Authorization: Bearer <token>
```

**Query Parameters**:

- `type` (string) - "INFO" | "WARNING" | "ERROR" | "EMERGENCY"
- `severity` (string) - "low" | "medium" | "high" | "critical"
- `isRead` (boolean) - Filter by read status
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**: Paginated alerts

---

### 12.2 Get Alert by ID

```
GET /api/alerts/:id
Authorization: Bearer <token>
```

**Response 200**: Single alert object

---

### 12.3 Create Alert

```
POST /api/alerts
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "type": "WARNING", // Required
  "message": "Device temperature high", // Required
  "severity": "medium", // Optional, default: "medium"
  "relatedEntity": {
    // Optional
    "entityType": "Device",
    "entityId": "device123"
  },
  "metadata": {
    // Optional
    "temperature": 85,
    "threshold": 80
  }
}
```

**Response 201**: Created alert

---

### 12.4 Acknowledge Alert

```
PUT /api/alerts/:id/acknowledge
Authorization: Bearer <token>
```

**Backend Actions**:

- Sets `isRead: true`
- Records `acknowledgedBy` (user ID)
- Sets `acknowledgedAt` timestamp

**Response 200**: Updated alert

---

### 12.5 Delete Alert

```
DELETE /api/alerts/:id
Authorization: Bearer <admin_token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

---

## 13. KPI (Key Performance Indicators)

**Auth Required**: Yes

### 13.1 Get Real-time KPI

```
GET /api/kpi/realtime
Authorization: Bearer <token>
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "onTimeRate": 92.5, // Percentage
    "defectRate": 2.1, // Percentage
    "productivity": 87.3, // Percentage
    "equipmentUptime": 95.8, // Percentage
    "activeProjects": 5,
    "completedTasks": 142,
    "pendingTasks": 23,
    "emergencyAlerts": 2,
    "trends": {
      "last24Hours": [
        {
          "timestamp": "2025-10-27T10:00:00Z",
          "onTimeRate": 91.2,
          "defectRate": 2.3,
          "productivity": 86.1,
          "equipmentUptime": 94.5
        }
        // ... hourly data points
      ]
    }
  }
}
```

---

### 13.2 Create KPI Data

```
POST /api/kpi
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "metricName": "onTimeRate", // Required
  "value": 93.5, // Required
  "unit": "%", // Optional
  "metadata": {
    // Optional
    "calculationMethod": "completed_on_time / total_completed"
  }
}
```

**Response 201**: Created KPI data point

---

## 14. Reports

**Auth Required**: Yes

### 14.1 Generate Report

```
POST /api/reports/generate
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "reportType": "PROJECT_SUMMARY", // Required
  "format": "PDF", // Required: "PDF" | "EXCEL" | "CSV" | "JSON"
  "parameters": {
    // Optional
    "projectId": "proj123",
    "startDate": "2025-10-01",
    "endDate": "2025-10-31"
  }
}
```

**Backend Actions**:

1. Creates report record with `status: "PENDING"`
2. Queues report generation job
3. Returns immediately (async process)

**Response 201**:

```json
{
  "success": true,
  "message": "Report generation started",
  "data": {
    "_id": "report123",
    "reportType": "PROJECT_SUMMARY",
    "format": "PDF",
    "status": "PENDING",
    "createdAt": "2025-10-27T11:00:00Z",
    "expiresAt": "2025-11-03T11:00:00Z" // 7 days
  }
}
```

---

### 14.2 List Reports

```
GET /api/reports?status=COMPLETED&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters**:

- `status` (string) - "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
- `page` (number, default: 1)
- `limit` (number, default: 10)

**Response 200**: Paginated reports

---

### 14.3 Download Report

```
GET /api/reports/download/:id
Authorization: Bearer <token>
```

**Response 200** (file download):

- Content-Type: `application/pdf` | `application/vnd.ms-excel` | `text/csv` | `application/json`
- Content-Disposition: `attachment; filename="report-123.pdf"`
- Increments `downloadCount`

**Error 404** (not ready):

```json
{
  "success": false,
  "message": "Report not found or not ready"
}
```

---

### 14.4 Delete Report

```
DELETE /api/reports/:id
Authorization: Bearer <admin_token>
```

**Response 200**:

```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

---

## Common Patterns

### Pagination

All list endpoints support pagination:

```
?page=2&limit=20
```

Response includes:

```json
{
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

### Search

Text search across multiple fields:

```
?search=steel
```

Searches in relevant fields (name, description, codes, etc.)

---

### Filtering

Most list endpoints support field-specific filters:

```
?status=ACTIVE&priority=HIGH&type=ERROR
```

---

### Population

Related documents are automatically populated where relevant:

- User references show `name`, `username`
- Project references show `name`, `status`
- Device references show `name`, `status`

---

### Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

**Common Error Codes**:

- `VALIDATION_ERROR` (400) - Invalid input
- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Duplicate or constraint violation
- `INTERNAL_SERVER_ERROR` (500) - Server error

---

## Important Concepts

### 1. Snapshot Architecture

Projects create **immutable snapshots** of:

- Products (full data)
- Recipes (with steps, media, raw materials)
- Raw Materials (specifications)

**Why?**

- Recipe changes don't affect active projects
- Complete audit trail
- Traceability for manufacturing compliance

---

### 2. Device Type System

**Hierarchy**: DeviceType → Device → Task

- **DeviceType**: Category (e.g., "CNC Machine")
- **Device**: Physical machine (e.g., "CNC-A-001")
- **Recipe Steps**: Require DeviceType (flexible)
- **Tasks**: Require DeviceType, optionally assign Device

**Workflow**:

1. Recipe step specifies: "Need a CNC Machine"
2. Task inherits: `deviceTypeId`
3. Worker starts task: Selects from available CNC machines
4. Task validation: Ensures selected device matches type

---

### 3. Task Lifecycle

```
PENDING → ONGOING → COMPLETED
         ↓
       PAUSED
         ↓
       ONGOING
```

**Rules**:

- PENDING: `deviceId` and `workerId` optional
- ONGOING: `deviceId` and `workerId` **required**
- COMPLETED: `deviceId` and `workerId` **required**

---

### 4. Auto-Generated IDs

MongoDB auto-generates `_id` (ObjectId) for:

- Recipe steps (`steps[]._id`)
- Recipe media (`steps[].media[]._id`)
- All collection documents

**Never manually create these IDs** - let MongoDB generate them.

---

### 5. Cascade Prevention

These models prevent deletion if referenced:

- **DeviceType**: Cannot delete if used by devices, recipes, or tasks
- **RawMaterial**: Cannot delete if used in recipes
- **Recipe**: Cannot delete if used in projects
- **Product**: Cannot delete if used in projects
- **Device**: Cannot delete if used in recipe steps

---

## Testing Examples

### 1. Complete User Registration → Task Completion Flow

```bash
# 1. Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"worker01","password":"pass123","name":"John","role":"worker"}'

# 2. Login
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"worker01","password":"pass123"}' \
  | jq -r '.data.accessToken')

# 3. Get assigned tasks
curl http://localhost:3001/api/tasks?workerId=<userId>&status=PENDING \
  -H "Authorization: Bearer $TOKEN"

# 4. Start task (change to ONGOING)
curl -X POST http://localhost:3001/api/tasks/<taskId>/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ONGOING","deviceId":"<deviceId>"}'

# 5. Complete task (auto-creates next)
curl -X POST http://localhost:3001/api/tasks/<taskId>/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workerId":"<userId>","notes":"Done"}'
```

---

### 2. Create Recipe with Raw Materials

```bash
# 1. Create device type
DEVICE_TYPE_ID=$(curl -X POST http://localhost:3001/api/device-types \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"CNC Machine","description":"Cutting machine"}' \
  | jq -r '.data._id')

# 2. Create raw material
MAT_ID=$(curl -X POST http://localhost:3001/api/raw-materials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"materialCode":"STEEL-001","name":"Steel Bar"}' \
  | jq -r '.data._id')

# 3. Create recipe
curl -X POST http://localhost:3001/api/recipes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Frame Assembly\",\"rawMaterials\":[{\"materialId\":\"$MAT_ID\",\"quantityRequired\":5}],\"steps\":[{\"name\":\"Cut\",\"description\":\"Cut steel\",\"estimatedDuration\":30,\"deviceTypeId\":\"$DEVICE_TYPE_ID\"}]}"
```

---

### 3. Create Project with Snapshots

```bash
# Assumes recipe and product exist

curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Order #1234","products":["<productId>"],"recipes":[{"recipeId":"<recipeId>","targetQuantity":10}]}'

# Backend automatically creates immutable snapshots
```

---

## Environment Variables

Required in `.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/smartfactory
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-secret-here
REFRESH_TOKEN_EXPIRES_IN=7d
MQTT_BROKER_URL=mqtt://localhost:1883
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

---

## Summary

**Total Endpoints**: 80+

**Key Features**:

- ✅ Complete CRUD for all resources
- ✅ Snapshot-based immutability for projects
- ✅ Device type categorization for flexible task assignment
- ✅ Raw material tracking with cascade prevention
- ✅ Auto-generated ObjectIds for subdocuments
- ✅ Comprehensive validation and error handling
- ✅ Role-based access control
- ✅ File uploads for media
- ✅ Real-time KPI tracking
- ✅ Async report generation

---

**Last Updated**: October 27, 2025  
**Version**: 2.0 (Post-DeviceType Implementation)
