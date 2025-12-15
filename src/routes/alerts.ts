import { Router } from "express";
import {
  getAlerts,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  readAlert,
  resolveAlert,
  bulkReadAlerts,
  bulkAcknowledgeAlerts,
  bulkResolveAlerts,
  deleteAlert,
  resolveEmergencyAlert
} from "../controllers/alertController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// ========================================
// ALERT QUERY ENDPOINTS
// ========================================

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts with filtering and pagination
 * @query   type - Filter by alert type: "ERROR" | "WARNING" | "INFO" (optional)
 * @query   severity - Filter by severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" (optional)
 * @query   isRead - Filter by read status: true | false (optional)
 * @query   isAcknowledged - Filter by acknowledged status: true | false (optional)
 * @query   isResolved - Filter by resolved status: true | false (optional)
 * @query   deviceId - Filter by specific device ID (optional)
 * @query   taskId - Filter by specific task ID (optional)
 * @query   projectId - Filter by specific project ID (optional)
 * @query   startDate - Filter alerts from this date (ISO string, optional)
 * @query   endDate - Filter alerts until this date (ISO string, optional)
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Items per page (default: 50)
 * @response Returns array of alert objects with populated device, task, project references
 * @response Each alert includes: id, type, severity, message, source, metadata, timestamps, status flags
 * @access  Private (authenticated users)
 * @note    Results sorted by createdAt descending (newest first)
 * @note    Populates deviceId, taskId, projectId with full objects
 */
router.get("/", authenticateToken, getAlerts);

/**
 * @route   GET /api/alerts/:id
 * @desc    Get single alert by ID with full details
 * @response Returns alert object with populated device, task, project, acknowledgedBy, resolvedBy references
 * @response Includes: id, type, severity, message, source, metadata, all timestamps, status flags
 * @access  Private (authenticated users)
 */
router.get("/:id", authenticateToken, getAlertById);

// ========================================
// ALERT CREATION
// ========================================

/**
 * @route   POST /api/alerts
 * @desc    Create new alert (typically called by devices via MQTT)
 * @body    type - Alert type: "ERROR" | "WARNING" | "INFO" (required)
 * @body    severity - Severity level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" (required)
 * @body    message - Alert message description (required, max 500 chars)
 * @body    source - Alert source identifier (required, max 100 chars)
 * @body    deviceId - Associated device ID (optional)
 * @body    taskId - Associated task ID (optional)
 * @body    projectId - Associated project ID (optional)
 * @body    metadata - Additional data as JSON object (optional)
 * @response Returns created alert object with id and timestamps
 * @access  Private (authenticated users)
 * @note    Sets isRead=false, isAcknowledged=false, isResolved=false by default
 * @note    Automatically sets createdAt timestamp
 */
router.post("/", authenticateToken, createAlert);

// ========================================
// BULK ALERT OPERATIONS
// ========================================

/**
 * @route   POST /api/alerts/bulk-read
 * @desc    Mark multiple alerts as read in one operation
 * @body    alertIds - Array of alert IDs to mark as read (required)
 * @response Returns { modifiedCount, alertIds } with number of updated alerts
 * @access  Private (authenticated users)
 * @note    Sets isRead=true and readAt=now for all specified alerts
 * @note    Ignores invalid alert IDs (no error thrown)
 * @critical Use this for "Mark all as read" feature in UI
 */
router.post("/bulk-read", authenticateToken, bulkReadAlerts);

/**
 * @route   POST /api/alerts/bulk-acknowledge
 * @desc    Acknowledge multiple alerts in one operation
 * @body    alertIds - Array of alert IDs to acknowledge (required)
 * @response Returns { modifiedCount, alertIds } with number of updated alerts
 * @access  Private (authenticated users)
 * @note    Sets isAcknowledged=true, acknowledgedBy=currentUserId, acknowledgedAt=now
 * @note    Acknowledging means user has seen and is handling the alert
 * @critical Use this for batch alert triage workflows
 */
router.post("/bulk-acknowledge", authenticateToken, bulkAcknowledgeAlerts);

/**
 * @route   POST /api/alerts/bulk-resolve
 * @desc    Resolve multiple alerts in one operation
 * @body    alertIds - Array of alert IDs to resolve (required)
 * @response Returns { modifiedCount, alertIds } with number of updated alerts
 * @access  Private (authenticated users)
 * @note    Sets isResolved=true, resolvedBy=currentUserId, resolvedAt=now
 * @note    Resolving means the issue has been fixed/addressed
 * @critical Use this for batch cleanup after fixing multiple issues
 */
router.post("/bulk-resolve", authenticateToken, bulkResolveAlerts);

// ========================================
// SINGLE ALERT STATUS UPDATES
// ========================================

/**
 * @route   PATCH /api/alerts/:id/read
 * @desc    Mark single alert as read
 * @body    NONE - Uses alert ID from URL parameter
 * @response Returns updated alert object with isRead=true and readAt timestamp
 * @access  Private (authenticated users)
 * @note    Sets readAt to current timestamp
 */
router.patch("/:id/read", authenticateToken, readAlert);

/**
 * @route   PATCH /api/alerts/:id/acknowledge
 * @desc    Acknowledge single alert
 * @body    NONE - Uses alert ID from URL parameter and current user from token
 * @response Returns updated alert object with isAcknowledged=true, acknowledgedBy, acknowledgedAt
 * @access  Private (authenticated users)
 * @note    Sets acknowledgedBy to current user ID from JWT token
 * @note    Acknowledging indicates user is aware and handling the alert
 */
router.patch("/:id/acknowledge", authenticateToken, acknowledgeAlert);

/**
 * @route   PATCH /api/alerts/:id/resolve
 * @desc    Resolve single alert
 * @body    NONE - Uses alert ID from URL parameter and current user from token
 * @response Returns updated alert object with isResolved=true, resolvedBy, resolvedAt
 * @access  Private (authenticated users)
 * @note    Sets resolvedBy to current user ID from JWT token
 * @note    Resolving indicates the underlying issue has been fixed
 */
router.patch("/:id/resolve", authenticateToken, resolveAlert);

/**
 * @route   PUT /api/alerts/:id/resolve-emergency
 * @desc    Resolve emergency alert with automatic recovery actions
 * @body    resolvedBy - Name of person resolving (optional)
 * @body    resolutionNotes - Notes about how issue was resolved (optional)
 * @response Returns { alert, actionsPerformed } with details of auto-recovery
 * @access  Private (authenticated users)
 * @note    Only works for EMERGENCY type alerts
 * @note    Automatically restores device from MAINTENANCE to previous status
 * @note    Automatically resumes PAUSED_EMERGENCY tasks to ONGOING
 * @note    Updates alert status to RESOLVED with timestamp
 * @critical Use this endpoint for emergency resolution with cascading recovery
 */
router.put("/:id/resolve-emergency", authenticateToken, resolveEmergencyAlert);

// ========================================
// ALERT DELETION
// ========================================

/**
 * @route   DELETE /api/alerts/:id
 * @desc    Permanently delete alert
 * @response Returns success message
 * @access  Private (admin only)
 * @critical HARD DELETE - Alert will be permanently removed from database
 * @note    Only admins can delete alerts for audit trail integrity
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteAlert);

export default router;
