import { Router } from "express";
  import { customerController } from "./customer.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => customerController.list(req, res, next));
  router.get("/:id", (req, res, next) => customerController.getById(req, res, next));
  router.post("/", (req, res, next) => customerController.create(req, res, next));
  router.put("/:id", (req, res, next) => customerController.update(req, res, next));
  router.delete("/:id", (req, res, next) => customerController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import customerRoutes from "./modules/customer/customer.routes";
   *   app.use("/api/customer", customerRoutes);
   */
  