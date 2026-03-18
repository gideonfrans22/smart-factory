export interface DeviceTypeDTO {
  name: string;
  description?: string;
  specifications?: Record<string, any>;
  validRecipeStepNames?: string[];
}

export interface DeviceTypeUpdateDTO extends Partial<DeviceTypeDTO> {}

export interface DeviceTypeListResult {
  count: number;
  items: any[];
}
