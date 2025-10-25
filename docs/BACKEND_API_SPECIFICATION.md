# Backend API Specification for Manufacturing Process Monitoring System

This document provides **complete technical specifications** for the backend developer to implement the API that integrates with this frontend application.

## 📋 **Table of Contents**

1. [Environment Configuration](#environment-configuration)
2. [API Base Structure](#api-base-structure)
3. [Authentication System](#authentication-system)
4. [Data Models & Types](#data-models--types)
5. [Complete API Endpoints](#complete-api-endpoints)
6. [Real-time Integration](#real-time-integration)
7. [File Upload Handling](#file-upload-handling)
8. [Error Handling](#error-handling)
9. [Security Requirements](#security-requirements)
10. [Database Schema Guide](#database-schema-guide)

---

## 🌐 **Environment Configuration**

### Frontend Environment Variables

```env
# .env.local (Frontend configuration)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NODE_ENV=development
```

### Backend Requirements

- **API Base URL**: `http://localhost:3001/api` (configurable)
- **WebSocket URL**: `ws://localhost:3001` (for real-time updates)
- **CORS Origins**: `http://localhost:3000`, `http://localhost:3001`
- **Content-Type**: `application/json` (default)
- **Multipart Support**: Required for file uploads

---

## 🏗 **API Base Structure**

### Standard Response Format

**ALL API responses must follow this exact structure:**

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Success Response Example
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Operation completed successfully"
}

// Error Response Example
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid username or password"
}
```

### Pagination Format

```typescript
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

---

## 🔐 **Authentication System**

### Login Request/Response

```typescript
// Frontend sends this exact structure
interface LoginRequest {
  idOrusername: string; // Admin ID (e.g., "admin001") OR Worker Employee Number (e.g., "EMP001")
  password: string; // Password
}

// Backend must return this exact structure
interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

interface User {
  id: string;
  username?: string; // Employee number (for workers only)
  name: string;
  role: "admin" | "worker";
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

interface AuthTokens {
  accessToken: string; // JWT access token (expires in 15 minutes)
  refreshToken: string; // JWT refresh token (expires in 7 days)
}
```

### Authentication Headers

```http
Authorization: Bearer <accessToken>
Idempotency-Key: <uuid-v4>  # For POST/PUT/PATCH/DELETE requests
```

### JWT Token Structure

```typescript
// Access Token Payload
{
  "sub": "user-id",
  "role": "admin" | "worker",
  "username": "EMP001",  // For workers only
  "iat": 1696636800,
  "exp": 1696637700   // 15 minutes from issued
}

// Refresh Token Payload
{
  "sub": "user-id",
  "type": "refresh",
  "iat": 1696636800,
  "exp": 1697241600   // 7 days from issued
}
```

---

## 📊 **Data Models & Types**

### Core Entities

#### User Model

```typescript
interface User {
  id: string; // Primary key
  username?: string; // Employee number (workers only, e.g., "EMP001")
  name: string; // Full name
  role: "admin" | "worker"; // User role
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

#### Project Model

```typescript
interface Project {
  id: string; // Primary key
  name: string; // Project name
  recipeId: string; // Foreign key to Recipe
  recipe?: Recipe; // Optional populated recipe
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadline: string; // ISO 8601 date
  createdBy: string; // User ID
  assignedDevices: string[]; // Array of device IDs
  progress: number; // 0-100 percentage
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

#### Recipe Model

```typescript
interface Recipe {
  id: string; // Primary key
  productCode: string; // Product identifier
  version: number; // Recipe version
  name: string; // Recipe name
  description?: string; // Optional description
  steps: RecipeStep[]; // Array of production steps
  estimatedDuration: number; // Duration in minutes
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

interface RecipeStep {
  id: string; // Step identifier
  order: number; // Step sequence (1, 2, 3...)
  name: string; // Step name
  description: string; // Step instructions
  estimatedDuration: number; // Duration in minutes
  requiredDevices: string[]; // Device types required
  qualityChecks: string[]; // Quality control points
}
```

#### Task Model

```typescript
interface Task {
  id: string; // Primary key
  projectId: string; // Foreign key to Project
  project?: Project; // Optional populated project
  recipeStepId: string; // Foreign key to RecipeStep
  recipeStep?: RecipeStep; // Optional populated step
  deviceId: string; // Assigned device/tablet ID
  assignedWorkerId?: string; // Worker user ID (optional)
  assignedWorker?: User; // Optional populated worker
  status: TaskStatus; // Current task status
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startTime?: string; // ISO 8601 timestamp (when started)
  endTime?: string; // ISO 8601 timestamp (when completed)
  pausedDuration: number; // Total paused time in minutes
  notes?: string; // Worker notes
  media: TaskMedia[]; // Attached files/photos
  qualityData?: any; // Quality control data
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

type TaskStatus =
  | "NOT_STARTED" // Initial state
  | "ONGOING" // In progress
  | "PAUSED" // Temporarily stopped
  | "COMPLETED" // Successfully finished
  | "FAILED" // Failed/error state
  | "EMERGENCY"; // Emergency stop

interface TaskMedia {
  id: string; // Media identifier
  type: "image" | "document" | "video";
  filename: string; // Original filename
  url: string; // Download URL
  mimeType: string; // File MIME type
  size: number; // File size in bytes
  uploadedAt: string; // ISO 8601 timestamp
}
```

#### Device Model

```typescript
interface Device {
  id: string; // Primary key (e.g., "TABLET_001")
  name: string; // Display name
  type: "tablet" | "display" | "laptop";
  location: string; // Physical location
  ipAddress?: string; // Network IP
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  currentTaskId?: string; // Active task ID
  lastSeen: string; // ISO 8601 timestamp
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

#### Alert Model

```typescript
interface Alert {
  id: string; // Primary key
  type: "EMERGENCY" | "WARNING" | "INFO" | "SYSTEM";
  title: string; // Alert title
  message: string; // Alert description
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  source: string; // Source (taskId, deviceId, etc.)
  sourceType: "task" | "device" | "system" | "user";
  isRead: boolean; // Read status
  acknowledgedBy?: string; // User ID who acknowledged
  acknowledgedAt?: string; // ISO 8601 timestamp
  expiresAt?: string; // ISO 8601 timestamp (optional)
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

#### KPI Data Model

```typescript
interface KPIData {
  timestamp: string; // ISO 8601 timestamp
  onTimeRate: number; // Percentage (0-100)
  defectRate: number; // Percentage (0-100)
  productivity: number; // Percentage (0-100)
  equipmentUptime: number; // Percentage (0-100)
  activeProjects: number; // Count
  completedTasks: number; // Count
  pendingTasks: number; // Count
  emergencyAlerts: number; // Count
  trends: {
    onTimeRate: number[]; // Last 24 hours data
    defectRate: number[]; // Last 24 hours data
    productivity: number[]; // Last 24 hours data
    uptime: number[]; // Last 24 hours data
  };
}
```

---

## 🛠 **Complete API Endpoints**

### 1. Authentication Endpoints

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "idOrusername": "admin001",  // or "EMP001" for workers
  "password": "password123"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "John Admin",
      "role": "admin",
      "createdAt": "2025-10-06T10:00:00Z",
      "updatedAt": "2025-10-06T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

#### Token Refresh

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response: 200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Logout

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2. Users Endpoints

#### Get Workers List

```http
GET /api/users?role=worker
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "worker-1",
      "username": "EMP001",
      "name": "Worker One",
      "role": "worker",
      "createdAt": "2025-10-06T10:00:00Z",
      "updatedAt": "2025-10-06T10:00:00Z"
    }
  ]
}
```

#### Get Users (Paginated)

```http
GET /api/users?page=1&limit=10&role=admin
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": {
    "items": [...],
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

#### Create User

```http
POST /api/users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "username": "EMP002",        // Required for workers
  "name": "New Worker",
  "role": "worker",
  "password": "temp123"     // Initial password
}
```

### 3. Projects Endpoints

#### Get Projects

```http
GET /api/projects?page=1&limit=10&status=ACTIVE
Authorization: Bearer <accessToken>

Response: 200 OK (Paginated)
```

#### Create Project

```http
POST /api/projects
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Assembly Line Production",
  "recipeId": "recipe-uuid",
  "deadline": "2025-10-15T23:59:59Z",
  "priority": "HIGH",
  "assignedDevices": ["TABLET_001", "TABLET_002"]
}
```

#### Update Project

```http
PUT /api/projects/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Updated Project Name",
  "status": "COMPLETED",
  "progress": 100
}
```

#### Delete Project

```http
DELETE /api/projects/:id
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### 4. Tasks Endpoints

#### Get All Tasks

```http
GET /api/tasks?status=ONGOING&page=1&limit=20
Authorization: Bearer <accessToken>

Query Parameters:
- status: TaskStatus (optional)
- deviceId: string (optional)
- projectId: string (optional)
- assignedWorkerId: string (optional)
- page: number (default: 1)
- limit: number (default: 10)
```

#### Get Device Tasks

```http
GET /api/tasks/my/:deviceId
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "task-uuid",
      "projectId": "project-uuid",
      "project": { /* populated project */ },
      "recipeStepId": "step-uuid",
      "recipeStep": { /* populated step */ },
      "deviceId": "TABLET_001",
      "status": "NOT_STARTED",
      "priority": "HIGH",
      "notes": null,
      "media": [],
      "createdAt": "2025-10-06T10:00:00Z",
      "updatedAt": "2025-10-06T10:00:00Z"
    }
  ]
}
```

#### Update Task Status

```http
POST /api/tasks/:id/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "ONGOING",
  "notes": "Started production process",
  "startTime": "2025-10-06T10:00:00Z",
  "data": {
    "reason": "Material ready"  // For PAUSED status
  }
}

Response: 200 OK
{
  "success": true,
  "data": { /* updated task */ }
}
```

#### Upload Task Media

```http
POST /api/tasks/:id/media
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Form Data:
- file: File (image/document)
- type: 'image' | 'document' | 'video'
- description: string (optional)

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "media-uuid",
    "type": "image",
    "filename": "photo.jpg",
    "url": "/uploads/task-media/photo.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000,
    "uploadedAt": "2025-10-06T10:00:00Z"
  }
}
```

### 5. KPI Endpoints

#### Get Real-time KPI

```http
GET /api/kpi/realtime
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": {
    "timestamp": "2025-10-06T10:00:00Z",
    "onTimeRate": 85.5,
    "defectRate": 2.1,
    "productivity": 92.3,
    "equipmentUptime": 98.7,
    "activeProjects": 5,
    "completedTasks": 127,
    "pendingTasks": 23,
    "emergencyAlerts": 1,
    "trends": {
      "onTimeRate": [85, 86, 85, 87, 85.5],
      "defectRate": [2.5, 2.3, 2.1, 2.0, 2.1],
      "productivity": [91, 92, 93, 92, 92.3],
      "uptime": [98, 99, 98.5, 98.7, 98.7]
    }
  }
}
```

### 6. Devices Endpoints

#### Get Devices

```http
GET /api/devices?status=ONLINE
Authorization: Bearer <accessToken>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "TABLET_001",
      "name": "Production Line 1 Tablet",
      "type": "tablet",
      "location": "Assembly Line 1",
      "ipAddress": "192.168.1.101",
      "status": "ONLINE",
      "currentTaskId": "task-uuid",
      "lastSeen": "2025-10-06T10:00:00Z",
      "createdAt": "2025-10-06T09:00:00Z",
      "updatedAt": "2025-10-06T10:00:00Z"
    }
  ]
}
```

#### Register Device

```http
POST /api/devices/register
Content-Type: application/json

{
  "id": "TABLET_003",
  "name": "Line 3 Tablet",
  "type": "tablet",
  "location": "Assembly Line 3",
  "ipAddress": "192.168.1.103"
}
```

### 7. Alerts Endpoints

#### Get Alerts

```http
GET /api/alerts?isRead=false&type=EMERGENCY
Authorization: Bearer <accessToken>

Response: 200 OK (Paginated)
```

#### Create Alert

```http
POST /api/alerts
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "type": "EMERGENCY",
  "title": "Equipment Malfunction",
  "message": "Production line 2 has stopped working",
  "severity": "CRITICAL",
  "source": "TABLET_002",
  "sourceType": "device"
}
```

#### Acknowledge Alert

```http
PUT /api/alerts/:id/acknowledge
Authorization: Bearer <accessToken>

Response: 200 OK
```

### 8. Reports Endpoints

#### Generate Report

```http
POST /api/reports/generate
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "type": "PROJECT_SUMMARY",
  "format": "PDF",
  "filters": {
    "projectId": "project-uuid",
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-06T23:59:59Z"
  }
}

Response: 200 OK
{
  "success": true,
  "data": {
    "reportId": "report-uuid",
    "downloadUrl": "/reports/download/report-uuid.pdf",
    "expiresAt": "2025-10-07T10:00:00Z"
  }
}
```

---

## 🔄 **Real-time Integration**

### Server-Sent Events (SSE)

```http
GET /api/events/stream
Authorization: Bearer <accessToken>
Accept: text/event-stream

Events to Send:
- task_updated: When task status changes
- alert_created: New alert created
- kpi_updated: KPI data updated
- device_status: Device online/offline
- project_updated: Project changes
```

#### Event Format

```javascript
// SSE Event Format
data: {
  "type": "task_updated",
  "data": {
    "taskId": "task-uuid",
    "status": "ONGOING",
    "deviceId": "TABLET_001",
    "timestamp": "2025-10-06T10:00:00Z"
  }
}

data: {
  "type": "alert_created",
  "data": {
    "id": "alert-uuid",
    "type": "EMERGENCY",
    "title": "Equipment Failure",
    "severity": "CRITICAL"
  }
}
```

### WebSocket Alternative

```javascript
// WebSocket connection
ws://localhost:3001

// Message format (same as SSE data)
{
  "type": "task_updated",
  "data": { /* event data */ }
}
```

---

## 📁 **File Upload Handling**

### Media Upload Requirements

- **Supported Types**: Images (JPEG, PNG, WEBP), Documents (PDF, DOC, DOCX), Videos (MP4, WEBM)
- **Max File Size**: 50MB per file
- **Storage**: Local filesystem or cloud storage (S3, etc.)
- **Security**: MIME type validation, file extension verification
- **Processing**: Automatic EXIF removal for images

### Upload Response

```typescript
interface UploadResponse {
  id: string; // Media ID
  filename: string; // Original filename
  url: string; // Download URL
  mimeType: string; // File MIME type
  size: number; // File size in bytes
  uploadedAt: string; // ISO 8601 timestamp
}
```

---

## 🚨 **Error Handling**

### Standard Error Codes

```typescript
// HTTP Status Codes with Error Messages
400: "BAD_REQUEST" | "VALIDATION_ERROR" | "INVALID_DATA"
401: "UNAUTHORIZED" | "INVALID_TOKEN" | "TOKEN_EXPIRED"
403: "FORBIDDEN" | "INSUFFICIENT_PERMISSIONS"
404: "NOT_FOUND" | "RESOURCE_NOT_FOUND"
409: "CONFLICT" | "DUPLICATE_ENTRY"
422: "UNPROCESSABLE_ENTITY" | "VALIDATION_FAILED"
500: "INTERNAL_SERVER_ERROR" | "DATABASE_ERROR"
503: "SERVICE_UNAVAILABLE" | "MAINTENANCE_MODE"
```

### Error Response Format

```typescript
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid task status transition",
  "details": {
    "field": "status",
    "currentValue": "COMPLETED",
    "attemptedValue": "ONGOING"
  }
}
```

---

## 🔐 **Security Requirements**

### Authentication & Authorization

- **JWT Secret**: Use strong secret key for token signing
- **Token Expiry**: Access tokens expire in 15 minutes
- **Refresh Tokens**: Valid for 7 days, stored securely
- **Role Validation**: Verify user roles for protected endpoints
- **Rate Limiting**: Implement login attempt limits

### CORS Configuration

```javascript
// Required CORS settings
{
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://192.168.56.1:3000',
    'http://192.168.56.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
}
```

### Input Validation

- **Sanitize Inputs**: Prevent SQL injection, XSS
- **Validate Types**: Ensure data types match expectations
- **Check Permissions**: Verify user can access/modify resources
- **Idempotency**: Use idempotency keys for duplicate prevention

---

## 🗄 **Database Schema Guide**

### Recommended Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_no VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  status project_status DEFAULT 'PLANNING',
  priority priority_level DEFAULT 'MEDIUM',
  deadline TIMESTAMP,
  created_by UUID REFERENCES users(id),
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  recipe_step_id UUID REFERENCES recipe_steps(id),
  device_id VARCHAR(50) NOT NULL,
  assigned_worker_id UUID REFERENCES users(id),
  status task_status DEFAULT 'NOT_STARTED',
  priority priority_level DEFAULT 'MEDIUM',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  paused_duration INTEGER DEFAULT 0,
  notes TEXT,
  quality_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'worker');
CREATE TYPE project_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE task_status AS ENUM ('NOT_STARTED', 'ONGOING', 'PAUSED', 'COMPLETED', 'FAILED', 'EMERGENCY');
CREATE TYPE priority_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
```

---

## 🧪 **Testing & Validation**

### Test the Integration

1. **Start your backend** with the endpoints above
2. **Update frontend** `.env.local` with your backend URL
3. **Test connectivity** at: http://localhost:3001/api-test
4. **Verify authentication** via login page
5. **Test real-time updates** via SSE/WebSocket

### Health Check Endpoint

```http
GET /health
Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2025-10-06T10:00:00Z",
  "version": "1.0.0"
}
```

---

## 🎯 **Implementation Priority**

### Phase 1 (Critical)

1. ✅ Authentication endpoints (`/auth/*`)
2. ✅ Users endpoints (`/users/*`)
3. ✅ Basic task endpoints (`/tasks/*`)
4. ✅ Device registration (`/devices/*`)

### Phase 2 (Important)

1. ✅ Projects management (`/projects/*`)
2. ✅ KPI real-time data (`/kpi/*`)
3. ✅ Alerts system (`/alerts/*`)
4. ✅ File uploads (`/tasks/:id/media`)

### Phase 3 (Enhanced)

1. ✅ Real-time events (SSE/WebSocket)
2. ✅ Reports generation (`/reports/*`)
3. ✅ Advanced filtering and search
4. ✅ Offline sync support

---

This specification provides **everything needed** for the backend developer to implement a fully compatible API for the manufacturing process monitoring frontend. The frontend is ready to integrate immediately once these endpoints are implemented! 🚀
