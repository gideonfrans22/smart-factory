import mongoose from "mongoose";
import * as dotenv from "dotenv";

import "@modules/user/user.model";
import {
  RawMaterial,
  RawMaterialDocument,
  RawMaterialSpecification
} from "@modules/raw-material/raw-material.model";
import { RawMaterialType } from "@modules/raw-material-type/raw-material-type.model";

dotenv.config();

type MigrationMode = "dry-run" | "commit";

interface MigrationOptions {
  mode: MigrationMode;
  useTransaction: boolean;
  limit?: number;
  includeAlreadyMigrated: boolean;
}

interface MigrationStats {
  startedAt: Date;
  finishedAt?: Date;
  scanned: number;
  skippedAlreadyMigrated: number;
  updatedRawMaterials: number;
  createdRawMaterialTypes: number;
  createdRawMaterialsFromMultiSpec: number;
  uniquenessCollisions: number;
  missingDimensionsForMultiSpec: number;
  errors: number;
}

const parseArgs = (): MigrationOptions => {
  const args = process.argv.slice(2);

  const getArgValue = (name: string): string | undefined => {
    const prefix = `${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : undefined;
  };

  const hasFlag = (name: string): boolean => args.includes(name);

  const modeRaw = getArgValue("--mode") ?? (hasFlag("--commit") ? "commit" : "dry-run");
  const mode: MigrationMode = modeRaw === "commit" ? "commit" : "dry-run";

  const useTransactionRaw = getArgValue("--transaction");
  const useTransaction =
    useTransactionRaw == null ? true : ["1", "true", "yes", "on"].includes(useTransactionRaw.toLowerCase());

  const limitRaw = getArgValue("--limit");
  const limit = limitRaw != null ? Number(limitRaw) : undefined;

  const includeAlreadyMigrated = hasFlag("--include-already-migrated");

  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`Invalid --limit value: ${limitRaw}`);
  }

  return { mode, useTransaction, limit, includeAlreadyMigrated };
};

const buildUniquenessKey = (
  materialTypeId: mongoose.Types.ObjectId,
  dimensions: { length?: number; width?: number; height?: number }
): string => {
  return [
    materialTypeId.toString(),
    dimensions.length ?? "null",
    dimensions.width ?? "null",
    dimensions.height ?? "null"
  ].join("|");
};

const extractSpecFields = (spec?: RawMaterialSpecification) => {
  return {
    dimensions: spec?.dimensions,
    weight: spec?.weight,
    color: spec?.color
  };
};

const nowIso = () => new Date().toISOString();

const run = async (): Promise<void> => {
  const options = parseArgs();
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/smart_factory";

  const stats: MigrationStats = {
    startedAt: new Date(),
    scanned: 0,
    skippedAlreadyMigrated: 0,
    updatedRawMaterials: 0,
    createdRawMaterialTypes: 0,
    createdRawMaterialsFromMultiSpec: 0,
    uniquenessCollisions: 0,
    missingDimensionsForMultiSpec: 0,
    errors: 0
  };

  console.log(`[${nowIso()}] RawMaterial migration starting`);
  console.log(`- mode: ${options.mode}`);
  console.log(`- transaction: ${options.useTransaction ? "on" : "off"}`);
  console.log(`- limit: ${options.limit ?? "none"}`);
  console.log(`- includeAlreadyMigrated: ${options.includeAlreadyMigrated ? "yes" : "no"}`);
  console.log("");

  console.log(`[${nowIso()}] Connecting to MongoDB...`);
  await mongoose.connect(uri);
  console.log(`[${nowIso()}] Connected.`);

  const session = options.useTransaction ? await mongoose.startSession() : null;

  const typeCache = new Map<string, mongoose.Types.ObjectId>();
  const createdTypeIds: mongoose.Types.ObjectId[] = [];
  const createdRawMaterialIds: mongoose.Types.ObjectId[] = [];
  const uniquenessKeysSeen = new Set<string>();

  const migrateOne = async (doc: RawMaterialDocument): Promise<void> => {
    stats.scanned += 1;

    if (!options.includeAlreadyMigrated && doc.materialType) {
      stats.skippedAlreadyMigrated += 1;
      return;
    }

    const materialCode = doc.materialCode;
    const name = doc.name;

    if (!materialCode || !name) {
      throw new Error(`RawMaterial ${(doc._id as mongoose.Types.ObjectId).toString()} missing materialCode or name`);
    }

    const typeCacheKey = `${materialCode}||${name}`;
    let materialTypeId = typeCache.get(typeCacheKey);

    if (!materialTypeId) {
      const existing = await RawMaterialType.findOne({ code: materialCode, name }).session(session);
      if (existing) {
        materialTypeId = existing._id as mongoose.Types.ObjectId;
      } else {
        if (options.mode === "commit") {
          const created = await RawMaterialType.create(
            [
              {
                code: materialCode,
                name
              }
            ],
            session ? { session } : undefined
          );
          materialTypeId = created[0]._id as mongoose.Types.ObjectId;
          createdTypeIds.push(materialTypeId);
          stats.createdRawMaterialTypes += 1;
        } else {
          // Dry-run: generate a deterministic placeholder ObjectId per cacheKey
          materialTypeId = new mongoose.Types.ObjectId();
          stats.createdRawMaterialTypes += 1;
        }
      }

      typeCache.set(typeCacheKey, materialTypeId);
    }

    const specs = Array.isArray(doc.specifications) ? doc.specifications : [];
    const firstSpec = specs[0];
    const restSpecs = specs.slice(1);

    const rootFields = extractSpecFields(firstSpec);

    if (options.mode === "commit") {
      await RawMaterial.updateOne(
        { _id: doc._id },
        {
          $set: {
            materialType: materialTypeId,
            ...rootFields
          }
        },
        { session: session ?? undefined }
      );
    }
    stats.updatedRawMaterials += 1;

    if (restSpecs.length === 0) {
      return;
    }

    for (const spec of restSpecs) {
      const extracted = extractSpecFields(spec);
      const dimensions = extracted.dimensions;

      if (dimensions?.length == null || dimensions?.width == null || dimensions?.height == null) {
        stats.missingDimensionsForMultiSpec += 1;
        continue;
      }

      const uniquenessKey = buildUniquenessKey(materialTypeId, dimensions);
      if (uniquenessKeysSeen.has(uniquenessKey)) {
        stats.uniquenessCollisions += 1;
        continue;
      }

      uniquenessKeysSeen.add(uniquenessKey);

      if (options.mode === "commit") {
        const exists = await RawMaterial.exists({
          materialType: materialTypeId,
          "dimensions.length": dimensions.length,
          "dimensions.width": dimensions.width,
          "dimensions.height": dimensions.height
        }).session(session);

        if (exists) {
          stats.uniquenessCollisions += 1;
          continue;
        }

        const created = await RawMaterial.create(
          [
            {
              materialCode: doc.materialCode,
              name: doc.name,
              materialType: materialTypeId,
              description: doc.description,
              supplier: doc.supplier,
              unit: doc.unit,
              currentStock: doc.currentStock,
              modifiedBy: doc.modifiedBy,
              ...extracted,
              specifications: []
            }
          ],
          session ? { session } : undefined
        );
        createdRawMaterialIds.push(created[0]._id as mongoose.Types.ObjectId);
      }

      stats.createdRawMaterialsFromMultiSpec += 1;
    }
  };

  const reportAndFinish = async (): Promise<void> => {
    stats.finishedAt = new Date();
    const durationMs = stats.finishedAt.getTime() - stats.startedAt.getTime();

    console.log("");
    console.log("=".repeat(70));
    console.log("Migration report");
    console.log("=".repeat(70));
    console.log(`- startedAt: ${stats.startedAt.toISOString()}`);
    console.log(`- finishedAt: ${stats.finishedAt.toISOString()}`);
    console.log(`- durationMs: ${durationMs}`);
    console.log(`- scanned: ${stats.scanned}`);
    console.log(`- skippedAlreadyMigrated: ${stats.skippedAlreadyMigrated}`);
    console.log(`- updatedRawMaterials: ${stats.updatedRawMaterials}`);
    console.log(`- createdRawMaterialTypes: ${stats.createdRawMaterialTypes}`);
    console.log(`- createdRawMaterialsFromMultiSpec: ${stats.createdRawMaterialsFromMultiSpec}`);
    console.log(`- uniquenessCollisions: ${stats.uniquenessCollisions}`);
    console.log(`- missingDimensionsForMultiSpec: ${stats.missingDimensionsForMultiSpec}`);
    console.log(`- errors: ${stats.errors}`);
    console.log("");

    if (options.mode === "dry-run") {
      console.log("Dry-run mode: no database writes were executed.");
    } else {
      console.log(`Created RawMaterialType ids: ${createdTypeIds.length}`);
      console.log(`Created RawMaterial ids: ${createdRawMaterialIds.length}`);
    }
  };

  try {
    const execMigration = async () => {
      const query = options.includeAlreadyMigrated ? {} : { materialType: { $exists: false } };
      const cursor = RawMaterial.find(query).cursor();

      let processed = 0;
      for await (const doc of cursor) {
        await migrateOne(doc as RawMaterialDocument);
        processed += 1;
        if (options.limit != null && processed >= options.limit) {
          break;
        }
        if (processed % 250 === 0) {
          console.log(`[${nowIso()}] Progress: scanned=${stats.scanned}, updated=${stats.updatedRawMaterials}`);
        }
      }
    };

    if (session && options.useTransaction) {
      if (options.mode === "commit") {
        await session.withTransaction(async () => {
          await execMigration();
        });
      } else {
        session.startTransaction();
        await execMigration();
        await session.abortTransaction();
      }
    } else {
      await execMigration();
    }
  } catch (err: any) {
    stats.errors += 1;
    console.error(`[${nowIso()}] Migration error:`, err?.message ?? err);
    if (session) {
      await session.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession();
    }
    await reportAndFinish();
    await mongoose.disconnect().catch(() => {});
    console.log(`[${nowIso()}] Disconnected from MongoDB.`);
  }
};

run().catch(() => {
  process.exit(1);
});

