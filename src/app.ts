import cors from "cors";
import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";

import { mqttService } from "@infra/config";
import {
  errorLoggingMiddleware,
  requestLoggingMiddleware
} from "@shared/middleware";

import { authRoutes } from "@modules/auth";
import { analyticsRoutes } from "@modules/analytics";
import { userRoutes } from "@modules/user";
import { customerRoutes } from "@modules/customer";
import { deviceRoutes } from "@modules/device";
import { alertRoutes } from "@modules/alert";
import dashboardRoutes from "./routes/dashboard";
import { deviceTypeRoutes } from "@modules/device-type";
import { gridLayoutRoutes } from "@modules/grid-layout";
import kpiRoutes from "./routes/kpi";
import productRoutes from "./routes/products";
import projectRoutes from "./routes/projects";
import { rawMaterialRoutes } from "@modules/raw-material";
import recipeRoutes from "./routes/recipes";
import reportRoutes from "./routes/reports";
import taskRoutes from "./routes/tasks";
import { mediaRoutes } from "@modules/media";

dotenv.config();

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
