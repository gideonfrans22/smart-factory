import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { loggerService } from "@shared/services";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/smart_factory";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    loggerService.logDatabaseEvent("Connected", { host: conn.connection.host });
  } catch (error) {
    loggerService.logDatabaseEvent("Connection error", {}, error as Error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    loggerService.logDatabaseEvent("Disconnected");
  } catch (error) {
    loggerService.logDatabaseEvent("Disconnection error", {}, error as Error);
  }
};

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  loggerService.logDatabaseEvent("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (error) => {
  loggerService.logDatabaseEvent("Mongoose connection error", {}, error);
});

mongoose.connection.on("disconnected", () => {
  loggerService.logDatabaseEvent("Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});
