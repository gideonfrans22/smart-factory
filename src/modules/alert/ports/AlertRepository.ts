import type { AlertDocument } from "../alert.model";
import type {
  AlertBulkIdsDTO,
  AlertCreateDTO,
  AlertListFilters,
  AlertListResult,
  BulkResult
} from "../alert.types";

export interface NewAlertPersistenceInput {
  type: AlertCreateDTO["type"];
  level: AlertCreateDTO["level"];
  title: string;
  message: string;
  source?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Resolved refs (related-entity spread overrides DTO ids, matching legacy service) */
  device?: string;
  task?: string;
  project?: string;
  reportedBy?: string;
  metadata: Record<string, unknown>;
  status: NonNullable<AlertCreateDTO["status"]> | "UNREAD";
  modifiedBy?: string;
}

export interface AlertRepository {
  list(filters: AlertListFilters): Promise<AlertListResult>;
  getByIdPopulated(id: string): Promise<AlertDocument | null>;
  findById(id: string): Promise<AlertDocument | null>;
  findByIdWithEmergencyPopulate(id: string): Promise<AlertDocument | null>;
  save(alert: AlertDocument): Promise<void>;
  populateAcknowledgedBy(alert: AlertDocument): Promise<void>;
  insertNew(input: NewAlertPersistenceInput): Promise<AlertDocument>;
  deleteById(id: string): Promise<AlertDocument | null>;
  bulkRead(body: AlertBulkIdsDTO): Promise<BulkResult>;
  bulkAcknowledge(alertIds: string[], userId?: string): Promise<BulkResult>;
  bulkMarkResolved(alertIds: string[]): Promise<BulkResult>;
  findUnresolvedMachineErrorAlerts(alertIds: string[]): Promise<AlertDocument[]>;
  findAlertsCreatedFrom(from: Date): Promise<AlertDocument[]>;
  findAlertsCreatedBetween(from: Date, toExclusive: Date): Promise<AlertDocument[]>;
  findAlertsCreatedInDay(start: Date, end: Date): Promise<AlertDocument[]>;
  findAllAlerts(): Promise<AlertDocument[]>;
  countUnresolvedCriticalHighOnDevice(deviceId: string): Promise<number>;
}
