import mongoose from "mongoose";
import { Task } from "@/models";
import * as dotenv from "dotenv";

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

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(dbUri);
    console.log("✅ Connected to MongoDB.");

    // Get current indexes before dropping
    console.log("\n📋 Current indexes:");
    try {
      const indexes = await Task.collection.indexes();
      console.log(`Found ${indexes.length} index(es):`);
      indexes.forEach((index: any) => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    } catch (error: any) {
      console.log("Could not list current indexes:", error.message);
    }

    // Drop all existing indexes (except _id)
    console.log("\n🗑️  Dropping all existing indexes for the Task model...");
    try {
      await Task.collection.dropIndexes();
      console.log("✅ Existing indexes dropped.");
    } catch (error: any) {
      if (error.codeName === "IndexNotFound" || error.code === 27) {
        console.log("ℹ️  No indexes to drop (or only _id index exists).");
      } else {
        throw error;
      }
    }

    // Recreate indexes based on the schema
    console.log("\n🔨 Recreating indexes for the Task model...");
    await Task.syncIndexes();
    console.log("✅ Indexes recreated successfully.");

    // List newly created indexes
    console.log("\n📋 Newly created indexes:");
    try {
      const newIndexes = await Task.collection.indexes();
      console.log(`Created ${newIndexes.length} index(es):`);
      newIndexes.forEach((index: any) => {
        const indexName = index.name;
        const indexKey = JSON.stringify(index.key);
        const isUnique = index.unique ? " [UNIQUE]" : "";
        const isSparse = index.sparse ? " [SPARSE]" : "";
        console.log(`  ✅ ${indexName}: ${indexKey}${isUnique}${isSparse}`);
      });
    } catch (error: any) {
      console.log("Could not list new indexes:", error.message);
    }

    // Get index statistics
    console.log("\n📊 Index statistics:");
    try {
      const db = mongoose.connection.db;
      if (db) {
        const stats = await db.command({ collStats: Task.collection.name });
        console.log(
          `  - Collection size: ${((stats.size || 0) / 1024 / 1024).toFixed(
            2
          )} MB`
        );
        console.log(`  - Document count: ${stats.count || 0}`);
        console.log(`  - Index count: ${stats.nindexes || 0}`);
        console.log(
          `  - Total index size: ${(
            (stats.totalIndexSize || 0) /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
      }
    } catch (error: any) {
      console.log("Could not get statistics:", error.message);
    }

    // Close the connection
    console.log("\n📤 Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB.");
    console.log("\n🎉 Task indexes recreation completed successfully!");
  } catch (error) {
    console.error("\n❌ Error while recreating indexes:", error);
    process.exit(1);
  }
};

// Run the script
recreateIndexes();
