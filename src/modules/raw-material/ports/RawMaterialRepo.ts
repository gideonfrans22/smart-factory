export interface RawMaterialPersisted {
  id: string;
}

export interface RawMaterialUpdateReadModel {
  id: string;
}

export interface RawMaterialImportMaterial {
  materialType: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit?: string;
  };
  weight?: { value?: number; unit?: string };
  color?: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
}

export interface RawMaterialRepo {
  loadForUpdate(id: string): Promise<RawMaterialUpdateReadModel | null>;
  create(input: {
    materialType: string;
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit?: string;
    };
    weight?: { value?: number; unit?: string };
    color?: string;
    description?: string;
    supplier?: string;
    unit?: string;
    currentStock?: number;
    modifiedBy?: string;
  }): Promise<unknown>;

  persistUpdate(input: {
    id: string;
    materialType?: string;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: string;
    };
    weight?: { value?: number; unit?: string };
    color?: string;
    description?: string;
    supplier?: string;
    unit?: string;
    currentStock?: number;
    modifiedBy?: string;
  }): Promise<unknown>;

  deleteById(id: string): Promise<unknown | null>;

  upsertForImport(
    material: RawMaterialImportMaterial,
    modifiedBy?: string
  ): Promise<{ created: boolean }>;
}

