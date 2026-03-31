import { ProjectDeviceConfiguration } from "@shared/models";
import type { ProjectDeviceConfigurationRepo } from "../../ports/ProjectDeviceConfigurationRepo";

export class MongoProjectDeviceConfigurationRepository
  implements ProjectDeviceConfigurationRepo
{
  async findByProjectId(
    projectId: string
  ): Promise<{ byDeviceType?: unknown } | null> {
    const doc = await ProjectDeviceConfiguration.findOne({ projectId })
      .select({ byDeviceType: 1 })
      .lean();
    if (!doc) {
      return null;
    }
    return { byDeviceType: (doc as { byDeviceType?: unknown }).byDeviceType };
  }
}

export const mongoProjectDeviceConfigurationRepository =
  new MongoProjectDeviceConfigurationRepository();

