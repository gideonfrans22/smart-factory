import ExcelJS from "exceljs";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import { User } from "../models/User";
import * as ExcelFormatService from "./excelFormatService";

import { formatDateKorean, formatDateMM } from "./excelFormatService";

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

  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  };

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

  // Reference Date/Time - left side
  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const refDateCell = worksheet.getCell(currentRow, 1);
  refDateCell.value = `${getTranslation("summaryReport.referenceDateTime", langCode)}: ${formatDateKorean(dateRange.startDate)} 00:00~23:59`;
  refDateCell.font = { size: 11 };

  // Approval section (작성/검토/승인) - right side
  const approvalCols = [
    { col: 6, label: "summaryReport.prepared" },
    { col: 7, label: "summaryReport.reviewed" },
    { col: 8, label: "summaryReport.approved" }
  ];

  approvalCols.forEach((col) => {
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = `${getTranslation(col.label, langCode)}`;
    cell.font = { size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 24;
  currentRow++;

  // Report Generation Date - left side
  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const genDateCell = worksheet.getCell(currentRow, 1);
  const today = new Date();
  genDateCell.value = `${getTranslation("summaryReport.reportGenerationDate", langCode)}: ${formatDateKorean(today)}`;
  genDateCell.font = { size: 11 };

  // Blank Signature cells - right side
  approvalCols.forEach((col) => {
    worksheet.mergeCells(currentRow, col.col, currentRow + 2, col.col);
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = "";
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    // Date Row
    worksheet.mergeCells(currentRow + 3, col.col, currentRow + 3, col.col);
    const dateCell = worksheet.getCell(currentRow + 3, col.col);
    dateCell.value = formatDateKorean(new Date());
    dateCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    dateCell.font = { size: 12 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow + 3).height = 24;
  });
  currentRow += 5;

  // ===== PRODUCTION STATUS SECTIONS =====
  // Daily Production Status - left side
  worksheet.mergeCells(currentRow, 1, currentRow, 2);
  const dailyHeader = worksheet.getCell(currentRow, 1);
  dailyHeader.value = getTranslation("summaryReport.dailyProductionStatus", langCode);
  dailyHeader.font = { size: 12, bold: true };
  dailyHeader.alignment = { horizontal: "center", vertical: "middle" };
  dailyHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  dailyHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // Weekly Production Status - center side
  worksheet.mergeCells(currentRow, 3, currentRow, 4);
  const weeklyHeader = worksheet.getCell(currentRow, 3);
  weeklyHeader.value = getTranslation("summaryReport.weeklyProductionStatus", langCode);
  weeklyHeader.font = { size: 12, bold: true };
  weeklyHeader.alignment = { horizontal: "center", vertical: "middle" };
  weeklyHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  weeklyHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // Monthly Production Status - right side
  worksheet.mergeCells(currentRow, 5, currentRow, 8);
  const monthlyHeader = worksheet.getCell(currentRow, 5);
  monthlyHeader.value = getTranslation("summaryReport.monthlyProductionStatus", langCode);
  monthlyHeader.font = { size: 12, bold: true };
  monthlyHeader.alignment = { horizontal: "center", vertical: "middle" };
  monthlyHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  monthlyHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };
  currentRow++;

  // Daily Production Status - headers - left side
  const dailyRows = [
    { label: getTranslation("summaryReport.progressRate", langCode), value: `${productionStatus.daily.progressRate}%` },
    { label: getTranslation("summaryReport.totalWorkCount", langCode), value: productionStatus.daily.totalWorkCount },
    { label: getTranslation("summaryReport.completedWorkCount", langCode), value: productionStatus.daily.completedWorkCount },
  ];
  dailyRows.forEach((row, idx) => {
    const labelCell = worksheet.getCell(currentRow + idx, 1);
    labelCell.value = row.label;
    labelCell.font = { size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    const valueCell = worksheet.getCell(currentRow + idx, 2);
    valueCell.value = row.value;
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // Weekly Production Status - headers - center side
  const weeklyRows = [
    { label: getTranslation("summaryReport.progressRate", langCode), value: `${productionStatus.weekly.progressRate}%` },
    { label: getTranslation("summaryReport.totalWorkCount", langCode), value: productionStatus.weekly.totalWorkCount },
    { label: getTranslation("summaryReport.completedWorkCount", langCode), value: productionStatus.weekly.completedWorkCount },
  ];
  weeklyRows.forEach((row, idx) => {
    const labelCell = worksheet.getCell(currentRow + idx, 3);
    labelCell.value = row.label;
    labelCell.font = { size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    const valueCell = worksheet.getCell(currentRow + idx, 4);
    valueCell.value = row.value;
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // Monthly Production Status - headers - right side
  const monthlyRows = [
    { label: getTranslation("summaryReport.month", langCode), value: productionStatus.monthly.map((month) => formatDateMM(month.month, langCode)) },
    { label: getTranslation("summaryReport.progressRate", langCode), value: productionStatus.monthly.map((month) => `${month.progressRate}%`) },
    { label: getTranslation("summaryReport.totalWorkCount", langCode), value: productionStatus.monthly.map((month) => month.totalWorkCount) },
    { label: getTranslation("summaryReport.completedWorkCount", langCode), value: productionStatus.monthly.map((month) => month.completedWorkCount) },
  ];
  monthlyRows.forEach((row, idx) => {
    const labelCell = worksheet.getCell(currentRow + idx, 5);
    labelCell.value = row.label;
    labelCell.font = { size: 11 };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    row.value.forEach((value, valueIdx) => {
      const valueCell = worksheet.getCell(currentRow + idx, 6 + valueIdx);
      valueCell.value = value;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
  });

  currentRow += 5;

  // DELIVERY STATUS - headers - left side
  worksheet.mergeCells(currentRow, 1, currentRow, 2);
  const deliveryHeader = worksheet.getCell(currentRow, 1);
  deliveryHeader.value = getTranslation("summaryReport.deliveryDateBasedStatus", langCode);
  deliveryHeader.font = { size: 12, bold: true };
  deliveryHeader.alignment = { horizontal: "center", vertical: "middle" };
  deliveryHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  deliveryHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // EQUIPMENT UTILIZATION - headers - center side
  worksheet.mergeCells(currentRow, 3, currentRow, 4);
  const equipmentHeader = worksheet.getCell(currentRow, 3);
  equipmentHeader.value = getTranslation("summaryReport.equipmentUtilizationRate", langCode);
  equipmentHeader.font = { size: 12, bold: true };
  equipmentHeader.alignment = { horizontal: "center", vertical: "middle" };
  equipmentHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  equipmentHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // ERROR FREQUENCIES - headers - center right side
  worksheet.mergeCells(currentRow, 5, currentRow, 6);
  const errorHeader = worksheet.getCell(currentRow, 5);
  errorHeader.value = getTranslation("summaryReport.topErrorFrequencies", langCode);
  errorHeader.font = { size: 12, bold: true };
  errorHeader.alignment = { horizontal: "center", vertical: "middle" };
  errorHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  errorHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };


  // WORKER STATUS - headers - right side
  worksheet.mergeCells(currentRow, 7, currentRow, 8);
  const workerHeader = worksheet.getCell(currentRow, 7);
  workerHeader.value = getTranslation("summaryReport.workerStatus", langCode);
  workerHeader.font = { size: 12, bold: true };
  workerHeader.alignment = { horizontal: "center", vertical: "middle" };
  workerHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  workerHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };
  currentRow++;

  // DELIVERY STATUS - values - left side
  const deliveryRows = [
    { label: getTranslation("summaryReport.delayedDeliveries", langCode), value: deliveryStatus.delayed },
    { label: getTranslation("summaryReport.imminentDeliveries", langCode), value: deliveryStatus.imminent },
    { label: getTranslation("summaryReport.onTimeDeliveries", langCode), value: deliveryStatus.onTime }
  ];
  deliveryRows.forEach((row, idx) => {
    const cell = worksheet.getCell(currentRow + idx, 1);
    cell.value = row.label;
    cell.font = { size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    const valueCell = worksheet.getCell(currentRow + idx, 2);
    valueCell.value = row.value;
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  const equipmentRows = [
    { label: getTranslation("summaryReport.equipmentUtilizationRate", langCode), value: `${equipmentUtilization.utilizationRate}%` },
    { label: getTranslation("summaryReport.operatingEquipmentCount", langCode), value: equipmentUtilization.operatingCount },
    { label: getTranslation("summaryReport.totalEquipmentCount", langCode), value: equipmentUtilization.totalCount }
  ];
  equipmentRows.forEach((row, idx) => {
    if (idx === 0) {
      worksheet.mergeCells(currentRow + idx, 3, currentRow + idx, 4);
      const valueCell = worksheet.getCell(currentRow + idx, 3);
      valueCell.value = row.value;
      valueCell.font = { size: 11 };
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    } else {
      const cell = worksheet.getCell(currentRow + idx, 3);
      cell.value = row.label;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      const valueCell = worksheet.getCell(currentRow + idx, 4);
      valueCell.value = row.value;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }
  });

  const errorRows = errorFrequencies.map((error) => ({
    label: error.type,
    value: [error.count, `${error.percentage}%`]
  }));
  errorRows.forEach((row, idx) => {
    worksheet.mergeCells(currentRow + idx, 5, currentRow + idx, 6);
    const cell = worksheet.getCell(currentRow + idx, 5);
    cell.value = `${row.label} ${row.value[1]}`;
    cell.font = { size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  })

  const workerRows = [
    { label: getTranslation("summaryReport.overallStatus", langCode), value: `${workerStatus.overallStatus}%` },
    { label: getTranslation("summaryReport.workersInProgress", langCode), value: workerStatus.workersInProgress },
    { label: getTranslation("summaryReport.totalWorkers", langCode), value: workerStatus.totalWorkers }
  ];
  workerRows.forEach((row, idx) => {
    if (idx === 0) {
      worksheet.mergeCells(currentRow + idx, 7, currentRow + idx, 8);
      const valueCell = worksheet.getCell(currentRow + idx, 7);
      valueCell.value = row.value;
      valueCell.font = { size: 11 };
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    } else {
      const cell = worksheet.getCell(currentRow + idx, 7);
      cell.value = row.label;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      const valueCell = worksheet.getCell(currentRow + idx, 8);
      valueCell.value = row.value;
      valueCell.font = { size: 11 };
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }
  });

  currentRow += Math.max(deliveryRows.length, equipmentRows.length, errorRows.length, workerRows.length) + 1;

  // ===== RANKINGS =====
  // Top 10 Product Workload - headers - left side
  worksheet.mergeCells(currentRow, 1, currentRow, 2);
  const productRankHeader = worksheet.getCell(currentRow, 1);
  productRankHeader.value = getTranslation("summaryReport.top10ProductWorkload", langCode);
  productRankHeader.font = { size: 12, bold: true };
  productRankHeader.alignment = { horizontal: "center", vertical: "middle" };
  productRankHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  productRankHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // Top 10 Part Workload - headers - center left side
  worksheet.mergeCells(currentRow, 3, currentRow, 4);
  const partRankHeader = worksheet.getCell(currentRow, 3);
  partRankHeader.value = getTranslation("summaryReport.top10PartWorkload", langCode);
  partRankHeader.font = { size: 12, bold: true };
  partRankHeader.alignment = { horizontal: "center", vertical: "middle" };
  partRankHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  partRankHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // Top 10 Customer Order Count - headers - center right side
  worksheet.mergeCells(currentRow, 5, currentRow, 6);
  const customerRankHeader = worksheet.getCell(currentRow, 5);
  customerRankHeader.value = getTranslation("summaryReport.top10CustomerOrderCount", langCode);
  customerRankHeader.font = { size: 12, bold: true };
  customerRankHeader.alignment = { horizontal: "center", vertical: "middle" };
  customerRankHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  customerRankHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };

  // Top 10 Equipment Usage - headers - right side
  worksheet.mergeCells(currentRow, 7, currentRow, 8);
  const equipmentRankHeader = worksheet.getCell(currentRow, 7);
  equipmentRankHeader.value = getTranslation("summaryReport.top10EquipmentUsage", langCode);
  equipmentRankHeader.font = { size: 12, bold: true };
  equipmentRankHeader.alignment = { horizontal: "center", vertical: "middle" };
  equipmentRankHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  equipmentRankHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };
  currentRow++;

  // Top 10 values arrays
  const rankRows = [
    { values: productWorkload.map((item) => item.name) },
    { values: productWorkload.map((item) => item.value) },

    { values: partWorkload.map((item) => item.name) },
    { values: partWorkload.map((item) => item.value) },

    { values: customerOrders.map((item) => item.name) },
    { values: customerOrders.map((item) => item.value) },

    { values: equipmentUsage.map((item) => item.name) },
    { values: equipmentUsage.map((item) => item.unit || item.value) }
  ];
  rankRows.forEach((row, idx) => {
    row.values.forEach((value, valueIdx) => {
      const cell = worksheet.getCell(currentRow + valueIdx, idx + 1);
      cell.value = value;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    })
  });

  // Set column widths
  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 14;
  worksheet.getColumn(6).width = 14;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 14;

  console.log("✓ Summary Report Sheet generated successfully");
}
