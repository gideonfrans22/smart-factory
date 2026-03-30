/**
 * Script to delete all MongoDB collections except:
 * - DeviceTypes (devicetypes)
 * - Devices (devices)
 * - Users (users)
 * - GridLayout (gridlayouts)
 *
 * Usage: npm run delete-collections-except
 * Or: npx ts-node ./src/utils/deleteCollectionsExcept.ts
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

const COLLECTIONS_TO_KEEP = [
  "devicetypes",
  "devices",
  "users",
  "gridlayouts"
];

const run = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/smart_factory";

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    const collectionNames = await db.listCollections().toArray();
    const names = collectionNames.map((c) => c.name);
    const toDelete = names.filter(
      (name) => !COLLECTIONS_TO_KEEP.includes(name.toLowerCase())
    );

    if (toDelete.length === 0) {
      console.log("No collections to delete. All collections are in the keep list.");
      await mongoose.disconnect();
      return;
    }

    console.log("\nCollections to KEEP:", COLLECTIONS_TO_KEEP.join(", "));
    console.log("Collections to DELETE:", toDelete.join(", "));
    console.log(`\nAbout to drop ${toDelete.length} collection(s).`);

    for (const name of toDelete) {
      await db.dropCollection(name);
      console.log(`  Dropped: ${name}`);
    }

    console.log("\nDone.");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
  }
};

run();
