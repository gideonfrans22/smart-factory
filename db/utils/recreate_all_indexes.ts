import mongoose from "mongoose";
import * as dotenv from "dotenv";

// Import all models
import {
  User,
  Customer,
  Recipe,
  RawMaterial,
  Product,
  Project,
  Task,
  RecipeSnapshot,
  ProductSnapshot,
  Media,
  Device,
  DeviceType,
  GridLayout,
  Alert,
  KPIData,
  Report,
  ActivityLog
} from "../models";

dotenv.config(); // Load environment variables from .env file

// Define all models with their display names
const models = [
  { model: User, name: "User", collectionName: "users" },
  { model: Customer, name: "Customer", collectionName: "customers" },
  { model: Recipe, name: "Recipe", collectionName: "recipes" },
  { model: RawMaterial, name: "RawMaterial", collectionName: "rawmaterials" },
  { model: Product, name: "Product", collectionName: "products" },
  { model: Project, name: "Project", collectionName: "projects" },
  { model: Task, name: "Task", collectionName: "tasks" },
  {
    model: RecipeSnapshot,
    name: "RecipeSnapshot",
    collectionName: "recipesnapshots"
  },
  {
    model: ProductSnapshot,
    name: "ProductSnapshot",
    collectionName: "productsnapshots"
  },
  { model: Media, name: "Media", collectionName: "media" },
  { model: Device, name: "Device", collectionName: "devices" },
  { model: DeviceType, name: "DeviceType", collectionName: "devicetypes" },
  { model: GridLayout, name: "GridLayout", collectionName: "gridlayouts" },
  { model: Alert, name: "Alert", collectionName: "alerts" },
  { model: KPIData, name: "KPIData", collectionName: "kpidatas" },
  { model: Report, name: "Report", collectionName: "reports" },
  { model: ActivityLog, name: "ActivityLog", collectionName: "activitylogs" }
];

interface IndexStats {
  modelName: string;
  collectionName: string;
  indexesBefore: number;
  indexesAfter: number;
  success: boolean;
  error?: string;
}

const recreateIndexesForModel = async (
  model: any,
  modelName: string,
  collectionName: string
): Promise<IndexStats> => {
  const stats: IndexStats = {
    modelName,
    collectionName,
    indexesBefore: 0,
    indexesAfter: 0,
    success: false
  };

  try {
    // Get current indexes
    try {
      const indexes = await model.collection.indexes();
      stats.indexesBefore = indexes.length;
    } catch (error: any) {
      console.log(`    ⚠️  Could not get current indexes: ${error.message}`);
    }

    // Drop all existing indexes (except _id)
    try {
      await model.collection.dropIndexes();
      console.log(`    ✅ Dropped existing indexes`);
    } catch (error: any) {
      if (error.codeName === "IndexNotFound" || error.code === 27) {
        console.log(`    ℹ️  No indexes to drop`);
      } else {
        throw error;
      }
    }

    // Recreate indexes based on the schema
    await model.syncIndexes();
    console.log(`    ✅ Recreated indexes`);

    // Get new indexes count
    try {
      const newIndexes = await model.collection.indexes();
      stats.indexesAfter = newIndexes.length;
    } catch (error: any) {
      console.log(`    ⚠️  Could not get new indexes: ${error.message}`);
    }

    stats.success = true;
  } catch (error: any) {
    stats.error = error.message;
    console.log(`    ❌ Error: ${error.message}`);
  }

  return stats;
};

const recreateAllIndexes = async () => {
  const startTime = Date.now();
  const results: IndexStats[] = [];

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
    console.log("✅ Connected to MongoDB.\n");

    // Get database stats
    const db = mongoose.connection.db;
    let dbStats: any = null;
    if (db) {
      try {
        dbStats = await db.stats();
        console.log("📊 Database Statistics:");
        console.log(`  - Database: ${db.databaseName}`);
        console.log(`  - Collections: ${dbStats.collections || 0}`);
        console.log(
          `  - Data size: ${((dbStats.dataSize || 0) / 1024 / 1024).toFixed(
            2
          )} MB`
        );
        console.log(
          `  - Storage size: ${(
            (dbStats.storageSize || 0) /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
        console.log(
          `  - Index size: ${((dbStats.indexSize || 0) / 1024 / 1024).toFixed(
            2
          )} MB\n`
        );
      } catch (error: any) {
        console.log(`⚠️  Could not get database stats: ${error.message}\n`);
      }
    }

    // Process each model
    console.log(`🔄 Processing ${models.length} collections...\n`);

    for (let i = 0; i < models.length; i++) {
      const { model, name, collectionName } = models[i];
      console.log(
        `[${i + 1}/${models.length}] Processing ${name} (${collectionName})...`
      );

      const stats = await recreateIndexesForModel(model, name, collectionName);
      results.push(stats);

      // Show index details if successful
      if (stats.success) {
        try {
          const indexes = await model.collection.indexes();
          if (indexes.length > 1) {
            // More than just _id
            console.log(
              `    📋 Created ${indexes.length - 1} index(es) (excluding _id)`
            );
            indexes.forEach((index: any) => {
              if (index.name !== "_id_") {
                const indexKey = JSON.stringify(index.key);
                const isUnique = index.unique ? " [UNIQUE]" : "";
                const isSparse = index.sparse ? " [SPARSE]" : "";
                console.log(
                  `       • ${index.name}: ${indexKey}${isUnique}${isSparse}`
                );
              }
            });
          } else {
            console.log(`    ℹ️  No custom indexes defined`);
          }
        } catch (error: any) {
          // Ignore errors listing indexes
        }
      }

      console.log(""); // Empty line between models
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\n✅ Successful: ${successful}/${models.length}`);
    console.log(`❌ Failed: ${failed}/${models.length}`);
    console.log(`⏱️  Duration: ${duration}s\n`);

    // Detailed results table
    console.log("Detailed Results:");
    console.log("-".repeat(60));
    console.log(
      `${"Model".padEnd(20)} ${"Collection".padEnd(20)} ${"Indexes".padEnd(
        15
      )} Status`
    );
    console.log("-".repeat(60));

    results.forEach((result) => {
      const status = result.success
        ? "✅ Success"
        : `❌ ${result.error || "Failed"}`;
      const indexes = result.success
        ? `${result.indexesAfter} index(es)`
        : "N/A";
      console.log(
        `${result.modelName.padEnd(20)} ${result.collectionName.padEnd(
          20
        )} ${indexes.padEnd(15)} ${status}`
      );
    });

    console.log("-".repeat(60));

    // Get final database stats
    if (db) {
      try {
        const finalStats = await db.stats();
        console.log("\n📊 Final Database Statistics:");
        console.log(
          `  - Index size: ${(
            (finalStats.indexSize || 0) /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
        const indexSizeDiff =
          (finalStats.indexSize || 0) - (dbStats?.indexSize || 0);
        if (indexSizeDiff !== 0) {
          console.log(
            `  - Index size change: ${indexSizeDiff > 0 ? "+" : ""}${(
              indexSizeDiff /
              1024 /
              1024
            ).toFixed(2)} MB`
          );
        }
      } catch (error: any) {
        // Ignore errors
      }
    }

    // Close the connection
    console.log("\n📤 Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB.");

    if (failed === 0) {
      console.log("\n🎉 All indexes recreated successfully!");
    } else {
      console.log(
        `\n⚠️  Completed with ${failed} error(s). Please review the output above.`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error while recreating indexes:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

// Run the script
recreateAllIndexes();
