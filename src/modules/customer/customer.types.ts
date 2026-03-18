export interface CustomerDTO {
  name: string;
  personInCharge: string;
  department?: string;
  notes?: string;
}

export interface CustomerUpdateDTO extends Partial<CustomerDTO> {}

export interface CustomerFilters {
  search?: string;
  department?: string;
  page?: number;
  limit?: number;
}
