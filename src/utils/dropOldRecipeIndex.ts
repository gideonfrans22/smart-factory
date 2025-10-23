import mongoose from "mongoose";
import { connectDB } from "../config/database";

/**
 * Migration script to drop the old productCode_version unique index
 * Run this once to fix the duplicate key error
 */
async function dropOldRecipeIndex() {
  try {
    await connectDB();
    console.log("Connected to database");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }
    const collection = db.collection("recipes");

    // Get all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:", JSON.stringify(indexes, null, 2));

    // Check if the old index exists
    const oldIndex = indexes.find(
      (idx) => idx.name === "productCode_1_version_1"
    );

    if (oldIndex) {
      console.log("Dropping old index: productCode_1_version_1");
      await collection.dropIndex("productCode_1_version_1");
      console.log("✅ Old index dropped successfully");
    } else {
      console.log("ℹ️ Old index not found - nothing to drop");
    }

    // Show remaining indexes
    const remainingIndexes = await collection.indexes();
    console.log(
      "Remaining indexes:",
      JSON.stringify(remainingIndexes, null, 2)
    );

    process.exit(0);
  } catch (error: any) {
    console.error("Error dropping index:", error.message);
    process.exit(1);
  }
}

dropOldRecipeIndex();
