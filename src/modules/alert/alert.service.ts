import mongoose from "mongoose";
import { mongoAlertRepository } from "./adapters/mongo/alert.repository";
import { mongooseDeviceForAlertAdapter } from "./adapters/device/device-for-alert.adapter";
import { realtimeAlertNotifier } from "./adapters/realtime/alert.notifier";
import { mongooseTaskForAlertAdapter } from "./adapters/task/task-for-alert.adapter";
import { acknowledgeAlert } from "./domain/alert.acknowledge";
import {
  bulkAcknowledgeAlerts,
  bulkReadAlerts,
  bulkResolveAlerts
} from "./domain/alert.bulk";
import { createAlert } from "./domain/alert.create";
import { deleteAlert } from "./domain/alert.delete";
import { markReadAlert } from "./domain/alert.mark-read";
import { resolveAlert } from "./domain/alert.resolve";
import { resolveEmergencyAlert } from "./domain/alert.resolve-emergency";
import { buildAlertStats, toStatsRow } from "./domain/alert.stats";
import { AlertDomainError } from "./domain/errors";
import { AlertServiceError } from "./alert.service-error";
import type { AlertDocument } from "./alert.model";
import type {
  AlertBulkIdsDTO,
  AlertCreateDTO,
  AlertListFilters,
  AlertListResult,
  AlertResolveEmergencyDTO,
  AlertStatsResult,
  BulkResult
} from "./alert.types";

export type { AlertListResult, BulkResult, AlertStatsResult } from "./alert.types";
export { AlertServiceError } from "./alert.service-error";

function mapDomainError(error: AlertDomainError): AlertServiceError {
  return new AlertServiceError({
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    message: error.message,
    data: error.data
  });
}

export class AlertService {
  constructor(
    private readonly repo = mongoAlertRepository,
    private readonly notifier = realtimeAlertNotifier,
    private readonly taskPort = mongooseTaskForAlertAdapter,
    private readonly devicePort = mongooseDeviceForAlertAdapter
  ) {}

  async list(filters: AlertListFilters): Promise<AlertListResult> {
    return this.repo.list(filters);
  }

  async getById(id: string): Promise<AlertDocument | null> {
    return this.repo.getByIdPopulated(id);
  }

  async create(
    data: AlertCreateDTO & { metadata?: Record<string, unknown> },
    userId?: mongoose.Types.ObjectId
  ): Promise<{ alert: AlertDocument; emergencyActions?: Record<string, unknown> }> {
    return createAlert(
      {
        repo: this.repo,
        task: this.taskPort,
        device: this.devicePort,
        notifier: this.notifier
      },
      {
        data,
        modifiedBy: userId?.toString()
      }
    );
  }

  async acknowledge(
    id: string,
    userId?: mongoose.Types.ObjectId
  ): Promise<AlertDocument | null> {
    try {
      return await acknowledgeAlert(
        { repo: this.repo, notifier: this.notifier },
        { id, userId: userId?.toString() }
      );
    } catch (e) {
      if (e instanceof AlertDomainError) {
        throw mapDomainError(e);
      }
      throw e;
    }
  }

  async markRead(id: string): Promise<AlertDocument | null> {
    try {
      return await markReadAlert({ repo: this.repo }, { id });
    } catch (e) {
      if (e instanceof AlertDomainError) {
        throw mapDomainError(e);
      }
      throw e;
    }
  }

  async resolve(
    id: string,
    resolvedByUserId?: string
  ): Promise<AlertDocument | null> {
    try {
      return await resolveAlert(
        {
          repo: this.repo,
          device: this.devicePort,
          notifier: this.notifier
        },
        { id, resolvedByUserId }
      );
    } catch (e) {
      if (e instanceof AlertDomainError) {
        throw mapDomainError(e);
      }
      throw e;
    }
  }

  async bulkRead(body: AlertBulkIdsDTO): Promise<BulkResult> {
    return bulkReadAlerts({ repo: this.repo }, body);
  }

  async bulkAcknowledge(
    body: AlertBulkIdsDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<BulkResult> {
    return bulkAcknowledgeAlerts(
      { repo: this.repo },
      body,
      userId?.toString()
    );
  }

  async bulkResolve(
    body: AlertBulkIdsDTO,
    resolvedByUserId?: string
  ): Promise<BulkResult> {
    return bulkResolveAlerts(
      {
        repo: this.repo,
        device: this.devicePort,
        notifier: this.notifier
      },
      body,
      resolvedByUserId
    );
  }

  async delete(id: string): Promise<AlertDocument | null> {
    return deleteAlert({ repo: this.repo }, { id });
  }

  async resolveEmergency(
    id: string,
    body: AlertResolveEmergencyDTO,
    resolvedByName?: string
  ): Promise<{ alert: AlertDocument; actionsPerformed: Record<string, unknown> } | null> {
    try {
      return await resolveEmergencyAlert(
        {
          repo: this.repo,
          task: this.taskPort,
          device: this.devicePort,
          notifier: this.notifier
        },
        { id, body, resolvedByName }
      );
    } catch (e) {
      if (e instanceof AlertDomainError) {
        throw mapDomainError(e);
      }
      throw e;
    }
  }

  async getStats(): Promise<AlertStatsResult> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);

    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 14);
    const previousPeriodEnd = new Date();
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 7);

    const [
      currentPeriodAlerts,
      previousPeriodAlerts,
      todayAlerts,
      allAlerts
    ] = await Promise.all([
      this.repo.findAlertsCreatedFrom(currentPeriodStart),
      this.repo.findAlertsCreatedBetween(previousPeriodStart, previousPeriodEnd),
      this.repo.findAlertsCreatedInDay(todayStart, todayEnd),
      this.repo.findAllAlerts()
    ]);

    return buildAlertStats({
      currentPeriod: currentPeriodAlerts.map(toStatsRow),
      previousPeriod: previousPeriodAlerts.map(toStatsRow),
      todayNewAlerts: todayAlerts.length,
      all: allAlerts.map(toStatsRow)
    });
  }
}

export const alertService = new AlertService();
