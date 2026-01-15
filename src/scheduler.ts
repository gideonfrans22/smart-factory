import * as dotenv from "dotenv";
import { connectDB, disconnectDB } from "./config/database";
import { initializeScheduler } from "./services/schedulerService";

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
  console.log(
    `\n📤 ${signal} received on scheduler worker ${process.pid}, shutting down gracefully...`
  );

  try {
    await disconnectDB();
    console.log("✅ Scheduler worker shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Scheduler worker uncaught exception:", error);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "❌ Scheduler worker unhandled rejection at:",
    promise,
    "reason:",
    reason
  );
  gracefulShutdown("unhandledRejection");
});

// Start the scheduler
startScheduler();
