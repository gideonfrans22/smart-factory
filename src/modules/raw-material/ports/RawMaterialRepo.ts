export interface RawMaterialPersisted {
  id: string;
}

export interface RawMaterialUpdateReadModel {
  id: string;
  name: string;
}

export interface RawMaterialImportMaterial {
  materialCode: string;
  name: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
}

export interface RawMaterialImportSpecification {
  materialName: string;
  color?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: { value?: number; unit?: string };
  specSupplier?: string;
}

export interface RawMaterialImportLoadModel {
  id: string;
  name: string;
  specifications?: any[];
}

export interface RawMaterialRepo {
  findByNormalizedName(name: string): Promise<RawMaterialPersisted | null>;
  findByNormalizedNameExcludingId(
    name: string,
    excludeId: string
  ): Promise<RawMaterialPersisted | null>;

  loadForUpdate(id: string): Promise<RawMaterialUpdateReadModel | null>;
  listExistingNames(names: string[]): Promise<string[]>;
  create(input: {
    materialCode: string;
    name: string;
    description?: string;
    supplier?: string;
    unit?: string;
    currentStock?: number;
    modifiedBy?: string;
  }): Promise<unknown>;

  persistUpdate(input: {
    id: string;
    materialCode?: string;
    name?: string;
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

  loadForImportByNames(names: string[]): Promise<RawMaterialImportLoadModel[]>;

  persistSpecificationsForImport(input: {
    id: string;
    specifications: any[];
    modifiedBy?: string;
  }): Promise<void>;
}

