import * as dotenv from "dotenv";
import { connectDB, disconnectDB } from "./config/database";
import { initializeScheduler } from "./services/schedulerService";
import { loggerService } from "./services/loggerService";

// Load environment variables
dotenv.config();

/**
 * Dedicated Scheduler Worker Process
 * Runs scheduled report generation jobs independently from API workers
 */

const startScheduler = async (): Promise<void> => {
  try {
    console.log("🕐 Starting Report Scheduler Worker...");
    console.log(`👷 Process ID: ${process.pid}`);

    // Connect to MongoDB
    await connectDB();
    console.log("✅ Database connected");

    // Initialize scheduler
    initializeScheduler();

    console.log("✅ Scheduler worker started successfully");
    console.log("⏰ Waiting for scheduled jobs...");
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
