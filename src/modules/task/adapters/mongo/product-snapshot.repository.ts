import { ProductSnapshot } from "@shared/models";
import type { ProductSnapshotRepo } from "../../ports/ProductSnapshotRepo";

export class MongoProductSnapshotRepository implements ProductSnapshotRepo {
  async findById(
    id: string
  ): Promise<
    | {
        recipes: Array<{ recipeSnapshotId: string; quantity: number }>;
      }
    | null
  > {
    const snap = await ProductSnapshot.findById(id)
      .select({ recipes: 1 })
      .lean();
    if (!snap) {
      return null;
    }
    const recipes =
      (snap as { recipes?: Array<{ recipeSnapshotId?: unknown; quantity?: unknown }> })
        .recipes ?? [];
    return {
      recipes: recipes
        .filter((r) => r.recipeSnapshotId != null)
        .map((r) => ({
          recipeSnapshotId: String(r.recipeSnapshotId),
          quantity: Number(r.quantity ?? 0)
        }))
    };
  }
}

export const mongoProductSnapshotRepository = new MongoProductSnapshotRepository();

