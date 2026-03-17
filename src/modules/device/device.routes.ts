import { Router } from "express";
import { deviceController } from "./device.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", deviceController.list);
router.get("/:id", deviceController.getById);
router.post("/", deviceController.create);
router.put("/:id", deviceController.update);
router.delete("/:id", deviceController.remove);
export default router;
/**
 * Mount in app:
 *   import deviceRoutes from "./modules/device/device.routes";
 *   app.use("/api/device", deviceRoutes);
 */
