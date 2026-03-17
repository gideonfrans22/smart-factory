import { Router } from "express";
  import { projectController } from "./project.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => projectController.list(req, res, next));
  router.get("/:id", (req, res, next) => projectController.getById(req, res, next));
  router.post("/", (req, res, next) => projectController.create(req, res, next));
  router.put("/:id", (req, res, next) => projectController.update(req, res, next));
  router.delete("/:id", (req, res, next) => projectController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import projectRoutes from "./modules/project/project.routes";
   *   app.use("/api/project", projectRoutes);
   */
  