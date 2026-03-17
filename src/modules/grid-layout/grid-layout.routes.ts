import { Router } from "express";
  import { gridLayoutController } from "./grid-layout.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => gridLayoutController.list(req, res, next));
  router.get("/:id", (req, res, next) => gridLayoutController.getById(req, res, next));
  router.post("/", (req, res, next) => gridLayoutController.create(req, res, next));
  router.put("/:id", (req, res, next) => gridLayoutController.update(req, res, next));
  router.delete("/:id", (req, res, next) => gridLayoutController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import gridLayoutRoutes from "./modules/grid-layout/grid-layout.routes";
   *   app.use("/api/grid-layout", gridLayoutRoutes);
   */
  