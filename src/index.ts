import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import http from "http";

// Import configurations
import { connectDB } from "./config/database";
import { mqttService } from "./config/mqtt";
import { initializeWebSocket } from "./config/websocket";
import { realtimeService } from "./services/realtimeService";
import { requestLoggingMiddleware, errorLoggingMiddleware } from "./middleware/logging";
import { loggerService } from "./services/loggerService";

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import recipeRoutes from "./routes/recipes";
import rawMaterialRoutes from "./routes/rawMaterials";
import productRoutes from "./routes/products";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import deviceRoutes from "./routes/devices";
import deviceTypeRoutes from "./routes/deviceTypes";
import gridLayoutRoutes from "./routes/gridLayouts";
import alertRoutes from "./routes/alerts";
import kpiRoutes from "./routes/kpi";
import reportRoutes from "./routes/reports";
import mediaRoutes from "./routes/media";
import customerRoutes from "./routes/customers";
import dashboardRoutes from "./routes/dashboard";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000") // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware (after body parsing, before routes)
app.use(requestLoggingMiddleware);

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
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

// Health check and info routes
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

// Global error handler (with logging)
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

// Initialize services and start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to MQTT broker
    await mqttService.connect();

    // Create HTTP server (needed for Socket.IO)
    const httpServer = http.createServer(app);

    // Initialize WebSocket server
    await initializeWebSocket(httpServer);
    loggerService.info("WebSocket server ready");

    // Initialize MQTT message handlers (bridges MQTT → WebSocket)
    realtimeService.initializeMQTTHandlers();
    loggerService.info("Real-time service initialized");

    // Start HTTP server (with WebSocket attached)
    httpServer.listen(PORT, () => {
      const workerId = process.env.NODE_APP_INSTANCE || "standalone";
      loggerService.info(`Smart Factory Backend Server Started`, {
        workerId,
        pid: process.pid,
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        mqtt: mqttService.isConnected() ? "Connected" : "Disconnected"
      });
      loggerService.info(`REST API: http://localhost:${PORT}`);
      loggerService.info(`WebSocket: ws://localhost:${PORT}`);
      loggerService.info("All services initialized successfully");
    });

    // Handle server errors
    httpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind = typeof PORT === "string" ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case "EACCES":
          loggerService.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          loggerService.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    loggerService.error("Failed to start server", { error: (error as Error).message });
    process.exit(1);
  }
};

// Handle graceful shutdown for worker processes
const gracefulShutdown = async (signal: string) => {
  loggerService.info(`${signal} received on worker ${process.pid}, shutting down gracefully...`);

  try {
    // Disconnect MQTT
    mqttService.disconnect();
    loggerService.info("MQTT disconnected");

    // Give time for ongoing requests to complete
    setTimeout(() => {
      loggerService.info("Worker shutdown complete");
      process.exit(0);
    }, 2000);
  } catch (error) {
    loggerService.error("Error during graceful shutdown", { error: (error as Error).message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  loggerService.error("Worker uncaught exception", { error: error.message, stack: error.stack });
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  loggerService.error("Worker unhandled rejection", { reason: String(reason) });
  gracefulShutdown("unhandledRejection");
});

// Start the server
startServer();

export default app;
