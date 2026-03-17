import { Router } from "express";
  import { deviceTypeController } from "./device-type.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => deviceTypeController.list(req, res, next));
  router.get("/:id", (req, res, next) => deviceTypeController.getById(req, res, next));
  router.post("/", (req, res, next) => deviceTypeController.create(req, res, next));
  router.put("/:id", (req, res, next) => deviceTypeController.update(req, res, next));
  router.delete("/:id", (req, res, next) => deviceTypeController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import deviceTypeRoutes from "./modules/device-type/device-type.routes";
   *   app.use("/api/device-type", deviceTypeRoutes);
   */
  