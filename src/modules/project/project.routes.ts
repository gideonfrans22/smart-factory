import { Router } from "express";
import { projectController } from "./project.controller";
// import { authMiddleware } from "@shared/middleware"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", projectController.list);
router.get("/:id", projectController.getById);
router.post("/", projectController.create);
router.put("/:id", projectController.update);
router.delete("/:id", projectController.remove);
export default router;
/**
 * Mount in app:
 *   import projectRoutes from "./modules/project/project.routes";
 *   app.use("/api/project", projectRoutes);
 */
