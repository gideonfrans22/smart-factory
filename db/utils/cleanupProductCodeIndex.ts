import mongoose from "mongoose";
import { connectDB } from "../config/database";

/**
 * Migration script to clean up unused productCode index
 * Run this to remove the orphaned productCode index
 */
async function cleanupProductCodeIndex() {
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

    // Check if the productCode index exists
    const productCodeIndex = indexes.find(
      (idx) => idx.name === "productCode_1"
    );

    if (productCodeIndex) {
      console.log("Dropping unused index: productCode_1");
      await collection.dropIndex("productCode_1");
      console.log("✅ Unused index dropped successfully");
    } else {
      console.log("ℹ️ productCode index not found - nothing to drop");
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

cleanupProductCodeIndex();
