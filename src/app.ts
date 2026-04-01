import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";

import { mqttService } from "@infra/config";
import {
  errorLoggingMiddleware,
  requestLoggingMiddleware
} from "@shared/middleware";

import { alertRoutes } from "@modules/alert";
import { analyticsRoutes } from "@modules/analytics";
import { authRoutes } from "@modules/auth";
import { customerRoutes } from "@modules/customer";
import { deviceRoutes } from "@modules/device";
import { deviceTypeRoutes } from "@modules/device-type";
import { gridLayoutRoutes } from "@modules/grid-layout";
import { mediaRoutes } from "@modules/media";
import { productRoutes } from "@modules/product";
import { projectRoutes } from "@modules/project";
import { rawMaterialRoutes } from "@modules/raw-material";
import { rawMaterialTypeRoutes } from "@modules/raw-material-type";
import { recipeRoutes } from "@modules/recipe";
import { reportRoutes } from "@modules/report";
import { taskRoutes } from "@modules/task";
import { userRoutes } from "@modules/user";
import { dashboardRoutes } from "@modules/dashboard";
import { kpiRoutes } from "@modules/kpi";

const app = express();

app.use(helmet());

const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000")
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(requestLoggingMiddleware);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/raw-material-types", rawMaterialTypeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/device-types", deviceTypeRoutes);
app.use("/api/grid-layouts", gridLayoutRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/kpi", kpiRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Smart Factory Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    features: [
      "User Authentication (JWT)",
      "Process Management",
      "Real-time MQTT Monitoring",
      "MongoDB Database",
      "Production Analytics"
    ]
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "connected",
    mqtt: mqttService.isConnected() ? "connected" : "disconnected",
    websocket: "connected",
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.use(errorLoggingMiddleware);
app.use((error: any, _req: Request, res: Response, _next: any) => {
  res.status(error.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack })
  });
});

export { app };
export default app;
