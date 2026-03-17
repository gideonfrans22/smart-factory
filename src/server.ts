import http from "http";

import { connectDB } from "./config/database";
import { mqttService } from "./config/mqtt";
import { initializeWebSocket } from "./config/websocket";
import { realtimeService } from "./services/realtimeService";
import { loggerService } from "./services/loggerService";
import app from "./app";

const PORT = process.env.PORT || 3000;

console.log("IS this working?");

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    await mqttService.connect();

    const httpServer = http.createServer(app);

    await initializeWebSocket(httpServer);
    loggerService.info("WebSocket server ready");

    realtimeService.initializeMQTTHandlers();
    loggerService.info("Real-time service initialized");

    httpServer.listen(PORT, () => {
      const workerId = process.env.NODE_APP_INSTANCE || "standalone";
      loggerService.info("Smart Factory Backend Server Started", {
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

    httpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind = typeof PORT === "string" ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case "EACCES":
          loggerService.error(`${bind} requires elevated privileges`);
          process.exit(1);
        case "EADDRINUSE":
          loggerService.error(`${bind} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });
  } catch (error) {
    loggerService.error("Failed to start server", {
      error: (error as Error).message
    });
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string) => {
  loggerService.info(
    `${signal} received on worker ${process.pid}, shutting down gracefully...`
  );

  try {
    mqttService.disconnect();
    loggerService.info("MQTT disconnected");

    setTimeout(() => {
      loggerService.info("Worker shutdown complete");
      process.exit(0);
    }, 2000);
  } catch (error) {
    loggerService.error("Error during graceful shutdown", {
      error: (error as Error).message
    });
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  loggerService.error("Worker uncaught exception", {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  loggerService.error("Worker unhandled rejection", {
    reason: String(reason)
  });
  gracefulShutdown("unhandledRejection");
});

startServer();

export { app, startServer, gracefulShutdown };
