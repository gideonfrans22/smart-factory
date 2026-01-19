import ExcelJS from "exceljs";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import { User } from "../models/User";
import * as ExcelFormatService from "./excelFormatService";
import { formatDateKorean } from "./excelFormatService";

/**
 * Summary Report Service
 * Generates comprehensive production/manufacturing status summary report
 */

// ==================== TYPES ====================

interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

interface ProductionStatus {
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

// ==================== TRANSLATIONS ====================

const TRANSLATIONS = {
  summaryReport: {
    title: {
      en: "Production/Manufacturing Comprehensive Status Summary Report",
      ko: "생산·제조 종합 현황 요약 보고서"
    },
    referenceDateTime: {
      en: "Reference Date/Time",
      ko: "기준일시"
    },
    reportGenerationDate: {
      en: "Report Generation Date",
      ko: "리포트생성일자"
    },
    prepared: {
      en: "Prepared",
      ko: "작성"
    },
    reviewed: {
      en: "Reviewed",
      ko: "검토"
    },
    approved: {
      en: "Approved",
      ko: "승인"
    },
    dailyProductionStatus: {
      en: "Daily Production Status",
      ko: "일간 생산성 현황"
    },
    weeklyProductionStatus: {
      en: "Weekly Production Status",
      ko: "주간 생산성 현황"
    },
    monthlyProductionStatus: {
      en: "Monthly Production Status",
      ko: "월간 생산성 현황"
    },
    progressRate: {
      en: "Progress Rate",
      ko: "진행률"
    },
    totalWorkCount: {
      en: "Total Work Count",
      ko: "전체작업수"
    },
    completedWorkCount: {
      en: "Completed Work Count",
      ko: "완료 작업 수"
    },
    deliveryDateBasedStatus: {
      en: "Delivery Date Based Status",
      ko: "납기일기준현황"
    },
    delayedDeliveries: {
      en: "Delayed Deliveries",
      ko: "납기 지연 수"
    },
    imminentDeliveries: {
      en: "Imminent Deliveries",
      ko: "납기 임박 수"
    },
    onTimeDeliveries: {
      en: "On-time Deliveries",
      ko: "납기 준수"
    },
    equipmentUtilizationRate: {
      en: "Equipment Utilization Rate",
      ko: "장비 가동률"
    },
    operatingEquipmentCount: {
      en: "Operating Equipment Count",
      ko: "가동장비수"
    },
    totalEquipmentCount: {
      en: "Total Equipment Count",
      ko: "총장비수"
    },
    topErrorFrequencies: {
      en: "Top 3 Error Occurrence Frequencies by Type",
      ko: "유형별 에러 발생 빈도 상위 3"
    },
    workerStatus: {
      en: "Worker Status",
      ko: "작업자 현황"
    },
    overallStatus: {
      en: "Overall Status",
      ko: "Overall Status"
    },
    workersInProgress: {
      en: "Workers in Progress",
      ko: "작업 진행자 수"
    },
    totalWorkers: {
      en: "Total Workers",
      ko: "총 작업자 수"
    },
    top10ProductWorkload: {
      en: "Top 10 Product Workload",
      ko: "제품별 작업량 상위 10"
    },
    top10PartWorkload: {
      en: "Top 10 Part Workload",
      ko: "부품별 작업량 상위 10"
    },
    top10CustomerOrderCount: {
      en: "Top 10 Customer Order Count",
      ko: "고객사 주문건 수 상위 10"
    },
    top10EquipmentUsage: {
      en: "Top 10 Equipment Usage",
      ko: "장비별 사용량 상위 10"
    },
    rank: {
      en: "Rank",
      ko: "순위"
    },
    productName: {
      en: "Product Name",
      ko: "제품명"
    },
    workload: {
      en: "Workload",
      ko: "작업량"
    },
    partName: {
      en: "Part Name",
      ko: "부품명"
    },
    customerName: {
      en: "Customer Name",
      ko: "고객사명"
    },
    orderCount: {
      en: "Order Count",
      ko: "주문건 수"
    },
    equipmentName: {
      en: "Equipment Name",
      ko: "장비명"
    },
    usageTime: {
      en: "Usage Time",
      ko: "사용량"
    },
    month: {
      en: "Month",
      ko: "월"
    },
    toolChange: {
      en: "Tool Change",
      ko: "툴체인지"
    },
    equipmentDefect: {
      en: "Equipment Defect",
      ko: "장비결함"
    },
    processingDefect: {
      en: "Processing Defect",
      ko: "가공결함"
    },
    materialDefect: {
      en: "Material Defect",
      ko: "재료결함"
    },
    other: {
      en: "Other",
      ko: "기타"
    }
  }
};

function getTranslation(key: string, lang: string = "en"): string {
  const keys = key.split(".");
  let value: any = TRANSLATIONS;
  for (const k of keys) {
    value = value?.[k];
  }
  return value?.[lang] || value?.en || key;
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Get production status data for daily, weekly, and monthly periods
 */
export async function getProductionStatusData(
  dateRange: DateRangeFilter
): Promise<{
  daily: ProductionStatus;
  weekly: ProductionStatus;
  monthly: ProductionStatus[];
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
  const monthlyData: ProductionStatus[] = [];
  for (let i = 2; i >= 0; i--) {
    const monthDate = new Date(endDate);
    monthDate.setMonth(endDate.getMonth() - i);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
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
  const totalDevices = await Device.countDocuments({ isActive: { $ne: false } });
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
    EQUIPMENT_DEFECT: getTranslation("summaryReport.equipmentDefect", "en"),
    TOOL_CHANGE: getTranslation("summaryReport.toolChange", "en"),
    PROCESSING_DEFECT: getTranslation("summaryReport.processingDefect", "en"),
    MATERIAL_DEFECT: getTranslation("summaryReport.materialDefect", "en"),
    OTHER: getTranslation("summaryReport.other", "en")
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
      unit: `${hours.toString().padStart(2, "0")}시간 ${minutes.toString().padStart(2, "0")}분`
    };
  });
}

// ==================== EXCEL GENERATION ====================

/**
 * Generate Summary Report Sheet
 */
export async function generateSummaryReportSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const langCode = lang || "en";
  const worksheet = workbook.addWorksheet("Summary Report");
  let currentRow = 1;

  // Get all data
  const productionStatus = await getProductionStatusData(dateRange);
  const deliveryStatus = await getDeliveryStatusData(dateRange);
  const equipmentUtilization = await getEquipmentUtilizationData();
  const errorFrequencies = await getErrorFrequencyData(dateRange);
  const workerStatus = await getWorkerStatusData(dateRange);
  const productWorkload = await getProductWorkloadRanking(dateRange);
  const partWorkload = await getPartWorkloadRanking(dateRange);
  const customerOrders = await getCustomerOrderRanking(dateRange);
  const equipmentUsage = await getEquipmentUsageRanking(dateRange);

  // ===== HEADER SECTION =====
  // Title
  worksheet.mergeCells(currentRow, 1, currentRow, 10);
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = getTranslation("summaryReport.title", langCode);
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Reference Date/Time and Report Generation Date
  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const refDateCell = worksheet.getCell(currentRow, 1);
  refDateCell.value = `${getTranslation("summaryReport.referenceDateTime", langCode)}: ${formatDateKorean(dateRange.startDate)} 00:00~23:59`;
  refDateCell.font = { size: 11 };
  currentRow++;

  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const genDateCell = worksheet.getCell(currentRow, 1);
  const today = new Date();
  genDateCell.value = `${getTranslation("summaryReport.reportGenerationDate", langCode)}: ${formatDateKorean(today)}`;
  genDateCell.font = { size: 11 };
  currentRow += 2;

  // Approval Section
  const approvalCols = [
    getTranslation("summaryReport.prepared", langCode),
    getTranslation("summaryReport.reviewed", langCode),
    getTranslation("summaryReport.approved", langCode)
  ];
  approvalCols.forEach((label, idx) => {
    const col = idx * 3 + 1;
    worksheet.mergeCells(currentRow, col, currentRow, col + 2);
    const cell = worksheet.getCell(currentRow, col);
    cell.value = label;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow++;

  // Approval date placeholders
  approvalCols.forEach((_, idx) => {
    const col = idx * 3 + 1;
    worksheet.mergeCells(currentRow, col, currentRow, col + 2);
    const cell = worksheet.getCell(currentRow, col);
    cell.value = ""; // Empty for manual filling
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // ===== PRODUCTION STATUS SECTIONS =====
  // Daily Production Status
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const dailyHeader = worksheet.getCell(currentRow, 1);
  dailyHeader.value = getTranslation("summaryReport.dailyProductionStatus", langCode);
  dailyHeader.font = { size: 12, bold: true };
  currentRow++;

  const dailyHeaders = [
    getTranslation("summaryReport.progressRate", langCode),
    getTranslation("summaryReport.totalWorkCount", langCode),
    getTranslation("summaryReport.completedWorkCount", langCode)
  ];
  dailyHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const dailyValues = [
    `${productionStatus.daily.progressRate}%`,
    productionStatus.daily.totalWorkCount,
    productionStatus.daily.completedWorkCount
  ];
  dailyValues.forEach((value, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // Weekly Production Status
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const weeklyHeader = worksheet.getCell(currentRow, 1);
  weeklyHeader.value = getTranslation("summaryReport.weeklyProductionStatus", langCode);
  weeklyHeader.font = { size: 12, bold: true };
  currentRow++;

  dailyHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const weeklyValues = [
    `${productionStatus.weekly.progressRate}%`,
    productionStatus.weekly.totalWorkCount,
    productionStatus.weekly.completedWorkCount
  ];
  weeklyValues.forEach((value, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // Monthly Production Status
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const monthlyHeader = worksheet.getCell(currentRow, 1);
  monthlyHeader.value = getTranslation("summaryReport.monthlyProductionStatus", langCode);
  monthlyHeader.font = { size: 12, bold: true };
  currentRow++;

  const monthHeaders = [
    getTranslation("summaryReport.month", langCode),
    ...dailyHeaders
  ];
  monthHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const monthNames = ["10월", "11월", "12월"]; // Simplified - should be calculated
  productionStatus.monthly.forEach((month, idx) => {
    const monthValues = [
      monthNames[idx] || `${idx + 1}월`,
      month.progressRate,
      month.totalWorkCount,
      month.completedWorkCount
    ];
    monthValues.forEach((value, colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });
  currentRow += 2;

  // ===== DELIVERY STATUS =====
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const deliveryHeader = worksheet.getCell(currentRow, 1);
  deliveryHeader.value = getTranslation("summaryReport.deliveryDateBasedStatus", langCode);
  deliveryHeader.font = { size: 12, bold: true };
  currentRow++;

  const deliveryHeaders = [
    getTranslation("summaryReport.delayedDeliveries", langCode),
    getTranslation("summaryReport.imminentDeliveries", langCode),
    getTranslation("summaryReport.onTimeDeliveries", langCode)
  ];
  deliveryHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const deliveryValues = [
    deliveryStatus.delayed,
    deliveryStatus.imminent,
    deliveryStatus.onTime
  ];
  deliveryValues.forEach((value, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // ===== EQUIPMENT UTILIZATION =====
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const equipmentHeader = worksheet.getCell(currentRow, 1);
  equipmentHeader.value = getTranslation("summaryReport.equipmentUtilizationRate", langCode);
  equipmentHeader.font = { size: 12, bold: true };
  currentRow++;

  const equipmentHeaders = [
    getTranslation("summaryReport.equipmentUtilizationRate", langCode),
    getTranslation("summaryReport.operatingEquipmentCount", langCode),
    getTranslation("summaryReport.totalEquipmentCount", langCode)
  ];
  equipmentHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const equipmentValues = [
    `${equipmentUtilization.utilizationRate}%`,
    equipmentUtilization.operatingCount,
    equipmentUtilization.totalCount
  ];
  equipmentValues.forEach((value, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // ===== ERROR FREQUENCIES =====
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const errorHeader = worksheet.getCell(currentRow, 1);
  errorHeader.value = getTranslation("summaryReport.topErrorFrequencies", langCode);
  errorHeader.font = { size: 12, bold: true };
  currentRow++;

  const errorHeaders = [
    getTranslation("summaryReport.month", langCode), // Reusing month translation for error type
    "Count",
    "Percentage"
  ];
  errorHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  errorFrequencies.forEach((error) => {
    const errorValues = [error.type, error.count, `${error.percentage}%`];
    errorValues.forEach((value, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });
  currentRow += 2;

  // ===== WORKER STATUS =====
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const workerHeader = worksheet.getCell(currentRow, 1);
  workerHeader.value = getTranslation("summaryReport.workerStatus", langCode);
  workerHeader.font = { size: 12, bold: true };
  currentRow++;

  const workerHeaders = [
    getTranslation("summaryReport.overallStatus", langCode),
    getTranslation("summaryReport.workersInProgress", langCode),
    getTranslation("summaryReport.totalWorkers", langCode)
  ];
  workerHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  const workerValues = [
    `${workerStatus.overallStatus}%`,
    workerStatus.workersInProgress,
    workerStatus.totalWorkers
  ];
  workerValues.forEach((value, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 2;

  // ===== RANKINGS =====
  // Top 10 Product Workload
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const productRankHeader = worksheet.getCell(currentRow, 1);
  productRankHeader.value = getTranslation("summaryReport.top10ProductWorkload", langCode);
  productRankHeader.font = { size: 12, bold: true };
  currentRow++;

  const rankHeaders = [
    getTranslation("summaryReport.rank", langCode),
    getTranslation("summaryReport.productName", langCode),
    getTranslation("summaryReport.workload", langCode)
  ];
  rankHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  productWorkload.forEach((item, idx) => {
    const rowValues = [idx + 1, item.name, item.value];
    rowValues.forEach((value, colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });
  currentRow += 2;

  // Top 10 Part Workload
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const partRankHeader = worksheet.getCell(currentRow, 1);
  partRankHeader.value = getTranslation("summaryReport.top10PartWorkload", langCode);
  partRankHeader.font = { size: 12, bold: true };
  currentRow++;

  const partRankHeaders = [
    getTranslation("summaryReport.rank", langCode),
    getTranslation("summaryReport.partName", langCode),
    getTranslation("summaryReport.workload", langCode)
  ];
  partRankHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  partWorkload.forEach((item, idx) => {
    const rowValues = [idx + 1, item.name, item.value];
    rowValues.forEach((value, colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });
  currentRow += 2;

  // Top 10 Customer Order Count
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const customerRankHeader = worksheet.getCell(currentRow, 1);
  customerRankHeader.value = getTranslation("summaryReport.top10CustomerOrderCount", langCode);
  customerRankHeader.font = { size: 12, bold: true };
  currentRow++;

  const customerRankHeaders = [
    getTranslation("summaryReport.rank", langCode),
    getTranslation("summaryReport.customerName", langCode),
    getTranslation("summaryReport.orderCount", langCode)
  ];
  customerRankHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  customerOrders.forEach((item, idx) => {
    const rowValues = [idx + 1, item.name, item.value];
    rowValues.forEach((value, colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });
  currentRow += 2;

  // Top 10 Equipment Usage
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const equipmentRankHeader = worksheet.getCell(currentRow, 1);
  equipmentRankHeader.value = getTranslation("summaryReport.top10EquipmentUsage", langCode);
  equipmentRankHeader.font = { size: 12, bold: true };
  currentRow++;

  const equipmentRankHeaders = [
    getTranslation("summaryReport.rank", langCode),
    getTranslation("summaryReport.equipmentName", langCode),
    getTranslation("summaryReport.usageTime", langCode)
  ];
  equipmentRankHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
  });
  currentRow++;

  equipmentUsage.forEach((item, idx) => {
    const rowValues = [idx + 1, item.name, item.unit || item.value];
    rowValues.forEach((value, colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx + 1);
      cell.value = value;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;
  });

  // Set column widths
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;

  console.log("✓ Summary Report Sheet generated successfully");
}
