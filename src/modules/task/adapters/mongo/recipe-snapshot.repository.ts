import { RecipeSnapshot } from "@shared/models";
import type {
  RecipeSnapshotReadModel,
  RecipeSnapshotRepo
} from "../../ports/RecipeSnapshotRepo";

export class MongoRecipeSnapshotRepository implements RecipeSnapshotRepo {
  async findById(id: string): Promise<RecipeSnapshotReadModel | null> {
    const snap = await RecipeSnapshot.findById(id)
      .select({ name: 1, originalRecipeId: 1, steps: 1 })
      .lean();
    if (!snap) {
      return null;
    }

    const stepsRaw =
      (snap as {
        steps?: Array<{
          _id: unknown;
          name?: unknown;
          description?: unknown;
          order?: unknown;
          deviceTypeId?: unknown;
          estimatedDuration?: unknown;
        }>;
      }).steps ?? [];

    return {
      id: String((snap as { _id: unknown })._id),
      originalRecipeId: String((snap as { originalRecipeId: unknown }).originalRecipeId),
      name: String((snap as { name?: unknown }).name ?? ""),
      steps: stepsRaw
        .filter((s) => s.deviceTypeId != null)
        .map((s) => ({
          id: String(s._id),
          name: String(s.name ?? ""),
          description: s.description == null ? undefined : String(s.description),
          order: Number(s.order ?? 0),
          deviceTypeId: String(s.deviceTypeId),
          estimatedDuration:
            s.estimatedDuration == null ? undefined : Number(s.estimatedDuration)
        }))
    };
  }
}

export const mongoRecipeSnapshotRepository = new MongoRecipeSnapshotRepository();

