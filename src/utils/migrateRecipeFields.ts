/**
 * Migration script to add new fields to existing Recipe documents
 * 
 * Run this script once after deploying the new Recipe schema changes:
 * npx ts-node src/utils/migrateRecipeFields.ts
 * 
 * Or add to package.json scripts:
 * "migrate:recipe-fields": "ts-node src/utils/migrateRecipeFields.ts"
 */

import { Recipe } from "../models/Recipe";
import { connectDB } from "../config/database";

async function migrateRecipeFields() {
  try {
    console.log("🚀 Starting Recipe fields migration...");

    // Connect to database
    await connectDB();
    console.log("✅ Connected to database");

    // Get all recipes
    const recipes = await Recipe.find({});
    console.log(`📦 Found ${recipes.length} recipes to migrate`);

    if (recipes.length === 0) {
      console.log("✅ No recipes found. Migration complete.");
      process.exit(0);
    }

    // Update each recipe with new fields (default values)
    const updatePromises = recipes.map(async (recipe) => {
      // Only update if fields are missing
      const updateFields: any = {};

      if (!recipe.partNo) updateFields.partNo = "N/A";
      if (!recipe.dwgNo) updateFields.dwgNo = "N/A";
      if (!recipe.material) updateFields.material = "N/A";
      if (!recipe.unit) updateFields.unit = "EA";
      if (!recipe.outsourcing) updateFields.outsourcing = "N/A";
      if (!recipe.remarks) updateFields.remarks = "N/A";

      // Only update if there are fields to update
      if (Object.keys(updateFields).length > 0) {
        await Recipe.updateOne({ _id: recipe._id }, { $set: updateFields });
        console.log(`✅ Updated recipe: ${recipe.name} (${recipe._id})`);
        return 1;
      }

      console.log(`⏭️  Skipped recipe (already migrated): ${recipe.name}`);
      return 0;
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.reduce((sum: number, count) => sum + count, 0);

    console.log("\n📊 Migration Summary:");
    console.log(`   Total recipes: ${recipes.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${recipes.length - updatedCount}`);
    console.log("\n✅ Recipe fields migration completed successfully!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateRecipeFields();
}

export default migrateRecipeFields;
