import { Task } from "@/modules/task";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";
import { Project } from "@/modules/project";
import { Device } from "@/modules/device";
import { getSummaryReportTranslation } from "./summary.translations";
import { User } from "@/modules/user";
import { Alert } from "@/modules/alert";

interface ProductionStatus {
  progressRate: number;
  totalWorkCount: number;
  completedWorkCount: number;
}

interface MonthlyProductionStatus {
  month: Date;
  progressRate: number;
  totalWorkCount: number;
  completedWorkCount: number;
}

interface DeliveryStatus {
  delayed: number;
  imminent: number;
  onTime: number;
}

interface EquipmentUtilization {
  utilizationRate: number;
  operatingCount: number;
  totalCount: number;
}

interface ErrorFrequency {
  type: string;
  count: number;
  percentage: number;
}

interface WorkerStatus {
  overallStatus: number;
  workersInProgress: number;
  totalWorkers: number;
}

interface RankingItem {
  name: string;
  value: number;
  unit?: string;
}

/**
 * Get production status data for daily, weekly, and monthly periods
 */
export async function getProductionStatusData(
  dateRange: DateRangeFilter
): Promise<{
  daily: ProductionStatus;
  weekly: ProductionStatus;
  monthly: MonthlyProductionStatus[];
}> {
  const { endDate } = dateRange;

  // Daily production status (for the end date)
  const dailyStart = new Date(endDate);
  dailyStart.setHours(0, 0, 0, 0);
  const dailyEnd = new Date(endDate);
  dailyEnd.setHours(23, 59, 59, 999);

  const dailyTotal = await Task.countDocuments({
    createdAt: { $gte: dailyStart, $lte: dailyEnd }
  });
  const dailyCompleted = await Task.countDocuments({
    status: "COMPLETED",
    completedAt: { $gte: dailyStart, $lte: dailyEnd }
  });
  const dailyProgressRate =
    dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0;

  // Weekly production status (for the week containing end date)
  const weekStart = new Date(endDate);
  weekStart.setDate(endDate.getDate() - endDate.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weeklyTotal = await Task.countDocuments({
    createdAt: { $gte: weekStart, $lte: weekEnd }
  });
  const weeklyCompleted = await Task.countDocuments({
    status: "COMPLETED",
    completedAt: { $gte: weekStart, $lte: weekEnd }
  });
  const weeklyProgressRate =
    weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

  // Monthly production status (for last 3 months)
  const monthlyData: MonthlyProductionStatus[] = [];
  for (let i = 2; i >= 0; i--) {
    const monthDate = new Date(endDate);
    monthDate.setMonth(endDate.getMonth() - i);
    const monthStart = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const monthTotal = await Task.countDocuments({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });
    const monthCompleted = await Task.countDocuments({
      status: "COMPLETED",
      completedAt: { $gte: monthStart, $lte: monthEnd }
    });
    const monthProgressRate =
      monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;

    monthlyData.push({
      month: monthDate,
      progressRate: monthProgressRate,
      totalWorkCount: monthTotal,
      completedWorkCount: monthCompleted
    });
  }

  return {
    daily: {
      progressRate: dailyProgressRate,
      totalWorkCount: dailyTotal,
      completedWorkCount: dailyCompleted
    },
    weekly: {
      progressRate: weeklyProgressRate,
      totalWorkCount: weeklyTotal,
      completedWorkCount: weeklyCompleted
    },
    monthly: monthlyData
  };
}

/**
 * Get delivery status data based on project deadlines
 */
export async function getDeliveryStatusData(
  dateRange: DateRangeFilter
): Promise<DeliveryStatus> {
  const { startDate, endDate } = dateRange;

  const projects = await Project.find({
    deadline: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  }).lean();

  let delayed = 0;
  let imminent = 0;
  let onTime = 0;
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(now.getDate() + 3);

  for (const project of projects) {
    if (!project.deadline) continue;

    const deadline = new Date(project.deadline);
    const endDateObj = project.endDate ? new Date(project.endDate) : null;

    if (project.status === "COMPLETED" && endDateObj) {
      if (endDateObj <= deadline) {
        onTime++;
      } else {
        delayed++;
      }
    } else if (project.status !== "COMPLETED") {
      if (deadline < now) {
        delayed++;
      } else if (deadline <= threeDaysFromNow) {
        imminent++;
      } else {
        onTime++;
      }
    }
  }

  return { delayed, imminent, onTime };
}

/**
 * Get equipment utilization data
 */
export async function getEquipmentUtilizationData(): Promise<EquipmentUtilization> {
  const totalDevices = await Device.countDocuments({
    isActive: { $ne: false }
  });
  const operatingDevices = await Device.countDocuments({
    status: "ONLINE",
    isActive: { $ne: false }
  });

  const utilizationRate =
    totalDevices > 0 ? Math.round((operatingDevices / totalDevices) * 100) : 0;

  return {
    utilizationRate,
    operatingCount: operatingDevices,
    totalCount: totalDevices
  };
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Get top 3 error frequencies by type
 */
export async function getErrorFrequencyData(
  dateRange: DateRangeFilter
): Promise<ErrorFrequency[]> {
  const { startDate, endDate } = dateRange;

  const errorCounts = await Alert.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 3
    }
  ]);

  const totalErrors = await Alert.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const errorTypeMap: Record<string, string> = {
    EQUIPMENT_DEFECT: getSummaryReportTranslation(
      "summaryReport.equipmentDefect",
      "en"
    ),
    TOOL_CHANGE: getSummaryReportTranslation("summaryReport.toolChange", "en"),
    PROCESSING_DEFECT: getSummaryReportTranslation(
      "summaryReport.processingDefect",
      "en"
    ),
    MATERIAL_DEFECT: getSummaryReportTranslation(
      "summaryReport.materialDefect",
      "en"
    ),
    OTHER: getSummaryReportTranslation("summaryReport.other", "en")
  };

  return errorCounts.map((item) => ({
    type: errorTypeMap[item._id] || item._id,
    count: item.count,
    percentage:
      totalErrors > 0 ? Math.round((item.count / totalErrors) * 100) : 0
  }));
}

/**
 * Get worker status data
 */
export async function getWorkerStatusData(
  dateRange: DateRangeFilter
): Promise<WorkerStatus> {
  const { startDate, endDate } = dateRange;

  const totalWorkers = await User.countDocuments({ role: "worker" });
  const workersInProgress = await Task.distinct("workerId", {
    status: "ONGOING",
    workerId: { $exists: true, $ne: null },
    startedAt: { $gte: startDate, $lte: endDate }
  });

  const overallStatus =
    totalWorkers > 0
      ? Math.round((workersInProgress.length / totalWorkers) * 100)
      : 0;

  return {
    overallStatus,
    workersInProgress: workersInProgress.length,
    totalWorkers
  };
}

/**
 * Get top 10 product workload ranking
 */
export async function getProductWorkloadRanking(
  dateRange: DateRangeFilter
): Promise<RankingItem[]> {
  const { startDate, endDate } = dateRange;

  const productWorkloads = await Task.aggregate([
    {
      $match: {
        productId: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: "$product"
    }
  ]);

  return productWorkloads.map((item) => ({
    name: item.product.productName || item.product.designNumber || "Unknown",
    value: item.count
  }));
}

/**
 * Get top 10 part workload ranking (based on recipes)
 */
export async function getPartWorkloadRanking(
  dateRange: DateRangeFilter
): Promise<RankingItem[]> {
  const { startDate, endDate } = dateRange;

  const partWorkloads = await Task.aggregate([
    {
      $match: {
        recipeId: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$recipeId",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: "recipes",
        localField: "_id",
        foreignField: "_id",
        as: "recipe"
      }
    },
    {
      $unwind: "$recipe"
    }
  ]);

  return partWorkloads.map((item) => ({
    name: item.recipe.name || "Unknown",
    value: item.count
  }));
}

/**
 * Get top 10 customer order count ranking
 */
export async function getCustomerOrderRanking(
  dateRange: DateRangeFilter
): Promise<RankingItem[]> {
  const { startDate, endDate } = dateRange;

  const customerOrders = await Project.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productData"
      }
    },
    {
      $unwind: {
        path: "$productData",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: "$productData.customerName",
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        _id: { $ne: null, $exists: true }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]);

  return customerOrders.map((item) => ({
    name: item._id || "Unknown",
    value: item.count
  }));
}

/**
 * Get top 10 equipment usage ranking
 */
export async function getEquipmentUsageRanking(
  dateRange: DateRangeFilter
): Promise<RankingItem[]> {
  const { startDate, endDate } = dateRange;

  const equipmentUsage = await Task.aggregate([
    {
      $match: {
        deviceId: { $exists: true, $ne: null },
        status: "COMPLETED",
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$deviceId",
        totalMinutes: {
          $sum: { $ifNull: ["$actualDuration", 0] }
        }
      }
    },
    {
      $sort: { totalMinutes: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: "devices",
        localField: "_id",
        foreignField: "_id",
        as: "device"
      }
    },
    {
      $unwind: "$device"
    }
  ]);

  return equipmentUsage.map((item) => {
    const hours = Math.floor(item.totalMinutes / 60);
    const minutes = item.totalMinutes % 60;
    return {
      name: item.device.name || "Unknown",
      value: item.totalMinutes,
      unit: `${hours.toString().padStart(2, "0")}시간 ${minutes
        .toString()
        .padStart(2, "0")}분`
    };
  });
}
