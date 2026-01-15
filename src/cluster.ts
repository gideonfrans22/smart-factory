import cluster, { Worker } from "cluster";
import os from "os";
import * as dotenv from "dotenv";
import { connectDB, disconnectDB } from "./config/database";
import { initializeScheduler } from "./services/schedulerService";

// Load environment variables
dotenv.config();

const numWorkers =
  parseInt(process.env.CLUSTER_WORKERS || "0") || os.cpus().length;
const PORT = process.env.PORT || 3000;

if (cluster.isPrimary) {
  console.log(`🔄 Master process ${process.pid} is running`);
  console.log(`👷 Spawning ${numWorkers} worker(s)...`);

  // Track workers
  const workers: { [key: number]: Worker } = {};

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork();
    workers[worker.id] = worker;
    console.log(`✅ Worker ${worker.id} (PID: ${worker.process.pid}) spawned`);
  }

  // Handle worker online
  cluster.on("online", (worker) => {
    console.log(
      `✅ Worker ${worker.id} (PID: ${worker.process.pid}) is online`
    );
  });

  // Handle worker exit
  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `❌ Worker ${worker.id} (PID: ${worker.process.pid}) died with code ${code} and signal ${signal}`
    );
    delete workers[worker.id];

    // Restart worker if it crashed (not intentional shutdown)
    if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      console.log(`🔄 Restarting worker ${worker.id}...`);
      const newWorker = cluster.fork();
      workers[newWorker.id] = newWorker;
      console.log(
        `✅ Worker ${newWorker.id} (PID: ${newWorker.process.pid}) restarted`
      );
    } else {
      console.log(`🛑 Worker ${worker.id} shutdown gracefully`);
    }

    // If all workers are dead, exit master
    if (Object.keys(workers).length === 0) {
      console.log("🛑 All workers stopped. Exiting master process...");
      process.exit(0);
    }
  });

  // Handle messages from workers
  cluster.on("message", (worker, message) => {
    console.log(`📨 Message from worker ${worker.id}:`, message);
  });

  // Graceful shutdown for master
  const gracefulShutdown = async (signal: string) => {
    console.log(
      `\n📤 ${signal} received on master. Shutting down gracefully...`
    );
    console.log(`🛑 Stopping ${Object.keys(workers).length} worker(s)...`);

    // Disconnect all workers
    for (const id in workers) {
      const worker = workers[id];
      if (worker && !worker.isDead()) {
        worker.disconnect();
      }
    }

    // Wait for workers to disconnect, then exit
    const checkWorkers = setInterval(() => {
      const aliveWorkers = Object.values(workers).filter(
        (w) => w && !w.isDead()
      );
      if (aliveWorkers.length === 0) {
        clearInterval(checkWorkers);
        // Disconnect database before exiting
        disconnectDB()
          .then(() => {
            console.log("✅ All workers stopped. Master exiting...");
            process.exit(0);
          })
          .catch((error) => {
            console.error("Error disconnecting database:", error);
            process.exit(0);
          });
      }
    }, 1000);

    // Force exit after timeout
    setTimeout(() => {
      console.log("⚠️ Force exiting after timeout...");
      disconnectDB().finally(() => {
        process.exit(1);
      });
    }, 10000);
  };

  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM").catch((error) => {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    });
  });
  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT").catch((error) => {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    });
  });

  // Handle uncaught exceptions in master
  process.on("uncaughtException", (error) => {
    console.error("❌ Master uncaught exception:", error);
    gracefulShutdown("uncaughtException");
  });

  // Initialize scheduler in master process
  const initializeMasterServices = async (): Promise<void> => {
    try {
      // Connect to MongoDB for scheduler
      await connectDB();
      console.log("✅ Master process connected to database");

      // Initialize report scheduler
      initializeScheduler();
    } catch (error) {
      console.error("❌ Failed to initialize master services:", error);
      // Don't exit - allow workers to start even if scheduler fails
    }
  };

  // Initialize scheduler after a short delay to ensure workers start first
  setTimeout(() => {
    initializeMasterServices();
  }, 1000);

  console.log(`🚀 Master process ready. Workers will listen on port ${PORT}`);
} else {
  // Worker process - import and start the server
  import("./index").catch((error) => {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  });
}
