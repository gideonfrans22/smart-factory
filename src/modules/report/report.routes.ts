import { Router } from "express";
  import { reportController } from "./report.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => reportController.list(req, res, next));
  router.get("/:id", (req, res, next) => reportController.getById(req, res, next));
  router.post("/", (req, res, next) => reportController.create(req, res, next));
  router.put("/:id", (req, res, next) => reportController.update(req, res, next));
  router.delete("/:id", (req, res, next) => reportController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import reportRoutes from "./modules/report/report.routes";
   *   app.use("/api/report", reportRoutes);
   */
  