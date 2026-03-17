import { Router } from "express";
import { rawMaterialController } from "./raw-material.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", rawMaterialController.list);
router.get("/:id", rawMaterialController.getById);
router.post("/", rawMaterialController.create);
router.put("/:id", rawMaterialController.update);
router.delete("/:id", rawMaterialController.remove);
export default router;
/**
 * Mount in app:
 *   import rawMaterialRoutes from "./modules/raw-material/raw-material.routes";
 *   app.use("/api/raw-material", rawMaterialRoutes);
 */
