export interface AlertRepo {
  countUnresolvedCriticalHighOnDevice(deviceId: string): Promise<number>;
}
