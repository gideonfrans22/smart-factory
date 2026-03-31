export interface ProjectDeviceConfigurationRepo {
  /**
   * Returns the stored `byDeviceType` mapping for a project.
   * Shape is intentionally opaque at the port boundary; task generation normalizes it.
   */
  findByProjectId(
    projectId: string
  ): Promise<{ byDeviceType?: unknown } | null>;
}

