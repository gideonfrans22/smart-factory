export interface RawMaterialDTO {
  materialCode: string;
  name: string;
  description?: string;
  supplier?: string;
  unit?: string;
  currentStock?: number;
}

export interface RawMaterialUpdateDTO extends Partial<RawMaterialDTO> {}

export interface RawMaterialListFilters {
  supplier?: string;
  search?: string;
  page?: number;
  limit?: number;
}
