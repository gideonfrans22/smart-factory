export interface ProductSnapshotRepo {
  findById(
    id: string
  ): Promise<
    | {
        recipes: Array<{ recipeSnapshotId: string; quantity: number }>;
      }
    | null
  >;
}

