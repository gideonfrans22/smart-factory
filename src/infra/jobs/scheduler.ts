import * as dotenv from "dotenv";
import { connectDB, disconnectDB } from "@infra/config";
import { initializeScheduler } from "./schedulerService";
import { loggerService } from "@shared/services";

// Load environment variables
dotenv.config({ quiet: true });

/**
 * Dedicated Scheduler Worker Process
 * Runs scheduled report generation jobs independently from API workers
 */

const startScheduler = async (): Promise<void> => {
  try {
    loggerService.info("🕐 Starting Report Scheduler Worker...");
    loggerService.info(`👷 Process ID: ${process.pid}`);

    // Connect to MongoDB
    await connectDB();
    loggerService.info("✅ Database connected");

    // Initialize scheduler
    initializeScheduler();

    loggerService.info("✅ Scheduler worker started successfully");
    loggerService.info("⏰ Waiting for scheduled jobs...");
  } catch (error) {
    console.error("❌ Failed to start scheduler worker:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  loggerService.logSchedulerEvent(
    `${signal} received on scheduler worker, shutting down gracefully`,
    {
      processId: process.pid
    }
  );

  try {
    await disconnectDB();
    loggerService.logSchedulerEvent("Scheduler worker shutdown complete");
    process.exit(0);
  } catch (error) {
    loggerService.logSchedulerEvent(
      "Error during graceful shutdown",
      {},
      error as Error
    );
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  loggerService.logSchedulerEvent(
    "Scheduler worker uncaught exception",
    {},
    error
  );
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  loggerService.logSchedulerEvent("Scheduler worker unhandled rejection", {
    reason: String(reason)
  });
  gracefulShutdown("unhandledRejection");
});

// Start the scheduler
startScheduler();
