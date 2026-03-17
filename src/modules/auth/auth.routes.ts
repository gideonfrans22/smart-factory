import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticateToken } from "@shared/middleware";
import {
  registerSchema,
  loginSchema,
  workerLoginSchema,
  monitorLoginSchema
} from "./auth.validators";
import { validateBody } from "@shared/utils";

const router = Router();

// Public auth endpoints
router.post("/register", validateBody(registerSchema), authController.register);

router.post("/login", validateBody(loginSchema), authController.login);

router.post(
  "/worker-login",
  validateBody(workerLoginSchema),
  authController.workerLogin
);

router.post(
  "/monitor-login",
  validateBody(monitorLoginSchema),
  authController.monitorLogin
);

// Protected auth endpoints
router.post("/logout", authenticateToken, authController.logout);

router.get("/profile", authenticateToken, authController.getProfile);

export default router;
