import { Router } from "express";
import { deviceTypeController } from "./device-type.controller";
// import { authMiddleware } from "@shared/middleware"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", deviceTypeController.list);
router.get("/:id", deviceTypeController.getById);
router.post("/", deviceTypeController.create);
router.put("/:id", deviceTypeController.update);
router.delete("/:id", deviceTypeController.remove);
export default router;
/**
 * Mount in app:
 *   import deviceTypeRoutes from "./modules/device-type/device-type.routes";
 *   app.use("/api/device-type", deviceTypeRoutes);
 */
