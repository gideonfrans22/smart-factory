import { Recipe, RecipeDocument } from "./recipe.model";
  import { RecipeDTO, RecipeFilters } from "./recipe.types";
  export class RecipeService {
    async list(filters: RecipeFilters = {}): Promise<RecipeDocument[]> {
      // TODO: apply filters
      return Recipe.find().exec();
    }
    async getById(id: string): Promise<RecipeDocument | null> {
      return Recipe.findById(id).exec();
    }
    async create(data: RecipeDTO): Promise<RecipeDocument> {
      const doc = new Recipe(data);
      return doc.save();
    }
    async update(id: string, data: Partial<RecipeDTO>): Promise<RecipeDocument | null> {
      return Recipe.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<RecipeDocument | null> {
      return Recipe.findByIdAndDelete(id).exec();
    }
  }
  export const recipeService = new RecipeService();
  