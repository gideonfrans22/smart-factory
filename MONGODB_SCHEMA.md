# 🗄️ MongoDB Schema - Manufacturing Process Monitoring System

## 📋 **Schema Overview**

This document describes the MongoDB collections and their schemas, converted from the PostgreSQL database schema to MongoDB using Mongoose ODM.

---

## 🏗️ **Collections**

### **1. Users Collection**

Stores user accounts (admins and workers).

```typescript
{
  _id: ObjectId,
  empNo: String (optional, unique),      // Employee number for workers
  name: String (required),               // Full name
  email: String (optional, unique),      // Email address
  password: String (required),           // Hashed password
  role: String (required),               // 'admin' | 'worker'
  isActive: Boolean (default: true),     // Account status
  lastLoginAt: Date,                     // Last login timestamp
  failedLoginAttempts: Number (default: 0),
  lockedUntil: Date,                     // Account lock expiration
  createdAt: Date,                       // Auto-generated
  updatedAt: Date                        // Auto-generated
}
```

**Indexes:**

- `empNo` (unique, sparse)
- `email` (unique, sparse)
- `role`
- `isActive`

---

### **2. Projects Collection**

Stores manufacturing projects.

```typescript
{
  _id: ObjectId,
  name: String (required),               // Project name
  description: String,                   // Project description
  status: String (required),             // 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  priority: String (required),           // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  startDate: Date (required),            // Project start date
  endDate: Date (required),              // Project end date
  progress: Number (0-100),              // Completion percentage
  createdBy: ObjectId (ref: User),       // Creator user ID
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `status`
- `priority`
- `startDate, endDate`
- `createdBy`

---

### **3. Devices Collection**

Stores device/tablet information.

```typescript
{
  _id: String,                           // Custom ID like 'DEVICE_001'
  name: String (required),               // Device name
  type: String (required),               // Device type (TABLET, WORKSTATION, etc.)
  location: String,                      // Physical location
  status: String (required),             // 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  ipAddress: String,                     // Network IP address
  lastHeartbeat: Date,                   // Last connection timestamp
  config: Object (default: {}),          // Device-specific configuration
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `status`
- `type`
- `location`
- `lastHeartbeat`

---

### **4. Tasks Collection**

Stores work tasks assigned to devices and workers.

```typescript
{
  _id: ObjectId,
  title: String (required),              // Task title
  description: String,                   // Task description
  projectId: ObjectId (ref: Project),    // Associated project
  deviceId: String (ref: Device),        // Assigned device
  assignedTo: ObjectId (ref: User),      // Assigned worker
  status: String (required),             // 'PENDING' | 'ONGOING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  priority: String (required),           // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  estimatedDuration: Number,             // Estimated time in minutes
  actualDuration: Number,                // Actual time in minutes
  startedAt: Date,                       // Task start timestamp
  completedAt: Date,                     // Task completion timestamp
  progress: Number (0-100),              // Task progress percentage
  notes: String,                         // Additional notes
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `projectId`
- `deviceId`
- `assignedTo`
- `status`
- `priority`
- `startedAt, completedAt`

---

### **5. TaskMedia Collection**

Stores files/media attached to tasks.

```typescript
{
  _id: ObjectId,
  taskId: ObjectId (ref: Task),          // Associated task
  filename: String (required),           // Stored filename
  originalName: String (required),       // Original filename
  mimeType: String (required),           // File MIME type
  fileSize: Number (required),           // File size in bytes
  filePath: String (required),           // Storage path
  uploadedBy: ObjectId (ref: User),      // Uploader user ID
  uploadType: String (required),         // 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'AUDIO'
  createdAt: Date
}
```

**Indexes:**

- `taskId`
- `uploadType`
- `uploadedBy`

---

### **6. Alerts Collection**

Stores system alerts and notifications.

```typescript
{
  _id: ObjectId,
  type: String (required),               // 'INFO' | 'WARNING' | 'ERROR' | 'EMERGENCY'
  level: String (required),              // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: String (required),              // Alert title
  message: String (required),            // Alert message
  source: String,                        // Alert source (e.g., 'SYSTEM', 'DEVICE_001')
  relatedEntityType: String,             // Entity type ('TASK', 'PROJECT', 'DEVICE')
  relatedEntityId: String,               // Entity ID
  status: String (required),             // 'UNREAD' | 'READ' | 'ACKNOWLEDGED' | 'RESOLVED'
  acknowledgedBy: ObjectId (ref: User),  // User who acknowledged
  acknowledgedAt: Date,                  // Acknowledgment timestamp
  resolvedAt: Date,                      // Resolution timestamp
  metadata: Object (default: {}),        // Additional data
  createdAt: Date
}
```

**Indexes:**

- `type`
- `level`
- `status`
- `source`
- `relatedEntityType, relatedEntityId`
- `createdAt` (descending)

---

### **7. EmergencyReports Collection**

Stores emergency incident reports.

```typescript
{
  _id: ObjectId,
  deviceId: String (ref: Device),        // Reporting device
  reportedBy: ObjectId (ref: User),      // Reporter user ID
  type: String (required),               // Report type
  severity: String (required),           // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: String (required),              // Report title
  description: String (required),        // Detailed description
  location: String,                      // Incident location
  status: String (required),             // 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED'
  assignedTo: ObjectId (ref: User),      // Assigned investigator
  resolvedBy: ObjectId (ref: User),      // Resolver user ID
  resolvedAt: Date,                      // Resolution timestamp
  resolutionNotes: String,               // Resolution details
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `deviceId`
- `reportedBy`
- `status`
- `severity`
- `createdAt` (descending)

---

### **8. KPIData Collection**

Stores Key Performance Indicator metrics.

```typescript
{
  _id: ObjectId,
  metricName: String (required),         // Metric name
  metricValue: Number (required),        // Metric value
  unit: String,                          // Unit of measurement
  deviceId: String (ref: Device),        // Associated device
  projectId: ObjectId (ref: Project),    // Associated project
  recordedAt: Date (required),           // Measurement timestamp
  metadata: Object (default: {}),        // Additional metric data
  createdAt: Date
}
```

**Indexes:**

- `metricName`
- `recordedAt` (descending)
- `deviceId`
- `projectId`
- `metricName, recordedAt` (compound, descending)

---

### **9. Reports Collection**

Stores generated reports.

```typescript
{
  _id: ObjectId,
  title: String (required),              // Report title
  type: String (required),               // 'PRODUCTION' | 'QUALITY' | 'MAINTENANCE' | 'EFFICIENCY'
  format: String (required),             // 'PDF' | 'EXCEL' | 'CSV' | 'JSON'
  parameters: Object (default: {}),      // Report generation parameters
  filePath: String,                      // Storage path
  fileSize: Number,                      // File size in bytes
  status: String (required),             // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  generatedBy: ObjectId (ref: User),     // Generator user ID
  generatedAt: Date,                     // Generation timestamp
  expiresAt: Date,                       // Expiration timestamp
  downloadCount: Number (default: 0),    // Download counter
  errorMessage: String,                  // Error details if failed
  createdAt: Date
}
```

**Indexes:**

- `type`
- `status`
- `generatedBy`
- `createdAt` (descending)

---

### **10. ActivityLogs Collection**

Stores user activity logs for audit trail.

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),          // User who performed action
  action: String (required),             // Action performed
  resourceType: String (required),       // Resource type affected
  resourceId: String,                    // Resource ID
  details: Object (default: {}),         // Action details
  ipAddress: String,                     // User IP address
  userAgent: String,                     // User browser/device
  success: Boolean (default: true),      // Action success status
  errorMessage: String,                  // Error details if failed
  durationMs: Number,                    // Action duration in milliseconds
  createdAt: Date
}
```

**Indexes:**

- `userId`
- `action`
- `resourceType, resourceId`
- `createdAt` (descending)
- `success`

---

### **11. Sessions Collection**

Stores user authentication sessions.

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),          // Session owner
  deviceId: String (ref: Device),        // Device used
  accessTokenHash: String (required),    // Hashed access token
  refreshTokenHash: String (required),   // Hashed refresh token
  ipAddress: String,                     // Connection IP
  userAgent: String,                     // Browser/device info
  expiresAt: Date (required),            // Session expiration
  lastActivity: Date (default: now),     // Last activity timestamp
  isActive: Boolean (default: true),     // Session status
  createdAt: Date
}
```

**Indexes:**

- `userId`
- `deviceId`
- `accessTokenHash, refreshTokenHash`
- `expiresAt` (with TTL for auto-deletion)
- `isActive`

---

## 🔄 **Relationships**

### **One-to-Many:**

- User → Projects (via `createdBy`)
- User → Tasks (via `assignedTo`)
- Project → Tasks (via `projectId`)
- Task → TaskMedia (via `taskId`)
- Device → Tasks (via `deviceId`)

### **One-to-One:**

- User → Sessions (per active session)

---

## 🚀 **Migration from PostgreSQL Differences**

### **Key Changes:**

1. **ObjectId vs UUID**: MongoDB uses ObjectId instead of UUID
2. **Custom IDs**: Device collection uses custom string IDs
3. **No Foreign Key Constraints**: MongoDB uses references instead
4. **Embedded Documents**: `metadata` and `config` stored as embedded objects
5. **TTL Indexes**: Sessions auto-delete when expired
6. **Sparse Indexes**: Used for optional unique fields (empNo, email)

### **MongoDB Advantages:**

- Flexible schema with Mixed types for metadata
- Better performance for read-heavy operations
- Embedded documents reduce joins
- Automatic TTL cleanup for sessions
- Easier horizontal scaling

---

## 📝 **Usage Examples**

### **Creating a User:**

```typescript
const user = new User({
  empNo: "EMP001",
  name: "John Worker",
  email: "john@example.com",
  password: hashedPassword,
  role: "worker"
});
await user.save();
```

### **Querying with Population:**

```typescript
const tasks = await Task.find({ status: "ONGOING" })
  .populate("projectId")
  .populate("assignedTo", "name empNo")
  .populate("deviceId");
```

### **Creating Indexes:**

All indexes are automatically created when the models are first accessed. You can also manually ensure indexes:

```typescript
await User.ensureIndexes();
await Project.ensureIndexes();
// ... for all models
```

---

## 🔧 **Performance Optimization**

1. **Compound Indexes**: Used for common query patterns
2. **TTL Indexes**: Automatic cleanup of expired sessions
3. **Sparse Indexes**: For optional unique fields
4. **Descending Indexes**: For time-based queries (latest first)
5. **Text Indexes**: Can be added for full-text search if needed

---

This MongoDB schema provides a robust foundation for the Manufacturing Process Monitoring System with proper indexing, relationships, and flexibility for future enhancements! 🚀
