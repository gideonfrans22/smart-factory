import { Router } from "express";
  import { rawMaterialController } from "./raw-material.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => rawMaterialController.list(req, res, next));
  router.get("/:id", (req, res, next) => rawMaterialController.getById(req, res, next));
  router.post("/", (req, res, next) => rawMaterialController.create(req, res, next));
  router.put("/:id", (req, res, next) => rawMaterialController.update(req, res, next));
  router.delete("/:id", (req, res, next) => rawMaterialController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import rawMaterialRoutes from "./modules/raw-material/raw-material.routes";
   *   app.use("/api/raw-material", rawMaterialRoutes);
   */
  