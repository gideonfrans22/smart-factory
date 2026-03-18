import { AlertLevel, AlertStatus, AlertType } from "../../../api_spec/types/alert";

export interface AlertListFilters {
  type?: AlertType;
  level?: AlertLevel;
  status?: AlertStatus;
  source?: string;
  reportedBy?: string;
  deviceId?: string;
  taskId?: string;
  projectId?: string;
  relatedEntityType?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  page?: number;
  limit?: number;
}

export interface AlertCreateDTO {
  type: AlertType;
  level: AlertLevel;
  title: string;
  message: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  deviceId?: string;
  taskId?: string;
  projectId?: string;
  reportedBy?: string;
  status?: AlertStatus;
  metadata?: Record<string, any>;
}

export interface AlertUpdateDTO {
  type?: AlertType;
  level?: AlertLevel;
  title?: string;
  message?: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  status?: AlertStatus;
  metadata?: Record<string, any>;
}

export interface AlertBulkIdsDTO {
  alertIds: string[];
}

export interface AlertResolveEmergencyDTO {
  resolvedBy?: string;
  resolutionNotes?: string;
}
