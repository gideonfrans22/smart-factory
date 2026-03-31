import { Alert } from "@shared/models";
import type { AlertRepo } from "../../ports/AlertRepo";

export class MongoAlertRepository implements AlertRepo {
  async countUnresolvedCriticalHighOnDevice(
    deviceId: string
  ): Promise<number> {
    return Alert.countDocuments({
      device: deviceId,
      level: { $in: ["CRITICAL", "HIGH"] },
      status: { $nin: ["ACKNOWLEDGED", "RESOLVED"] }
    });
  }
}

export const mongoAlertRepository = new MongoAlertRepository();
