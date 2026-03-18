export interface RecipeListFilters {
  recipeNumber?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RecipeListResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RecipeRawMaterialInput {
  materialId: string;
  quantityRequired: number;
  specification?: any;
}

export interface RecipeStepInput {
  order?: number;
  name: string;
  description?: string;
  estimatedDuration: number;
  deviceTypeId: string;
  qualityChecks?: string[];
  dependsOn?: string[];
  mediaIds?: string[];
}

export interface RecipeCreateDTO {
  recipeNumber?: string;
  name: string;
  description?: string;
  rawMaterials?: RecipeRawMaterialInput[];
  product: string;
  steps: RecipeStepInput[];
  dwgNo?: string;
  unit?: string;
  outsourcing?: string;
  remarks?: string;
  mediaIds?: string[];
}

export type RecipeUpdateDTO = Partial<Omit<RecipeCreateDTO, "product">>;

export interface RecipeCreateVersionDTO {
  name?: string;
  description?: string;
  steps?: RecipeStepInput[];
}
