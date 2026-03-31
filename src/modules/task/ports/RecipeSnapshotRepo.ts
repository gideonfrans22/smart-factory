export interface RecipeSnapshotStepReadModel {
  id: string;
  name: string;
  description?: string;
  order: number;
  deviceTypeId: string;
  estimatedDuration?: number;
}

export interface RecipeSnapshotReadModel {
  id: string;
  originalRecipeId: string;
  name: string;
  steps: RecipeSnapshotStepReadModel[];
}

export interface RecipeSnapshotRepo {
  findById(id: string): Promise<RecipeSnapshotReadModel | null>;
}

