export interface RawMaterialDTO {
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

export interface RawMaterialUpdateDTO extends Partial<RawMaterialDTO> {}

export interface RawMaterialListFilters {
  supplier?: string;
  search?: string;
  page?: number;
  limit?: number;
}
