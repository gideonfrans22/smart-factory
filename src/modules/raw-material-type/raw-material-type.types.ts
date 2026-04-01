/** Uniqueness is enforced on the active (non-deleted) pair (code, name) after trim. */
export interface RawMaterialTypeCreateDTO {
  code: string;
  name: string;
}

/** Changing code and/or name is validated against the active (code, name) unique pair. */
export interface RawMaterialTypeUpdateDTO {
  code?: string;
  name?: string;
}

export interface RawMaterialTypeListQuery {
  page?: number;
  limit?: number;
  search?: string;
}
