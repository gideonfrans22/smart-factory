import { Router } from "express";
import { reportController } from "./report.controller";
// import { authMiddleware } from "@shared/middleware"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", reportController.list);
router.get("/:id", reportController.getById);
router.post("/", reportController.create);
router.put("/:id", reportController.update);
router.delete("/:id", reportController.remove);
export default router;
/**
 * Mount in app:
 *   import reportRoutes from "./modules/report/report.routes";
 *   app.use("/api/report", reportRoutes);
 */
