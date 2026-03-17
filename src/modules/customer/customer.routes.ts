import { Router } from "express";
import { customerController } from "./customer.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", customerController.list);
router.get("/:id", customerController.getById);
router.post("/", customerController.create);
router.put("/:id", customerController.update);
router.delete("/:id", customerController.remove);
export default router;
/**
 * Mount in app:
 *   import customerRoutes from "./modules/customer/customer.routes";
 *   app.use("/api/customer", customerRoutes);
 */
