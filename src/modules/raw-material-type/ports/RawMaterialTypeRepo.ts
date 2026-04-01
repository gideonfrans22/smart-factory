export interface RawMaterialTypeRecord {
  id: string;
  code: string;
  name: string;
  deletedAt: Date | null;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawMaterialTypeListParams {
  page: number;
  limit: number;
  search?: string;
}

export interface RawMaterialTypeListResult {
  items: RawMaterialTypeRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface RawMaterialTypeInsertInput {
  code: string;
  name: string;
  createdBy?: string;
}

export interface RawMaterialTypeUpdateInput {
  code?: string;
  name?: string;
  updatedBy?: string;
}

export interface RawMaterialTypeRepo {
  findActiveById(id: string): Promise<RawMaterialTypeRecord | null>;
  findAnyById(id: string): Promise<RawMaterialTypeRecord | null>;
  findActiveByCodeAndName(
    code: string,
    name: string
  ): Promise<RawMaterialTypeRecord | null>;
  findOrCreateActiveByCodeAndName(input: {
    code: string;
    name: string;
    createdBy?: string;
  }): Promise<RawMaterialTypeRecord>;
  listActive(params: RawMaterialTypeListParams): Promise<RawMaterialTypeListResult>;
  insert(input: RawMaterialTypeInsertInput): Promise<RawMaterialTypeRecord>;
  updateActive(
    id: string,
    input: RawMaterialTypeUpdateInput
  ): Promise<RawMaterialTypeRecord | null>;
  applySoftDelete(id: string, deletedBy?: string): Promise<void>;
}
