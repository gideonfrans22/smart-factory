import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";

const router = Router();

/**
 * @route   GET /api/dashboard/monitor-overview
 * @desc    Get aggregated metrics for Monitor TV display
 * @access  Public
 * 
 * @response Returns comprehensive dashboard metrics including:
 * - taskProgress: { percentage, completed, total }
 * - deadlineCompliance: { percentage, onTime, total }
 * - productivity: { daily, weekly, monthly } with current/target/percentage
 * - errors: { categories[], total } - Alert breakdown by type
 * - equipmentUtilization: { percentage, online, offline, maintenance, error, total }
 * - workers: { current, capacity, percentage, active, idle }
 * - alerts: { total, unconfirmed, inProgress, resolved, avgResponseTime, resolutionRate }
 * - deviceErrorFrequency: Device type error counts
 * - timestamp: Current timestamp
 * 
 * @example
 * GET /api/dashboard/monitor-overview
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "taskProgress": { "percentage": 75, "completed": 75, "total": 100 },
 *     "deadlineCompliance": { "percentage": 85, "onTime": 85, "total": 100 },
 *     "productivity": {
 *       "daily": { "current": 20, "target": 50, "percentage": 40 },
 *       "weekly": { "current": 65, "target": 100, "percentage": 65 },
 *       "monthly": { "current": 120, "target": 150, "percentage": 80 }
 *     },
 *     "errors": {
 *       "categories": [
 *         { "name": "장비결함", "count": 10, "percentage": 40 },
 *         { "name": "소재불량", "count": 9, "percentage": 30 }
 *       ],
 *       "total": 34
 *     },
 *     "equipmentUtilization": { "percentage": 50, "online": 20, "total": 40 },
 *     "workers": { "current": 7, "capacity": 10, "percentage": 70, "active": 1, "idle": 6 }
 *   }
 * }
 */
router.get("/monitor-overview", dashboardController.getMonitorOverview);

/**
 * @route   GET /api/dashboard/task-status-distribution
 * @desc    Get task count by status for donut/pie chart visualization
 * @access  Public
 * 
 * @response Returns task distribution by status
 * 
 * @example
 * GET /api/dashboard/task-status-distribution
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "total": 100,
 *     "distribution": [
 *       { "status": "COMPLETED", "count": 50, "percentage": 50 },
 *       { "status": "ONGOING", "count": 30, "percentage": 30 },
 *       { "status": "PENDING", "count": 20, "percentage": 20 }
 *     ]
 *   }
 * }
 */
router.get("/task-status-distribution", dashboardController.getTaskStatusDistribution);

/**
 * @route   GET /api/dashboard/monitor-tasks
 * @desc    Get optimized task list for Monitor TV display
 * @access  Public
 * 
 * @query   limit - Maximum number of tasks (default: 100, max: 200)
 * 
 * @response Returns flattened task data optimized for TV display
 * - Server-side filtering: excludes COMPLETED tasks older than 24h
 * - Flattened structure: no deep populates needed
 * 
 * @example
 * GET /api/dashboard/monitor-tasks?limit=100
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "_id": "...",
 *         "title": "Step 1 - Product A",
 *         "status": "ONGOING",
 *         "priority": "HIGH",
 *         "progress": 50,
 *         "projectNumber": "PRJ-001",
 *         "projectName": "Project A",
 *         "productName": "Product A",
 *         "productNumber": "PROD-001",
 *         "customerName": "Customer A",
 *         "department": "Engineering",
 *         "personInCharge": "John Doe",
 *         "stepName": "Welding",
 *         "recipeExecutionNumber": 1,
 *         "totalRecipeExecutions": 5,
 *         ...
 *       }
 *     ],
 *     "total": 50
 *   }
 * }
 */
router.get("/monitor-tasks", dashboardController.getMonitorTasks);

export default router;
