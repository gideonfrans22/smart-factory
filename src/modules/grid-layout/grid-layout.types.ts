import mongoose from "mongoose";

export interface IDevicePosition {
  deviceId: mongoose.Types.ObjectId;
  row: number;
  column: number;
  rowSpan: number;
  colSpan: number;
}

export interface GridLayoutDTO {
  name: string;
  description?: string;
  columns?: number;
  rows?: number;
  devices?: IDevicePosition[];
  isDefault?: boolean;
  isMonitorDisplay?: boolean;
}

export interface GridLayoutUpdateDTO extends Partial<GridLayoutDTO> {}

export interface GridLayoutListFilters {
  isMonitorDisplay?: boolean;
  page?: number;
  limit?: number;
}

export interface GridLayoutQueryParams {
  page: number;
  limit: number;
  isMonitorDisplay?: boolean;
}
