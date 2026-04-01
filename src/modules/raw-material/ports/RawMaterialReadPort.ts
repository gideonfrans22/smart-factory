import type { RawMaterialListFilters } from "../raw-material.types";

export interface RawMaterialListResult {
  items: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RawMaterialReadPort {
  list(filters: RawMaterialListFilters): Promise<RawMaterialListResult>;
  getById(id: string): Promise<unknown | null>;
}

