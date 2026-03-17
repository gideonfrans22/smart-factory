import { Router } from "express";
import { alertController } from "./alert.controller";
// import { authMiddleware } from "@shared/middleware"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", alertController.list);
router.get("/:id", alertController.getById);
router.post("/", alertController.create);
router.put("/:id", alertController.update);
router.delete("/:id", alertController.remove);
export default router;
/**
 * Mount in app:
 *   import alertRoutes from "./modules/alert/alert.routes";
 *   app.use("/api/alert", alertRoutes);
 */
