import { parseDateAsKST } from "@shared/helpers";
import {
  Device,
  IRecipeSnapshot,
  Product,
  Project,
  Recipe
} from "@shared/models";
import mongoose from "mongoose";
import type {
  TaskReadGroupedResult,
  TaskReadListPage,
  TaskReadPort,
  TaskReadWorkerListResult
} from "../../ports/TaskReadPort";
import { TaskServiceError } from "../../task.service-error";
import { Task } from "../../task.model";
import type {
  DeviceTaskQuery,
  TaskGroupedQuery,
  TaskListQuery,
  TaskStandaloneQuery,
  TaskStatisticsQuery,
  WorkerTaskQuery
} from "../../task.types";

export class MongoTaskReadRepository implements TaskReadPort {
  async listTasks(query: TaskListQuery): Promise<TaskReadListPage> {
    const {
      status,
      deviceId,
      deviceTypeId,
      projectId,
      recipeId,
      productId,
      priority,
      workerId,
      search,
      includePendingAndPartial,
      page = "1",
      limit = "10"
    } = query;

    const mongoQuery: Record<string, unknown> = {};

    if (includePendingAndPartial === "true") {
      mongoQuery.$or = [
        { status: "PENDING" },
        { status: "ONGOING" },
        { status: "PAUSED" },
        { status: "COMPLETED", progress: { $lt: 100 } }
      ];
    } else if (status) {
      mongoQuery.status = status;
    }

    if (deviceId) mongoQuery.deviceId = deviceId;
    if (deviceTypeId) mongoQuery.deviceTypeId = deviceTypeId;
    if (projectId) mongoQuery.projectId = projectId;
    if (recipeId) mongoQuery.recipeId = recipeId;
    if (productId) mongoQuery.productId = productId;
    if (workerId) mongoQuery.workerId = workerId;
    if (priority) mongoQuery.priority = priority;

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      const products = await Product.find({ name: searchRegex }).select("_id");
      const productIds = products.map((p) => p._id);

      if (recipeIds.length > 0 || productIds.length > 0) {
        const searchConditions: Record<string, unknown>[] = [];
        if (recipeIds.length > 0) {
          searchConditions.push({ recipeId: { $in: recipeIds } });
        }
        if (productIds.length > 0) {
          searchConditions.push({ productId: { $in: productIds } });
        }
        searchConditions.push({ title: searchRegex });

        if (mongoQuery.$or) {
          mongoQuery.$and = [
            { $or: mongoQuery.$or },
            { $or: searchConditions }
          ];
          delete mongoQuery.$or;
        } else {
          mongoQuery.$or = searchConditions;
        }
      } else {
        if (mongoQuery.$or) {
          mongoQuery.$and = [{ $or: mongoQuery.$or }, { title: searchRegex }];
          delete mongoQuery.$or;
        } else {
          mongoQuery.title = searchRegex;
        }
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);
    const tasks = await Task.find(mongoQuery)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity projectNumber"
      )
      .populate("workerId", "name username")
      .populate("deviceId", "name deviceName")
      .populate({
        path: "recipeSnapshotId",
        select: "name version steps",
        populate: {
          path: "rawMaterials",
          select: "quantityRequired name rawMaterialNumber specification"
        }
      })
      .populate(
        "productSnapshotId",
        "name version productNumber customerName personInCharge department"
      )
      .populate(
        "productId",
        "designNumber productName customerName personInCharge department"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return {
      items: tasks,
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

  async getTaskById(id: string): Promise<InstanceType<typeof Task>> {
    const task = await Task.findById(id)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity projectNumber"
      )
      .populate("workerId", "name username")
      .populate({
        path: "recipeSnapshotId",
        select: "name version steps",
        populate: {
          path: "rawMaterials",
          select: "quantityRequired name rawMaterialNumber specification"
        }
      })
      .populate(
        "productSnapshotId",
        "name version productNumber customerName personInCharge department"
      )
      .populate(
        "productId",
        "designNumber productName customerName personInCharge department"
      )
      .populate("dependentTask", "title status");

    if (!task) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Task not found"
      });
    }
    return task;
  }

  async listStandaloneTasks(query: TaskStandaloneQuery): Promise<TaskReadListPage> {
    const {
      status,
      deviceId,
      deviceTypeId,
      recipeId,
      workerId,
      search,
      page = "1",
      limit = "10"
    } = query;

    const mongoQuery: Record<string, unknown> = {
      projectId: { $exists: false }
    };

    if (status) mongoQuery.status = status;
    if (deviceId) mongoQuery.deviceId = deviceId;
    if (deviceTypeId) mongoQuery.deviceTypeId = deviceTypeId;
    if (recipeId) mongoQuery.recipeId = recipeId;
    if (workerId) mongoQuery.workerId = workerId;

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      if (recipeIds.length > 0) {
        mongoQuery.$or = [
          { recipeId: { $in: recipeIds } },
          { title: searchRegex }
        ];
      } else {
        mongoQuery.title = searchRegex;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);
    const tasks = await Task.find(mongoQuery)
      .populate("recipeId", "name recipeNumber version")
      .populate("recipeSnapshotId", "name version steps")
      .populate("workerId", "name username")
      .populate("deviceTypeId", "name")
      .populate("deviceId", "name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return {
      items: tasks,
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

  async listDeviceTasks(
    deviceId: string,
    query: DeviceTaskQuery
  ): Promise<TaskReadListPage> {
    if (!deviceId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "deviceId parameter is required"
      });
    }

    const { status, workerId, start, end, page = "1", limit = "10" } = query;

    const device = await Device.findById(deviceId)
      .select("deviceTypeId")
      .lean();
    if (!device) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Device not found"
      });
    }

    const deviceObjectId = new mongoose.Types.ObjectId(deviceId);
    const mongoQuery: Record<string, unknown> = {
      deviceTypeId: device.deviceTypeId,
      $or: [
        { deviceId: deviceObjectId },
        { deviceId: null },
        { deviceId: { $exists: false } }
      ]
    };

    if (status) mongoQuery.status = status;

    if (workerId) {
      const workerObjectId = new mongoose.Types.ObjectId(workerId);
      if (!mongoQuery.$and) mongoQuery.$and = [];
      (mongoQuery.$and as unknown[]).push({
        $or: [
          { workerId: workerObjectId },
          { workerId: null },
          { workerId: { $exists: false } }
        ]
      });
    }

    if (start || end) {
      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;
      const dateConditions: Record<string, unknown>[] = [];

      if (startDate) {
        dateConditions.push({
          $or: [
            { completedAt: { $gte: startDate } },
            { completedAt: null, createdAt: { $gte: startDate } }
          ]
        });
      }
      if (endDate) {
        dateConditions.push({
          $or: [
            { completedAt: { $lte: endDate } },
            { completedAt: null, createdAt: { $lte: endDate } }
          ]
        });
      }
      if (dateConditions.length > 0) {
        mongoQuery.$and = mongoQuery.$and || [];
        (mongoQuery.$and as unknown[]).push(...dateConditions);
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, tasks] = await Promise.all([
      Task.countDocuments(mongoQuery),
      Task.find(mongoQuery)
        .select(
          "title description projectId recipeId recipeSnapshotId productSnapshotId workerId deviceId deviceTypeId status priority progress notes createdAt updatedAt startedAt completedAt dependentTask mediaFiles recipeExecutionNumber totalRecipeExecutions stepOrder isLastStepInRecipe pausedDuration pauseHistory"
        )
        .populate(
          "projectId",
          "name status priority deadline startDate progress targetQuantity producedQuantity"
        )
        .populate("recipeId", "name recipeNumber version")
        .populate("workerId", "name username email")
        .populate("recipeSnapshotId", "name version steps")
        .populate(
          "productSnapshotId",
          "name productNumber customerName personInCharge department version"
        )
        .populate("mediaFiles", "url type filename")
        .populate("dependentTask", "title status")
        .skip(skip)
        .limit(limitNum)
        .sort({ completedAt: -1, createdAt: -1 })
        .lean()
    ]);

    return {
      items: tasks,
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

  async listWorkerTasks(
    workerId: string,
    query: WorkerTaskQuery
  ): Promise<TaskReadWorkerListResult> {
    if (!workerId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "workerId parameter is required"
      });
    }

    const { status, start, end, page = "1", limit = "10" } = query;

    const mongoQuery: Record<string, unknown> = { workerId };

    if (status) mongoQuery.status = status;

    if (start || end) {
      mongoQuery.$and = [];
      if (start) {
        (mongoQuery.$and as unknown[]).push({
          $or: [
            { createdAt: { $gte: new Date(start) } },
            { completedAt: { $gte: new Date(start) } }
          ]
        });
      }
      if (end) {
        (mongoQuery.$and as unknown[]).push({
          $or: [
            { createdAt: { $lte: new Date(end) } },
            { completedAt: { $lte: new Date(end) } }
          ]
        });
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);

    const tasks = await Task.find(mongoQuery)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity"
      )
      .populate("recipeId", "name recipeNumber version")
      .populate("deviceId", "name deviceName")
      .populate("recipeSnapshotId", "name version steps")
      .populate(
        "productSnapshotId",
        "name productNumber customerName personInCharge department version"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ completedAt: -1, createdAt: -1 });

    const [PENDING, ONGOING, PAUSED, COMPLETED, FAILED] = await Promise.all([
      Task.countDocuments({ ...mongoQuery, status: "PENDING" }),
      Task.countDocuments({ ...mongoQuery, status: "ONGOING" }),
      Task.countDocuments({ ...mongoQuery, status: "PAUSED" }),
      Task.countDocuments({ ...mongoQuery, status: "COMPLETED" }),
      Task.countDocuments({ ...mongoQuery, status: "FAILED" })
    ]);

    return {
      items: tasks,
      statistics: {
        totalTasks: total,
        byStatus: {
          PENDING,
          ONGOING,
          PAUSED,
          COMPLETED,
          FAILED
        }
      },
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

  async getTaskStatistics(
    query: TaskStatisticsQuery
  ): Promise<Record<string, unknown>> {
    const { projectId, deviceTypeId, workerId, startDate, endDate } = query;

    const baseQuery: Record<string, unknown> = {};
    if (projectId) baseQuery.projectId = projectId;
    else {
      const projects = await Project.find({ deletedAt: { $exists: false } });
      baseQuery.projectId = { $in: projects.map((p) => p._id) };
    }
    if (deviceTypeId) baseQuery.deviceTypeId = deviceTypeId;
    if (workerId) baseQuery.workerId = workerId;

    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) {
        (baseQuery.createdAt as Record<string, Date>).$gte = parseDateAsKST(
          startDate,
          false
        );
      }
      if (endDate) {
        (baseQuery.createdAt as Record<string, Date>).$lte = parseDateAsKST(
          endDate,
          true
        );
      }
    }

    const [
      statusCounts,
      priorityCounts,
      totalTasks,
      productTargetQuantity,
      completedTasks,
      overdueTasks,
      avgCompletionTime,
      tasksByDeviceType,
      tasksByProject,
      tasksByStepName,
      executionProgress
    ] = await Promise.all([
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } }
      ]),
      Task.countDocuments(baseQuery),
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$projectId" } },
        {
          $lookup: {
            from: "projects",
            localField: "_id",
            foreignField: "_id",
            as: "project"
          }
        },
        { $unwind: "$project" },
        {
          $group: {
            _id: null,
            totalTargetQuantity: { $sum: "$project.targetQuantity" }
          }
        }
      ]),
      Task.countDocuments({ ...baseQuery, status: "COMPLETED" }),
      Task.countDocuments({
        ...baseQuery,
        status: { $in: ["PENDING", "ONGOING", "PAUSED"] },
        estimatedDuration: { $exists: true },
        $expr: {
          $gt: [
            { $subtract: [new Date(), "$createdAt"] },
            { $multiply: ["$estimatedDuration", 60000] }
          ]
        }
      }),
      Task.aggregate([
        {
          $match: {
            ...baseQuery,
            status: "COMPLETED",
            actualDuration: { $exists: true, $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: "$actualDuration" },
            minDuration: { $min: "$actualDuration" },
            maxDuration: { $max: "$actualDuration" }
          }
        }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$deviceTypeId",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            }
          }
        },
        { $limit: 10 }
      ]),
      Task.aggregate([
        { $match: { ...baseQuery, projectId: { $exists: true } } },
        {
          $group: {
            _id: "$projectId",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
            },
            ongoing: {
              $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              recipeSnapshotId: "$recipeSnapshotId",
              stepOrder: "$stepOrder",
              status: "$status"
            },
            recipeTaskCount: { $count: {} }
          }
        },
        {
          $lookup: {
            from: "recipesnapshots",
            localField: "_id.recipeSnapshotId",
            foreignField: "_id",
            as: "recipeSnapshot"
          }
        },
        { $unwind: "$recipeSnapshot" },
        {
          $addFields: {
            stepName: {
              $arrayElemAt: [
                "$recipeSnapshot.steps.name",
                { $subtract: ["$_id.stepOrder", 1] }
              ]
            },
            status: "$_id.status"
          }
        },
        {
          $group: {
            _id: { stepName: "$stepName" },
            totalTaskCount: { $sum: "$recipeTaskCount" },
            completedTaskCount: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "COMPLETED"] },
                  "$recipeTaskCount",
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            stepName: "$_id.stepName",
            total: "$totalTaskCount",
            completed: "$completedTaskCount",
            completionRate: {
              $cond: [
                { $gt: ["$totalTaskCount", 0] },
                { $divide: ["$completedTaskCount", "$totalTaskCount"] },
                0
              ]
            }
          }
        }
      ]),
      Task.aggregate([
        {
          $match: {
            ...baseQuery,
            projectId: { $exists: true },
            recipeExecutionNumber: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              projectId: "$projectId",
              recipeId: "$recipeId",
              executionNumber: "$recipeExecutionNumber"
            },
            totalSteps: { $sum: 1 },
            completedSteps: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            },
            isLastStepCompleted: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isLastStepInRecipe", true] },
                      { $eq: ["$status", "COMPLETED"] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalExecutions: { $sum: 1 },
            completedExecutions: { $sum: "$isLastStepCompleted" }
          }
        }
      ])
    ]);

    const statusStats: Record<string, number> = {
      PENDING: 0,
      ONGOING: 0,
      PAUSED: 0,
      COMPLETED: 0,
      FAILED: 0
    };
    (statusCounts as { _id?: string; count: number }[]).forEach((item) => {
      if (item._id) statusStats[item._id] = item.count;
    });

    const priorityStats: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    };
    (priorityCounts as { _id?: string; count: number }[]).forEach((item) => {
      if (item._id) priorityStats[item._id] = item.count;
    });

    const completionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : "0";

    const completionTimeStats = (
      avgCompletionTime as {
        avgDuration?: number;
        minDuration?: number;
        maxDuration?: number;
      }[]
    )[0] || {
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0
    };

    const executionStats = (
      executionProgress as {
        totalExecutions?: number;
        completedExecutions?: number;
      }[]
    )[0] || {
      totalExecutions: 0,
      completedExecutions: 0
    };
    const executionCompletionRate =
      (executionStats.totalExecutions ?? 0) > 0
        ? (
            ((executionStats.completedExecutions ?? 0) /
              (executionStats.totalExecutions ?? 1)) *
            100
          ).toFixed(2)
        : "0";

    return {
      overview: {
        totalTasks,
        completedTasks,
        targetQuantity:
          (productTargetQuantity as { totalTargetQuantity?: number }[])[0]
            ?.totalTargetQuantity || 0,
        pendingTasks: statusStats.PENDING,
        ongoingTasks: statusStats.ONGOING,
        pausedTasks: statusStats.PAUSED,
        failedTasks: statusStats.FAILED,
        overdueTasks,
        completionRate: parseFloat(completionRate)
      },
      byStatus: statusStats,
      byPriority: priorityStats,
      completionTime: {
        average: Math.round(completionTimeStats.avgDuration || 0),
        min: completionTimeStats.minDuration || 0,
        max: completionTimeStats.maxDuration || 0,
        unit: "minutes"
      },
      byDeviceType: (
        tasksByDeviceType as {
          _id: unknown;
          count: number;
          completed: number;
        }[]
      ).map((item) => ({
        deviceTypeId: item._id,
        total: item.count,
        completed: item.completed,
        completionRate:
          item.count > 0
            ? parseFloat(((item.completed / item.count) * 100).toFixed(2))
            : 0
      })),
      byProject: (
        tasksByProject as {
          _id: unknown;
          count: number;
          completed: number;
          pending: number;
          ongoing: number;
        }[]
      ).map((item) => ({
        projectId: item._id,
        total: item.count,
        completed: item.completed,
        pending: item.pending,
        ongoing: item.ongoing,
        completionRate:
          item.count > 0
            ? parseFloat(((item.completed / item.count) * 100).toFixed(2))
            : 0
      })),
      byStepName: tasksByStepName,
      executionProgress: {
        totalExecutions: executionStats.totalExecutions ?? 0,
        completedExecutions: executionStats.completedExecutions ?? 0,
        completionRate: parseFloat(executionCompletionRate)
      }
    };
  }

  async getGroupedTasks(query: TaskGroupedQuery): Promise<TaskReadGroupedResult> {
    const {
      projectStatus,
      taskStatus,
      startDate,
      endDate,
      search,
      page = "1",
      limit = "10"
    } = query;

    const taskQuery: Record<string, unknown> = {
      projectId: { $exists: true, $ne: null }
    };

    if (taskStatus) taskQuery.status = taskStatus;

    if (startDate || endDate) {
      taskQuery.createdAt = {};
      if (startDate) {
        (taskQuery.createdAt as Record<string, Date>).$gte = parseDateAsKST(
          startDate,
          false
        );
      }
      if (endDate) {
        (taskQuery.createdAt as Record<string, Date>).$lte = parseDateAsKST(
          endDate,
          true
        );
      }
    }

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const projects = await Project.find({ name: searchRegex }).select("_id");
      const projectIds = projects.map((p) => p._id);
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      const products = await Product.find({ name: searchRegex }).select("_id");
      const productIds = products.map((p) => p._id);

      if (
        projectIds.length > 0 ||
        recipeIds.length > 0 ||
        productIds.length > 0
      ) {
        taskQuery.$or = [];
        if (projectIds.length > 0) {
          (taskQuery.$or as unknown[]).push({
            projectId: { $in: projectIds }
          });
        }
        if (recipeIds.length > 0) {
          (taskQuery.$or as unknown[]).push({ recipeId: { $in: recipeIds } });
        }
        if (productIds.length > 0) {
          (taskQuery.$or as unknown[]).push({
            productId: { $in: productIds }
          });
        }
      }
    }

    const distinctProjectIds = await Task.distinct("projectId", taskQuery);

    const projectQuery: Record<string, unknown> = {
      _id: { $in: distinctProjectIds }
    };

    if (projectStatus) projectQuery.status = projectStatus;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const totalProjects = await Project.countDocuments(projectQuery);

    const projects = await Project.find(projectQuery)
      .populate("createdBy", "name email username")
      .populate(
        "productSnapshot",
        "name productNumber personInCharge customerName version remarks"
      )
      .populate("recipeSnapshot", "name recipeNumber version dwgNo remarks")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const groupedData: Record<string, unknown> = {};

    for (const project of projects) {
      const projectIdStr = (project._id as mongoose.Types.ObjectId).toString();

      const projectTaskQuery = {
        ...taskQuery,
        projectId: project._id
      };

      const tasks = await Task.find(projectTaskQuery)
        .populate("workerId", "name username email")
        .populate("deviceId", "name deviceName")
        .populate("deviceTypeId", "name")
        .populate({
          path: "recipeSnapshotId",
          populate: { path: "rawMaterials" }
        })
        .populate(
          "productSnapshotId",
          "name version customerName personInCharge department"
        )
        .sort({ createdAt: 1 });

      groupedData[projectIdStr] = {
        projectInfo: {
          _id: project._id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          projectNumber: project.projectNumber,
          recipeSnapshot: project.recipeSnapshot,
          productSnapshot: project.productSnapshot,
          producedQuantity: project.producedQuantity,
          targetQuantity: project.targetQuantity,
          progress: project.progress,
          startDate: project.startDate,
          endDate: project.endDate,
          deadline: project.deadline,
          createdBy: project.createdBy,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        recipes: {},
        summary: {
          totalTasks: tasks.length,
          byStatus: {
            PENDING: 0,
            ONGOING: 0,
            PAUSED: 0,
            COMPLETED: 0,
            FAILED: 0
          },
          byPriority: {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            URGENT: 0
          }
        }
      };

      const g = groupedData[projectIdStr] as {
        recipes: Record<string, unknown>;
        summary: {
          byStatus: Record<string, number>;
          byPriority: Record<string, number>;
        };
      };

      for (const task of tasks) {
        g.summary.byStatus[task.status]++;
        g.summary.byPriority[task.priority]++;

        const recipeSnapshot =
          task.recipeSnapshotId as unknown as IRecipeSnapshot;
        const recipeSnapshotId = recipeSnapshot._id.toString();

        if (!g.recipes[recipeSnapshotId]) {
          g.recipes[recipeSnapshotId] = {
            recipeInfo: {
              ...recipeSnapshot.toObject(),
              _id: recipeSnapshot._id,
              name: recipeSnapshot.name,
              version: recipeSnapshot.version,
              recipeId: task.recipeId
            },
            steps: {},
            summary: {
              totalTasks: 0,
              totalExecutions: task.totalRecipeExecutions,
              completedExecutions: 0,
              byStatus: {
                PENDING: 0,
                ONGOING: 0,
                PAUSED: 0,
                COMPLETED: 0,
                FAILED: 0
              }
            }
          };
        }

        const r = g.recipes[recipeSnapshotId] as {
          steps: Record<string, unknown>;
          summary: {
            totalTasks: number;
            byStatus: Record<string, number>;
            completedExecutions: number;
          };
        };

        const stepOrder = task.stepOrder.toString();
        if (!r.steps[stepOrder]) {
          const step = (
            recipeSnapshot as {
              steps: {
                order: number;
                _id?: unknown;
                name?: string;
                description?: string;
              }[];
            }
          ).steps.find((s) => s.order === task.stepOrder);
          r.steps[stepOrder] = {
            stepInfo: {
              _id: step?._id || task.recipeStepId,
              name: step?.name || "Unknown Step",
              description: step?.description,
              order: task.stepOrder,
              deviceTypeId: task.deviceTypeId,
              estimatedDuration: task.estimatedDuration
            },
            tasks: [] as unknown[],
            summary: {
              totalTasks: 0,
              byStatus: {
                PENDING: 0,
                ONGOING: 0,
                PAUSED: 0,
                COMPLETED: 0,
                FAILED: 0
              }
            }
          };
        }

        const st = r.steps[stepOrder] as {
          tasks: unknown[];
          summary: { totalTasks: number; byStatus: Record<string, number> };
        };
        st.tasks.push(task);
        st.summary.totalTasks++;
        st.summary.byStatus[task.status]++;

        r.summary.totalTasks++;
        r.summary.byStatus[task.status]++;

        if (task.isLastStepInRecipe && task.status === "COMPLETED") {
          r.summary.completedExecutions++;
        }
      }
    }

    return {
      items: groupedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalProjects,
        totalPages: Math.ceil(totalProjects / limitNum),
        hasNext: pageNum * limitNum < totalProjects,
        hasPrev: pageNum > 1
      }
    };
  }
}

export const mongoTaskReadRepository = new MongoTaskReadRepository();
