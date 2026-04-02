export interface DeviceForAlertPort {
  setMaintenanceIfNotAlready(params: {
    deviceId: string;
    errorReasonTitle: string;
    changedBy: string;
  }): Promise<{ previousStatus: string } | null>;

  setOnlineWithHistory(params: {
    deviceId: string;
    reason: string;
    changedBy: string;
  }): Promise<void>;

  restoreFromEmergencyMaintenance(params: {
    deviceId: string;
    previousStatus: string;
    reason: string;
    changedBy: string;
  }): Promise<{ displayName: string } | null>;
}
