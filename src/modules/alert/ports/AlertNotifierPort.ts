export interface AlertAcknowledgedPayload {
  alertId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
  timestamp: number;
}

export interface AlertResolvedPayload {
  alertId: string;
  resolvedBy: string;
  resolvedAt: string;
  timestamp: number;
}

export interface AlertBulkResolvedPayload {
  alertIds: string[];
  resolvedBy: string;
  resolvedAt: string;
  count: number;
  timestamp: number;
}

export interface AlertNotifierPort {
  broadcastAlert(alertPlain: Record<string, unknown>): Promise<void>;
  broadcastTaskStatusChange(taskPlain: Record<string, unknown>): Promise<void>;
  broadcastDeviceUpdate(devicePlain: Record<string, unknown>): Promise<void>;
  emitAlertAcknowledged(payload: AlertAcknowledgedPayload): void;
  emitAlertResolved(payload: AlertResolvedPayload): void;
  emitAlertBulkResolved(payload: AlertBulkResolvedPayload): void;
}
