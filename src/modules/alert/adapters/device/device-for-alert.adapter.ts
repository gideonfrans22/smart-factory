import { Device } from "@modules/device/device.model";
import { realtimeService } from "@shared/services";
import type { DeviceForAlertPort } from "../../ports/DeviceForAlertPort";

export class MongooseDeviceForAlertAdapter implements DeviceForAlertPort {
  async setMaintenanceIfNotAlready(params: {
    deviceId: string;
    errorReasonTitle: string;
    changedBy: string;
  }): Promise<{ previousStatus: string } | null> {
    const device = await Device.findById(params.deviceId);
    if (!device || device.status === "MAINTENANCE") {
      return null;
    }
    const previousStatus = device.status;
    device.status = "MAINTENANCE";
    (device as { errorReason?: string }).errorReason = params.errorReasonTitle;

    if (!device.statusHistory) {
      device.statusHistory = [];
    }
    device.statusHistory.push({
      status: "MAINTENANCE",
      changedAt: new Date(),
      reason: `Emergency: ${params.errorReasonTitle}`,
      changedBy: params.changedBy
    });

    await device.save();
    await realtimeService.broadcastDeviceUpdate(device.toObject());
    return { previousStatus };
  }

  async setOnlineWithHistory(params: {
    deviceId: string;
    reason: string;
    changedBy: string;
  }): Promise<void> {
    const device = await Device.findById(params.deviceId);
    if (!device) {
      return;
    }
    device.status = "ONLINE";
    if (!device.statusHistory) {
      device.statusHistory = [];
    }
    device.statusHistory.push({
      status: "ONLINE",
      changedAt: new Date(),
      reason: params.reason,
      changedBy: params.changedBy
    });
    await device.save();
    await realtimeService.broadcastDeviceUpdate(device.toObject());
  }

  async restoreFromEmergencyMaintenance(params: {
    deviceId: string;
    previousStatus: string;
    reason: string;
    changedBy: string;
  }): Promise<{ displayName: string } | null> {
    const device = await Device.findById(params.deviceId);
    if (!device || device.status !== "MAINTENANCE") {
      return null;
    }
    device.status = params.previousStatus as typeof device.status;
    (device as { errorReason?: string }).errorReason = undefined;

    if (!device.statusHistory) {
      device.statusHistory = [];
    }
    device.statusHistory.push({
      status: params.previousStatus,
      changedAt: new Date(),
      reason: params.reason,
      changedBy: params.changedBy
    });

    await device.save();
    await realtimeService.broadcastDeviceUpdate(device.toObject());
    const displayName =
      (device as { name?: string }).name || String(device._id);
    return { displayName };
  }
}

export const mongooseDeviceForAlertAdapter = new MongooseDeviceForAlertAdapter();
