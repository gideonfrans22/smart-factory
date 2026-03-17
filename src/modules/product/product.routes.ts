import { Router } from "express";
import { productController } from "./product.controller";
// import { authMiddleware } from "@shared/middleware"; // example
const router = Router();
// router.use(authMiddleware); // enable if needed
router.get("/", productController.list);
router.get("/:id", productController.getById);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.delete("/:id", productController.remove);
export default router;
/**
 * Mount in app:
 *   import productRoutes from "./modules/product/product.routes";
 *   app.use("/api/product", productRoutes);
 */
