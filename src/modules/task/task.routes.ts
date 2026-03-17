import { Router } from "express";
  import { taskController } from "./task.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => taskController.list(req, res, next));
  router.get("/:id", (req, res, next) => taskController.getById(req, res, next));
  router.post("/", (req, res, next) => taskController.create(req, res, next));
  router.put("/:id", (req, res, next) => taskController.update(req, res, next));
  router.delete("/:id", (req, res, next) => taskController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import taskRoutes from "./modules/task/task.routes";
   *   app.use("/api/task", taskRoutes);
   */
  