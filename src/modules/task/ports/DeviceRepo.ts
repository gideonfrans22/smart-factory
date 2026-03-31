export interface DeviceRepo {
  assignCurrentTask(input: {
    deviceId: string;
    taskId: string;
    workerId: string;
  }): Promise<void>;
  findForResumeCheck(deviceId: string): Promise<{ status: string } | null>;
}
