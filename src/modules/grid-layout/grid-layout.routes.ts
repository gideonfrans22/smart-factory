import { Router } from "express";
import { gridLayoutController } from "./grid-layout.controller";
// import { authMiddleware } from "@shared/middleware/auth"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", gridLayoutController.list);
router.get("/:id", gridLayoutController.getById);
router.post("/", gridLayoutController.create);
router.put("/:id", gridLayoutController.update);
router.delete("/:id", gridLayoutController.remove);
export default router;
/**
 * Mount in app:
 *   import gridLayoutRoutes from "./modules/grid-layout/grid-layout.routes";
 *   app.use("/api/grid-layout", gridLayoutRoutes);
 */
