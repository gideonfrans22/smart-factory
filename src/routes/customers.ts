import { Router } from "express";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from "../controllers/customerController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/customers
 * @desc Get all customers with filtering and pagination
 * @access Admin only
 */
router.get("/", authenticateToken, requireAdmin, getCustomers);

/**
 * @route GET /api/customers/:id
 * @desc Get customer by ID
 * @access Admin only
 */
router.get("/:id", authenticateToken, requireAdmin, getCustomerById);

/**
 * @route POST /api/customers
 * @desc Create new customer
 * @access Admin only
 */
router.post("/", authenticateToken, requireAdmin, createCustomer);

/**
 * @route PUT /api/customers/:id
 * @desc Update customer
 * @access Admin only
 */
router.put("/:id", authenticateToken, requireAdmin, updateCustomer);

/**
 * @route DELETE /api/customers/:id
 * @desc Delete customer
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteCustomer);

export default router;
