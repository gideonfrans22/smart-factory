import { Router } from "express";
  import { userController } from "./user.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", (req, res, next) => userController.list(req, res, next));
  router.get("/:id", (req, res, next) => userController.getById(req, res, next));
  router.post("/", (req, res, next) => userController.create(req, res, next));
  router.put("/:id", (req, res, next) => userController.update(req, res, next));
  router.delete("/:id", (req, res, next) => userController.remove(req, res, next));
  export default router;
  /**
   * Mount in app:
   *   import userRoutes from "./modules/user/user.routes";
   *   app.use("/api/user", userRoutes);
   */
  