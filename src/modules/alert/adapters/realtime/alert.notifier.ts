import { getIO } from "@infra/config";
import { realtimeService } from "@shared/services";
import type {
  AlertAcknowledgedPayload,
  AlertBulkResolvedPayload,
  AlertNotifierPort,
  AlertResolvedPayload
} from "../../ports/AlertNotifierPort";

export class RealtimeAlertNotifier implements AlertNotifierPort {
  async broadcastAlert(alertPlain: Record<string, unknown>): Promise<void> {
    await realtimeService.broadcastAlert(alertPlain as never);
  }

  async broadcastTaskStatusChange(
    taskPlain: Record<string, unknown>
  ): Promise<void> {
    await realtimeService.broadcastTaskStatusChange(taskPlain as never);
  }

  async broadcastDeviceUpdate(
    devicePlain: Record<string, unknown>
  ): Promise<void> {
    await realtimeService.broadcastDeviceUpdate(devicePlain as never);
  }

  emitAlertAcknowledged(payload: AlertAcknowledgedPayload): void {
    const io = getIO();
    io.to("alerts").emit("alert:acknowledged", payload);
    io.to("global").emit("alert:acknowledged", payload);
  }

  emitAlertResolved(payload: AlertResolvedPayload): void {
    const io = getIO();
    io.to("alerts").emit("alert:resolved", payload);
    io.to("global").emit("alert:resolved", payload);
  }

  emitAlertBulkResolved(payload: AlertBulkResolvedPayload): void {
    const io = getIO();
    io.to("alerts").emit("alert:bulk-resolved", payload);
    io.to("global").emit("alert:bulk-resolved", payload);
  }
}

export const realtimeAlertNotifier = new RealtimeAlertNotifier();
