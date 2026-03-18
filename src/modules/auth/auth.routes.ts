import { authenticateToken, validate } from "@shared/middleware";
import { Router } from "express";
import { authController } from "./auth.controller";
import {
  loginSchema,
  monitorLoginSchema,
  registerSchema,
  workerLoginSchema
} from "./auth.validators";

const router = Router();

// Public auth endpoints
router.post("/register", validate(registerSchema), authController.register);

router.post("/login", validate(loginSchema), authController.login);

router.post(
  "/worker-login",
  validate(workerLoginSchema),
  authController.workerLogin
);

router.post(
  "/monitor-login",
  validate(monitorLoginSchema),
  authController.monitorLogin
);

// Protected auth endpoints
router.post("/logout", authenticateToken, authController.logout);

router.get("/profile", authenticateToken, authController.getProfile);

export default router;
