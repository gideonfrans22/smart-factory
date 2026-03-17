import { Router } from "express";
  import { productController } from "./product.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => productController.list(req, res, next));
  router.get("/:id", (req, res, next) => productController.getById(req, res, next));
  router.post("/", (req, res, next) => productController.create(req, res, next));
  router.put("/:id", (req, res, next) => productController.update(req, res, next));
  router.delete("/:id", (req, res, next) => productController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import productRoutes from "./modules/product/product.routes";
   *   app.use("/api/product", productRoutes);
   */
  