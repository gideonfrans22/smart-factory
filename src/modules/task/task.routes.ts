import { Router } from "express";
import { taskController } from "./task.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", taskController.list);
router.get("/:id", taskController.getById);
router.post("/", taskController.create);
router.put("/:id", taskController.update);
router.delete("/:id", taskController.remove);
export default router;
/**
 * Mount in app:
 *   import taskRoutes from "./modules/task/task.routes";
 *   app.use("/api/task", taskRoutes);
 */
