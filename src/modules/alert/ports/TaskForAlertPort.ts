export interface TaskForAlertPort {
  pauseOngoingForEmergency(params: {
    taskId: string;
    title: string;
    pausedBy: string;
  }): Promise<boolean>;

  resumeFromEmergency(params: {
    taskId: string;
    resolvedBy: string;
  }): Promise<{ taskLabel: string } | null>;
}
