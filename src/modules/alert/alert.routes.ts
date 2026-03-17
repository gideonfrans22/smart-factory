import { Router } from "express";
  import { alertController } from "./alert.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => alertController.list(req, res, next));
  router.get("/:id", (req, res, next) => alertController.getById(req, res, next));
  router.post("/", (req, res, next) => alertController.create(req, res, next));
  router.put("/:id", (req, res, next) => alertController.update(req, res, next));
  router.delete("/:id", (req, res, next) => alertController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import alertRoutes from "./modules/alert/alert.routes";
   *   app.use("/api/alert", alertRoutes);
   */
  