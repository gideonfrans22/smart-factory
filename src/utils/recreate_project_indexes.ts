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

    // Drop specific conflicting index if it exists
    console.log("Dropping old index 'projectNumber_1' if it exists...");
    try {
      await Project.collection.dropIndex("projectNumber_1");
      console.log("Old index 'projectNumber_1' dropped.");
    } catch (error: any) {
      if (error.codeName === "IndexNotFound") {
        console.log("Old index 'projectNumber_1' does not exist, skipping.");
      } else {
        throw error;
      }
    }

    // Drop all other existing indexes
    console.log("Dropping all existing indexes for the Project model...");
    try {
      await Project.collection.dropIndexes();
      console.log("Existing indexes dropped.");
    } catch (error: any) {
      if (error.codeName === "IndexNotFound") {
        console.log("No indexes to drop.");
      } else {
        throw error;
      }
    }

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
