import { Router } from "express";
  import { deviceController } from "./device.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => deviceController.list(req, res, next));
  router.get("/:id", (req, res, next) => deviceController.getById(req, res, next));
  router.post("/", (req, res, next) => deviceController.create(req, res, next));
  router.put("/:id", (req, res, next) => deviceController.update(req, res, next));
  router.delete("/:id", (req, res, next) => deviceController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import deviceRoutes from "./modules/device/device.routes";
   *   app.use("/api/device", deviceRoutes);
   */
  