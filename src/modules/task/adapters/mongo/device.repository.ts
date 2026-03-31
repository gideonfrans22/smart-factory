import { Device } from "@shared/models";
import mongoose from "mongoose";
import type { DeviceRepo } from "../../ports/DeviceRepo";

export class MongoDeviceRepository implements DeviceRepo {
  async assignCurrentTask(input: {
    deviceId: string;
    taskId: string;
    workerId: string;
  }): Promise<void> {
    const device = await Device.findById(input.deviceId);
    if (!device) {
      return;
    }
    device.currentTask = new mongoose.Types.ObjectId(input.taskId);
    device.currentUser = new mongoose.Types.ObjectId(input.workerId);
    await device.save();
  }

  async findForResumeCheck(
    deviceId: string
  ): Promise<{ status: string } | null> {
    const device = await Device.findById(deviceId).select("status").lean();
    if (!device) {
      return null;
    }
    return { status: device.status };
  }

  async clearCurrentAssignment(deviceId: string): Promise<void> {
    const device = await Device.findById(deviceId);
    if (!device) {
      return;
    }
    device.currentTask = undefined;
    device.currentUser = undefined;
    await device.save();
  }
}

export const mongoDeviceRepository = new MongoDeviceRepository();
