import mongoose from "mongoose";
import type { AlertRepo } from "@modules/task/ports/AlertRepo";
import { Alert, type AlertDocument } from "../../alert.model";
import type {
  AlertBulkIdsDTO,
  AlertListFilters,
  AlertListResult,
  BulkResult
} from "../../alert.types";
import type {
  AlertRepository,
  NewAlertPersistenceInput
} from "../../ports/AlertRepository";

function toOid(id: string): mongoose.Types.ObjectId | string {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return id;
  }
}

export class MongoAlertRepository implements AlertRepository, AlertRepo {
  async countUnresolvedCriticalHighOnDevice(deviceId: string): Promise<number> {
    return Alert.countDocuments({
      device: deviceId,
      level: { $in: ["CRITICAL", "HIGH"] },
      status: { $nin: ["ACKNOWLEDGED", "RESOLVED"] }
    });
  }

  async list(filters: AlertListFilters): Promise<AlertListResult> {
    const {
      type,
      status,
      level,
      deviceId,
      taskId,
      projectId,
      reportedBy,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      source,
      relatedEntityType
    } = filters;

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const sortField = sortBy;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObject: Record<string, 1 | -1> = {
      [sortField]: sortDirection
    };

    let total: number;
    let alerts: unknown[];

    if (search) {
      const searchRegex = new RegExp(search, "i");
      const baseFilters: Record<string, unknown> = {};

      if (type) baseFilters.type = type;
      if (status) baseFilters.status = status;
      if (level) baseFilters.level = level;
      if (source) baseFilters.source = source;
      if (relatedEntityType) {
        baseFilters.relatedEntityType = relatedEntityType;
      }
      if (deviceId) baseFilters.device = toOid(deviceId);
      if (taskId) baseFilters.task = toOid(taskId);
      if (projectId) baseFilters.project = toOid(projectId);
      if (reportedBy) baseFilters.reportedBy = toOid(reportedBy);

      const searchConditions = {
        $or: [
          { title: searchRegex },
          { message: searchRegex },
          {
            $expr: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $objectToArray: "$metadata" },
                      as: "field",
                      cond: {
                        $regexMatch: {
                          input: { $toString: "$$field.v" },
                          regex: search,
                          options: "i"
                        }
                      }
                    }
                  }
                },
                0
              ]
            }
          }
        ]
      };

      const matchStage: Record<string, unknown> =
        Object.keys(baseFilters).length > 0
          ? { $and: [baseFilters, searchConditions] }
          : { ...searchConditions };

      const aggregationPipeline = [
        { $match: matchStage },
        { $sort: sortObject },
        { $skip: skip },
        { $limit: limitNum }
      ] as mongoose.PipelineStage[];

      const countResult = await Alert.aggregate([
        { $match: matchStage },
        { $count: "total" }
      ] as mongoose.PipelineStage[]);

      total = countResult.length > 0 ? countResult[0].total : 0;

      alerts = await Alert.aggregate(aggregationPipeline);
      alerts = await Alert.populate(alerts, [
        { path: "acknowledgedBy", select: "name username email" },
        { path: "reportedBy", select: "name username email" },
        {
          path: "device",
          populate: { path: "deviceTypeId", select: "name" }
        },
        { path: "task" },
        { path: "project" }
      ]);
    } else {
      const query: Record<string, unknown> = {};
      if (type) query.type = type;
      if (status) query.status = status;
      if (level) query.level = level;
      if (source) query.source = source;
      if (relatedEntityType) {
        query.relatedEntityType = relatedEntityType;
      }
      if (deviceId) query.device = deviceId;
      if (taskId) query.task = taskId;
      if (projectId) query.project = projectId;
      if (reportedBy) query.reportedBy = reportedBy;

      total = await Alert.countDocuments(query);
      const found = await Alert.find(query)
        .populate("acknowledgedBy", "name username email")
        .populate("reportedBy", "name username email")
        .populate({
          path: "device",
          populate: { path: "deviceTypeId", select: "name" }
        })
        .populate("task")
        .populate("project")
        .skip(skip)
        .limit(limitNum)
        .sort(sortObject);
      alerts = found;
    }

    const transformedAlerts = alerts.map((alert: unknown) => {
      const doc = alert as {
        toObject?: () => Record<string, unknown>;
      };
      const alertObj = doc.toObject ? doc.toObject() : { ...(alert as object) };

      if (alertObj.device && typeof alertObj.device === "object") {
        const dev = alertObj.device as Record<string, unknown>;
        alertObj.deviceName = dev.name || null;
        if (
          dev.deviceTypeId &&
          typeof dev.deviceTypeId === "object"
        ) {
          alertObj.deviceTypeName =
            (dev.deviceTypeId as { name?: string }).name || null;
        }
      }

      if (alertObj.reportedBy && typeof alertObj.reportedBy === "object") {
        const rep = alertObj.reportedBy as {
          name?: string;
          username?: string;
        };
        alertObj.reporterName = rep.name || rep.username || null;
      }

      return alertObj;
    });

    return {
      items: transformedAlerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async getByIdPopulated(id: string): Promise<AlertDocument | null> {
    return Alert.findById(id)
      .populate("acknowledgedBy", "name username")
      .populate({
        path: "device",
        populate: { path: "deviceTypeId", select: "name" }
      })
      .populate("task")
      .populate("project")
      .exec();
  }

  async findById(id: string): Promise<AlertDocument | null> {
    return Alert.findById(id);
  }

  async findByIdWithEmergencyPopulate(id: string): Promise<AlertDocument | null> {
    return Alert.findById(id)
      .populate("device")
      .populate("task")
      .populate("project")
      .exec();
  }

  async save(alert: AlertDocument): Promise<void> {
    const raw = (alert as { acknowledgedBy?: unknown }).acknowledgedBy;
    if (
      typeof raw === "string" &&
      mongoose.Types.ObjectId.isValid(raw)
    ) {
      (alert as { acknowledgedBy?: mongoose.Types.ObjectId }).acknowledgedBy =
        new mongoose.Types.ObjectId(raw);
    }
    await alert.save();
  }

  async populateAcknowledgedBy(alert: AlertDocument): Promise<void> {
    await alert.populate("acknowledgedBy", "name username email");
  }

  async insertNew(input: NewAlertPersistenceInput): Promise<AlertDocument> {
    const { modifiedBy, reportedBy, ...rest } = input;

    const reportedByRef = reportedBy
      ? mongoose.Types.ObjectId.isValid(reportedBy)
        ? new mongoose.Types.ObjectId(reportedBy)
        : reportedBy
      : undefined;

    const modifiedByRef = modifiedBy
      ? new mongoose.Types.ObjectId(modifiedBy)
      : undefined;

    const alert = new Alert({
      type: rest.type,
      level: rest.level,
      title: rest.title,
      message: rest.message,
      source: rest.source,
      relatedEntityType: rest.relatedEntityType,
      relatedEntityId: rest.relatedEntityId,
      device: rest.device,
      task: rest.task,
      project: rest.project,
      reportedBy: reportedByRef,
      metadata: rest.metadata,
      status: rest.status,
      modifiedBy: modifiedByRef
    });

    await alert.save();
    return alert;
  }

  async deleteById(id: string): Promise<AlertDocument | null> {
    return Alert.findByIdAndDelete(id).exec();
  }

  async bulkRead(body: AlertBulkIdsDTO): Promise<BulkResult> {
    const { alertIds } = body;

    const result = await Alert.updateMany(
      {
        _id: { $in: alertIds },
        acknowledgedAt: { $exists: false }
      },
      {
        $set: {
          status: "READ",
          acknowledgedAt: new Date()
        }
      }
    );

    await Alert.updateMany(
      {
        _id: { $in: alertIds },
        acknowledgedAt: { $exists: true }
      },
      {
        $set: {
          status: "READ"
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0
    };
  }

  async bulkAcknowledge(
    alertIds: string[],
    userId?: string
  ): Promise<BulkResult> {
    const updateFields: Record<string, unknown> = {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date()
    };

    if (userId) {
      updateFields.acknowledgedBy = new mongoose.Types.ObjectId(userId);
    }

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      { $set: updateFields }
    );

    return {
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0
    };
  }

  async bulkMarkResolved(alertIds: string[]): Promise<BulkResult> {
    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date()
        }
      }
    );

    return {
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0
    };
  }

  async findUnresolvedMachineErrorAlerts(
    alertIds: string[]
  ): Promise<AlertDocument[]> {
    return Alert.find({
      _id: { $in: alertIds },
      type: "MACHINE_ERROR",
      status: { $ne: "RESOLVED" }
    });
  }

  async findAlertsCreatedFrom(from: Date): Promise<AlertDocument[]> {
    return Alert.find({ createdAt: { $gte: from } });
  }

  async findAlertsCreatedBetween(
    from: Date,
    toExclusive: Date
  ): Promise<AlertDocument[]> {
    return Alert.find({
      createdAt: {
        $gte: from,
        $lt: toExclusive
      }
    });
  }

  async findAlertsCreatedInDay(start: Date, end: Date): Promise<AlertDocument[]> {
    return Alert.find({
      createdAt: {
        $gte: start,
        $lte: end
      }
    });
  }

  async findAllAlerts(): Promise<AlertDocument[]> {
    return Alert.find({});
  }
}

export const mongoAlertRepository = new MongoAlertRepository();
