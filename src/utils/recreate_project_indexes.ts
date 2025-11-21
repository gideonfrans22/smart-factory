import mongoose from "mongoose";
import { Project } from "../models/Project";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const recreateIndexes = async () => {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URI;
    if (!dbUri) {
      throw new Error(
        "MONGODB_URI is not defined in the environment variables."
      );
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(dbUri);
    console.log("Connected to MongoDB.");

    // Drop existing indexes
    console.log("Dropping existing indexes for the Project model...");
    await Project.collection.dropIndexes();
    console.log("Existing indexes dropped.");

    // Recreate indexes based on the schema
    console.log("Recreating indexes for the Project model...");
    await Project.syncIndexes();
    console.log("Indexes recreated successfully.");

    // Close the connection
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (error) {
    console.error("Error while recreating indexes:", error);
    process.exit(1);
  }
};

recreateIndexes();
