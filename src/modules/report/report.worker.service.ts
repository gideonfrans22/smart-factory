import { Task } from "@modules/task";
import { User } from "@modules/user/user.model";
import * as ExcelFormatService from "@shared/services/excelFormatService";
import { formatDateKorean } from "@shared/services/excelFormatService";
import ExcelJS from "exceljs";
import mongoose from "mongoose";

/**
 * Worker Performance Report Data Aggregation Service
 * Handles all data queries and calculations for worker performance reports
 */

// ==================== TRANSLATIONS ====================
const TRANSLATIONS = {
  // Main Report Titles
  titles: {
    workerPerformanceReport: {
      en: "WORKER PERFORMANCE SUMMARY REPORT",
      ko: "작업자별 성과보고서"
    },
    workerPerformanceRankings: {
      en: "WORKER PERFORMANCE RANKINGS",
      ko: "작업자 성과 순위"
    },
    individualWorkerDetails: {
      en: "INDIVIDUAL WORKER DETAILS",
      ko: "개별 작업자 상세 정보"
    },
    workerDeviceTypeProficiencyMatrix: {
      en: "WORKER DEVICE TYPE PROFICIENCY MATRIX",
      ko: "작업자 기계 유형 숙련도 매트릭스"
    },
    workerTimeTrackingQualityMetrics: {
      en: "WORKER TIME TRACKING & QUALITY METRICS",
      ko: "작업자 시간 추적 및 품질 지표"
    },
    kpi: {
      en: "KPI",
      ko: "KPI"
    },
    kpiValue: {
      en: "Value",
      ko: "값"
    }
  },

  roles: {
    manager: {
      en: "Manager",
      ko: "관리자"
    },
    ceo: {
      en: "CEO",
      ko: "대표"
    },
    worker: {
      en: "Worker",
      ko: "작업자"
    }
  },

  // Performance Rankings Sheet
  performanceRankings: {
    performanceTierDistribution: {
      en: "Performance Tier Distribution",
      ko: "성과 등급 분포"
    },
    tier: { en: "Tier", ko: "등급" },
    workers: { en: "Workers", ko: "작업자" },
    percentage: { en: "Percentage", ko: "비율" },
    scoreRange: { en: "Score Range", ko: "점수 범위" },
    description: { en: "Description", ko: "설명" },
    outstandingPerformance: {
      en: "Outstanding performance, exceeds expectations",
      ko: "뛰어난 성과, 기대 이상"
    },
    strongPerformance: {
      en: "Strong performance, meets all expectations",
      ko: "강한 성과, 모든 기대 충족"
    },
    satisfactoryPerformance: {
      en: "Satisfactory performance, meets most expectations",
      ko: "만족할 만한 성과, 대부분의 기대 충족"
    },
    needsImprovement: {
      en: "Needs improvement in multiple areas",
      ko: "여러 영역에서 개선 필요"
    },
    requiresImmediateAttention: {
      en: "Requires immediate attention and training",
      ko: "즉각적인 주의 및 교육 필요"
    },
    workerRankingsAllWorkers: {
      en: "Worker Rankings (All Workers)",
      ko: "작업자 순위 (모든 작업자)"
    },
    top5Performers: { en: "🏆 TOP 5 PERFORMERS", ko: "🏆 상위 5명 성과자" }
  },

  // Worker Rankings Table Headers
  rankingsHeaders: {
    rank: { en: "Rank", ko: "순위" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    completed: { en: "Completed", ko: "완료됨" },
    failed: { en: "Failed", ko: "실패함" },
    qualityPercent: { en: "Quality %", ko: "품질 %" },
    efficiencyPercent: { en: "Efficiency %", ko: "효율성 %" },
    performanceScore: { en: "Performance Score", ko: "성과 점수" },
    rating: { en: "Rating", ko: "등급" },
    hours: { en: "Hours", ko: "시간" }
  },

  // Worker Details Sheet
  workerDetails: {
    performanceScore: { en: "Performance Score:", ko: "성과 점수:" },
    rating: { en: "Rating:", ko: "등급:" },
    completedTasks: { en: "Completed Tasks:", ko: "완료된 작업:" },
    failedTasks: { en: "Failed Tasks:", ko: "실패한 작업:" },
    qualityScore: { en: "Quality Score:", ko: "품질 점수:" },
    efficiency: { en: "Efficiency:", ko: "효율성:" },
    totalHours: { en: "Total Hours:", ko: "총 시간:" },
    productiveTime: { en: "Productive Time:", ko: "생산적 시간:" },
    breakTime: { en: "Break Time:", ko: "휴식 시간:" },
    avgTaskTime: { en: "Avg Task Time:", ko: "평균 작업 시간:" },
    taskStatusBreakdown: {
      en: "Task Status Breakdown",
      ko: "작업 상태 분석"
    },
    completed: { en: "Completed:", ko: "완료됨:" },
    failed: { en: "Failed:", ko: "실패함:" },
    ongoing: { en: "Ongoing:", ko: "진행 중:" },
    pending: { en: "Pending:", ko: "대기 중:" },
    topProjects: { en: "Top Projects", ko: "상위 프로젝트" },
    topDeviceTypes: { en: "Top Device Types", ko: "상위 기계 유형" }
  },

  // Device Proficiency Sheet
  deviceProficiency: {
    proficiencyLevels: {
      en: "Proficiency Levels: EXPERT (≥120%), PROFICIENT (100-119%), LEARNING (80-99%), BEGINNER (<80%)",
      ko: "숙련도 수준: 전문가 (≥120%), 숙련 (100-119%), 학습 (80-99%), 초급자 (<80%)"
    },
    noProficiencyData: {
      en: "No proficiency data available for the selected date range.",
      ko: "선택한 날짜 범위에 대한 숙련도 데이터가 없습니다."
    },
    summary: { en: "Summary:", ko: "요약:" },
    expert: { en: "Expert:", ko: "전문가:" },
    proficient: { en: "Proficient:", ko: "숙련:" },
    learning: { en: "Learning:", ko: "학습:" },
    beginner: { en: "Beginner:", ko: "초급자:" },
    overallProficiency: {
      en: "Overall Proficiency:",
      ko: "전체 숙련도:"
    }
  },

  // Device Proficiency Table Headers
  proficiencyHeaders: {
    deviceType: { en: "Device Type", ko: "기계 유형" },
    tasksCompleted: { en: "Tasks Completed", ko: "완료된 작업" },
    avgEstimatedTime: { en: "Avg Estimated Time", ko: "평균 예상 시간" },
    avgActualTime: { en: "Avg Actual Time", ko: "평균 실제 시간" },
    proficiencyPercent: { en: "Proficiency %", ko: "숙련도 %" },
    status: { en: "Status", ko: "상태" }
  },

  // Proficiency Status Levels
  proficiencyStatus: {
    expert: { en: "EXPERT", ko: "전문가" },
    proficient: { en: "PROFICIENT", ko: "숙련" },
    learning: { en: "LEARNING", ko: "학습" },
    beginner: { en: "BEGINNER", ko: "초급자" }
  },

  // Time Tracking Sheet
  timeTracking: {
    summaryStatistics: {
      en: "Summary Statistics",
      ko: "요약 통계"
    },
    totalWorkers: { en: "Total Workers:", ko: "총 작업자:" },
    totalHoursWorked: { en: "Total Hours Worked:", ko: "총 근무 시간:" },
    totalProductiveHours: {
      en: "Total Productive Hours:",
      ko: "총 생산적 시간:"
    },
    totalBreakHours: { en: "Total Break Hours:", ko: "총 휴식 시간:" },
    totalTasksCompleted: {
      en: "Total Tasks Completed:",
      ko: "총 완료된 작업:"
    },
    averageQualityScore: {
      en: "Average Quality Score:",
      ko: "평균 품질 점수:"
    },
    averageEfficiency: {
      en: "Average Efficiency:",
      ko: "평균 효율성:"
    }
  },

  // Time Tracking Table Headers
  timeTrackingHeaders: {
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    totalHours: { en: "Total Hours", ko: "총 시간" },
    productiveHours: { en: "Productive Hours", ko: "생산적 시간" },
    breakHours: { en: "Break Hours", ko: "휴식 시간" },
    tasksCompleted: { en: "Tasks Completed", ko: "완료된 작업" },
    tasksPerHour: { en: "Tasks/Hour", ko: "시간당 작업" },
    qualityScorePercent: { en: "Quality Score %", ko: "품질 점수 %" },
    efficiencyPercent: { en: "Efficiency %", ko: "효율성 %" },
    avgTaskTime: { en: "Avg Task Time", ko: "평균 작업 시간" },
    performanceRating: { en: "Performance Rating", ko: "성과 등급" }
  },

  // Raw Worker Data Sheet
  rawWorkerData: {
    instructions: {
      en: "RAW WORKER DATA EXPORT - This sheet contains all task records assigned to workers in the date range. Use for data analysis, export/import, or integration with other systems.",
      ko: "원본 작업자 데이터 내보내기 - 이 시트에는 날짜 범위의 작업자에게 할당된 모든 작업 기록이 포함되어 있습니다. 데이터 분석, 내보내기/가져오기 또는 다른 시스템과의 통합에 사용하세요."
    }
  },

  // Raw Worker Data Table Headers
  rawDataHeaders: {
    taskId: { en: "Task ID", ko: "작업 ID" },
    workerId: { en: "Worker ID", ko: "작업자 ID" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    taskTitle: { en: "Task Title", ko: "작업 제목" },
    projectId: { en: "Project ID", ko: "프로젝트 ID" },
    recipeId: { en: "Recipe ID", ko: "레시피 ID" },
    deviceTypeId: { en: "Device Type ID", ko: "기계 유형 ID" },
    deviceId: { en: "Device ID", ko: "기계 ID" },
    status: { en: "Status", ko: "상태" },
    priority: { en: "Priority", ko: "우선순위" },
    estimatedDuration: {
      en: "Estimated Duration (s)",
      ko: "예상 소요 시간 (초)"
    },
    actualDuration: { en: "Actual Duration (s)", ko: "실제 소요 시간 (초)" },
    pausedDuration: { en: "Paused Duration (s)", ko: "일시 중지 시간 (초)" },
    startedAt: { en: "Started At", ko: "시작 시간" },
    completedAt: { en: "Completed At", ko: "완료 시간" },
    createdAt: { en: "Created At", ko: "생성 시간" },
    qualityScore: { en: "Quality Score", ko: "품질 점수" },
    efficiency: { en: "Efficiency %", ko: "효율성 %" },
    notes: { en: "Notes", ko: "비고" }
  },

  // Worker KPI Report
  workerKPI: {
    title: {
      en: "WORKER PERFORMANCE KPI REPORT",
      ko: "작업자 성과 KPI 보고서"
    },
    prepared: { en: "Prepared", ko: "작성" },
    reviewed: { en: "Reviewed", ko: "검토" },
    approved: { en: "Approved", ko: "승인" },
    workerName: { en: "Worker Name", ko: "작업자 이름" },
    department: { en: "Department", ko: "부서" },
    workProficiency: { en: "Work Proficiency", ko: "작업 숙련도" },
    proficiencyLevel: { en: "Proficiency Level", ko: "숙련도 수준" },
    proficiencyScore: { en: "Proficiency Score", ko: "숙련도 점수" },
    totalWorkingHours: { en: "Total Working Hours", ko: "총 근무 시간" },
    productionVolume: { en: "Production Volume", ko: "생산량" },
    overtimeHours: { en: "Overtime Hours", ko: "초과 근무 시간" },
    jobProcessingDelays: {
      en: "Job Processing Delays",
      ko: "작업 처리 지연 횟수"
    },
    jobProcessingLatency: {
      en: "Job Processing Latency (minutes)",
      ko: "작업 처리 지연 시간 (분)"
    },
    partDefects: { en: "Part Defects", ko: "부품 불량 수" },
    initial: { en: "Initial", ko: "초급" },
    intermediate: { en: "Intermediate", ko: "중급" },
    advanced: { en: "Advanced", ko: "고급" },
    period: { en: "Period", ko: "기간" },
    from: { en: "From", ko: "시작일" },
    to: { en: "To", ko: "종료일" }
  }
};

// ==================== INTERFACES ====================

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface WorkerTaskMetrics {
  workerId: string;
  workerName: string;
  department: string;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalTasks: number;
}

export interface WorkerPerformanceData {
  workerId: string;
  workerName: string;
  department: string;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  totalHours: number; // in hours
  breakTime: number; // in hours
  productiveTime: number; // in hours
  qualityScore: number; // percentage
  avgTaskCompletionTime: number; // in minutes
  avgTaskEstimatedTime: number; // in minutes
  efficiency: number; // percentage
  performanceRating:
    | "EXCELLENT"
    | "GOOD"
    | "AVERAGE"
    | "BELOW_AVERAGE"
    | "POOR";
  performanceScore: number; // 0-100
  rank?: number;
}

export interface DeviceProficiency {
  deviceTypeId: string;
  deviceTypeName: string;
  tasksCompleted: number;
  avgEstimatedDuration: number;
  avgActualDuration: number;
  proficiency: number; // percentage: (Est / Actual) × 100
  status: "EXPERT" | "PROFICIENT" | "LEARNING" | "BEGINNER";
}

export interface WorkerProficiencyReport {
  workerId: string;
  workerName: string;
  department: string;
  deviceProficiencies: DeviceProficiency[];
  overallProficiency: number;
  expertDevices: number;
  proficientDevices: number;
  learningDevices: number;
  beginnerDevices: number;
}

export interface WorkerTaskBreakdown {
  workerId: string;
  workerName: string;
  byStatus: {
    completed: number;
    failed: number;
    ongoing: number;
    pending: number;
  };
  byProject: Array<{
    projectId: string;
    projectName: string;
    taskCount: number;
  }>;
  byDeviceType: Array<{
    deviceTypeId: string;
    deviceTypeName: string;
    taskCount: number;
  }>;
}

export interface WorkerDailyActivity {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  hoursWorked: number;
  efficiency: number;
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Get worker task metrics (task counts by status)
 */
export async function getWorkerTaskMetrics(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerTaskMetrics[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const metrics = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
        },
        pendingTasks: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
        },
        totalTasks: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        department: "$worker.department",
        completedTasks: 1,
        failedTasks: 1,
        inProgressTasks: 1,
        pendingTasks: 1,
        totalTasks: 1
      }
    },
    {
      $sort: { completedTasks: -1 }
    }
  ]);

  return metrics;
}

/**
 * Calculate worker hours (sum of completedAt - startedAt for COMPLETED tasks only)
 */
export async function calculateWorkerHours(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    totalHours: number;
    taskCount: number;
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: "COMPLETED",
    startedAt: { $ne: null },
    completedAt: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const hours = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        totalMilliseconds: {
          $sum: { $subtract: ["$completedAt", "$startedAt"] }
        },
        taskCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        totalHours: { $divide: ["$totalMilliseconds", 3600000] }, // ms to hours
        taskCount: 1
      }
    },
    {
      $sort: { totalHours: -1 }
    }
  ]);

  return hours;
}

/**
 * Calculate break time (sum of pausedDuration)
 */
export async function calculateBreakTime(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    breakTime: number; // in hours
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    pausedDuration: { $gt: 0 },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const breakTimes = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        totalPausedSeconds: { $sum: "$pausedDuration" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        breakTime: { $divide: ["$totalPausedSeconds", 3600] } // seconds to hours
      }
    },
    {
      $sort: { breakTime: -1 }
    }
  ]);

  return breakTimes;
}

/**
 * Calculate quality score (Completed / (Completed + Failed) × 100%)
 */
export async function calculateQualityScore(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    completedTasks: number;
    failedTasks: number;
    qualityScore: number;
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: { $in: ["COMPLETED", "FAILED"] },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const qualityScores = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        completedTasks: 1,
        failedTasks: 1,
        qualityScore: {
          $cond: [
            { $gt: [{ $add: ["$completedTasks", "$failedTasks"] }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    "$completedTasks",
                    { $add: ["$completedTasks", "$failedTasks"] }
                  ]
                },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { qualityScore: -1 }
    }
  ]);

  return qualityScores;
}

/**
 * Calculate device proficiency per worker
 * Proficiency = (Avg Estimated Duration / Avg Actual Duration) × 100%
 */
export async function calculateDeviceProficiency(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerProficiencyReport[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: "COMPLETED",
    actualDuration: { $gt: 0 },
    estimatedDuration: { $gt: 0 },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const proficiencyData = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          workerId: "$workerId",
          deviceTypeId: "$deviceTypeId"
        },
        tasksCompleted: { $sum: 1 },
        avgEstimatedDuration: { $avg: "$estimatedDuration" },
        avgActualDuration: { $avg: "$actualDuration" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id.workerId",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $lookup: {
        from: "devicetypes",
        localField: "_id.deviceTypeId",
        foreignField: "_id",
        as: "deviceType"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $unwind: "$deviceType"
    },
    {
      $project: {
        workerId: { $toString: "$_id.workerId" },
        workerName: "$worker.name",
        department: "$worker.department",
        deviceTypeId: { $toString: "$_id.deviceTypeId" },
        deviceTypeName: "$deviceType.name",
        tasksCompleted: 1,
        avgEstimatedDuration: 1,
        avgActualDuration: 1,
        proficiency: {
          $multiply: [
            { $divide: ["$avgEstimatedDuration", "$avgActualDuration"] },
            100
          ]
        }
      }
    },
    {
      $sort: { workerId: 1, proficiency: -1 }
    }
  ]);

  // Group by worker
  const workerMap = new Map<string, WorkerProficiencyReport>();

  proficiencyData.forEach((item) => {
    if (!workerMap.has(item.workerId)) {
      workerMap.set(item.workerId, {
        workerId: item.workerId,
        workerName: item.workerName,
        department: item.department,
        deviceProficiencies: [],
        overallProficiency: 0,
        expertDevices: 0,
        proficientDevices: 0,
        learningDevices: 0,
        beginnerDevices: 0
      });
    }

    const worker = workerMap.get(item.workerId)!;

    // Determine proficiency status
    let status: "EXPERT" | "PROFICIENT" | "LEARNING" | "BEGINNER";
    if (item.proficiency >= 120) {
      status = "EXPERT";
      worker.expertDevices++;
    } else if (item.proficiency >= 100) {
      status = "PROFICIENT";
      worker.proficientDevices++;
    } else if (item.proficiency >= 80) {
      status = "LEARNING";
      worker.learningDevices++;
    } else {
      status = "BEGINNER";
      worker.beginnerDevices++;
    }

    worker.deviceProficiencies.push({
      deviceTypeId: item.deviceTypeId,
      deviceTypeName: item.deviceTypeName,
      tasksCompleted: item.tasksCompleted,
      avgEstimatedDuration: item.avgEstimatedDuration,
      avgActualDuration: item.avgActualDuration,
      proficiency: item.proficiency,
      status
    });
  });

  // Calculate overall proficiency
  const reports = Array.from(workerMap.values());
  reports.forEach((report) => {
    if (report.deviceProficiencies.length > 0) {
      report.overallProficiency =
        report.deviceProficiencies.reduce(
          (sum, prof) => sum + prof.proficiency,
          0
        ) / report.deviceProficiencies.length;
    }
  });

  return reports.sort((a, b) => b.overallProficiency - a.overallProficiency);
}

/**
 * Calculate comprehensive worker performance data
 */
export async function getWorkerPerformanceData(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerPerformanceData[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const performanceData = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
        },
        totalHoursMs: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$completedAt", null] }
                ]
              },
              { $subtract: ["$completedAt", "$startedAt"] },
              0
            ]
          }
        },
        totalBreakSeconds: {
          $sum: { $ifNull: ["$pausedDuration", 0] }
        },
        totalActualDuration: {
          $sum: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", 0]
          }
        },
        totalEstimatedDuration: {
          $sum: { $ifNull: ["$estimatedDuration", 0] }
        },
        completedTaskCount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        department: "$worker.department",
        completedTasks: 1,
        failedTasks: 1,
        inProgressTasks: 1,
        totalHours: { $divide: ["$totalHoursMs", 3600000] },
        breakTime: { $divide: ["$totalBreakSeconds", 3600] },
        productiveTime: {
          $divide: [
            {
              $subtract: [
                "$totalHoursMs",
                { $multiply: ["$totalBreakSeconds", 1000] }
              ]
            },
            3600000
          ]
        },
        qualityScore: {
          $cond: [
            { $gt: [{ $add: ["$completedTasks", "$failedTasks"] }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    "$completedTasks",
                    { $add: ["$completedTasks", "$failedTasks"] }
                  ]
                },
                100
              ]
            },
            0
          ]
        },
        avgTaskCompletionTime: {
          $cond: [
            { $gt: ["$completedTaskCount", 0] },
            { $divide: ["$totalActualDuration", "$completedTaskCount"] },
            0
          ]
        },
        avgTaskEstimatedTime: {
          $cond: [
            { $gt: ["$completedTaskCount", 0] },
            { $divide: ["$totalEstimatedDuration", "$completedTaskCount"] },
            0
          ]
        },
        efficiency: {
          $cond: [
            { $gt: ["$totalActualDuration", 0] },
            {
              $multiply: [
                {
                  $divide: ["$totalEstimatedDuration", "$totalActualDuration"]
                },
                100
              ]
            },
            0
          ]
        }
      }
    }
  ]);

  // Calculate performance rating and score
  const results: WorkerPerformanceData[] = performanceData.map((worker) => {
    // Performance score formula (0-100):
    // 40% Quality Score + 30% Efficiency + 20% Completion Rate + 10% Productivity
    const completionRate =
      worker.completedTasks + worker.failedTasks > 0
        ? (worker.completedTasks /
            (worker.completedTasks + worker.failedTasks)) *
          100
        : 0;

    const productivity =
      worker.totalHours > 0 ? worker.completedTasks / worker.totalHours : 0;
    const normalizedProductivity = Math.min(productivity * 10, 100); // Normalize to 0-100

    const performanceScore =
      worker.qualityScore * 0.4 +
      worker.efficiency * 0.3 +
      completionRate * 0.2 +
      normalizedProductivity * 0.1;

    // Determine rating
    let performanceRating:
      | "EXCELLENT"
      | "GOOD"
      | "AVERAGE"
      | "BELOW_AVERAGE"
      | "POOR";
    if (performanceScore >= 90) {
      performanceRating = "EXCELLENT";
    } else if (performanceScore >= 75) {
      performanceRating = "GOOD";
    } else if (performanceScore >= 60) {
      performanceRating = "AVERAGE";
    } else if (performanceScore >= 40) {
      performanceRating = "BELOW_AVERAGE";
    } else {
      performanceRating = "POOR";
    }

    return {
      ...worker,
      performanceScore,
      performanceRating
    };
  });

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

/**
 * Calculate performance rating for a worker
 */
export function calculatePerformanceRating(
  qualityScore: number,
  efficiency: number,
  completionRate: number,
  productivity: number
): { rating: string; score: number } {
  // Performance score formula (0-100):
  // 40% Quality + 30% Efficiency + 20% Completion Rate + 10% Productivity
  const normalizedProductivity = Math.min(productivity * 10, 100);

  const score =
    qualityScore * 0.4 +
    efficiency * 0.3 +
    completionRate * 0.2 +
    normalizedProductivity * 0.1;

  let rating: string;
  if (score >= 90) {
    rating = "EXCELLENT";
  } else if (score >= 75) {
    rating = "GOOD";
  } else if (score >= 60) {
    rating = "AVERAGE";
  } else if (score >= 40) {
    rating = "BELOW_AVERAGE";
  } else {
    rating = "POOR";
  }

  return { rating, score };
}

/**
 * Rank workers by performance
 */
export async function rankWorkersByPerformance(
  dateRange: DateRangeFilter
): Promise<WorkerPerformanceData[]> {
  const performanceData = await getWorkerPerformanceData(dateRange);

  // Add rank
  performanceData.forEach((worker, index) => {
    worker.rank = index + 1;
  });

  return performanceData;
}

/**
 * Get worker task breakdown (by status, project, device type)
 */
export async function getWorkerTaskBreakdown(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerTaskBreakdown | null> {
  const { startDate, endDate } = dateRange;

  const worker = await User.findById(workerId).lean();
  if (!worker) return null;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("projectId", "name")
    .populate("deviceTypeId", "name")
    .lean();

  // By status
  const byStatus = {
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    failed: tasks.filter((t) => t.status === "FAILED").length,
    ongoing: tasks.filter((t) => t.status === "ONGOING").length,
    pending: tasks.filter((t) => t.status === "PENDING").length
  };

  // By project
  const projectMap = new Map<string, { name: string; count: number }>();
  tasks.forEach((task) => {
    if (task.projectId) {
      const projectId = (task.projectId as any)._id.toString();
      const projectName = (task.projectId as any).name;
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { name: projectName, count: 0 });
      }
      projectMap.get(projectId)!.count++;
    }
  });

  const byProject = Array.from(projectMap.entries())
    .map(([projectId, data]) => ({
      projectId,
      projectName: data.name,
      taskCount: data.count
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  // By device type
  const deviceTypeMap = new Map<string, { name: string; count: number }>();
  tasks.forEach((task) => {
    if (task.deviceTypeId) {
      const deviceTypeId = (task.deviceTypeId as any)._id.toString();
      const deviceTypeName = (task.deviceTypeId as any).name;
      if (!deviceTypeMap.has(deviceTypeId)) {
        deviceTypeMap.set(deviceTypeId, { name: deviceTypeName, count: 0 });
      }
      deviceTypeMap.get(deviceTypeId)!.count++;
    }
  });

  const byDeviceType = Array.from(deviceTypeMap.entries())
    .map(([deviceTypeId, data]) => ({
      deviceTypeId,
      deviceTypeName: data.name,
      taskCount: data.count
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  return {
    workerId: workerId.toString(),
    workerName: worker.name,
    byStatus,
    byProject,
    byDeviceType
  };
}

/**
 * Get daily activity for a worker (for trend charts)
 */
export async function getWorkerDailyActivity(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerDailyActivity[]> {
  const { startDate, endDate } = dateRange;

  const dailyData = await Task.aggregate([
    {
      $match: {
        workerId: new mongoose.Types.ObjectId(workerId),
        status: "COMPLETED",
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
        },
        tasksCompleted: { $sum: 1 },
        totalHoursMs: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$completedAt", null] }
                ]
              },
              { $subtract: ["$completedAt", "$startedAt"] },
              0
            ]
          }
        },
        totalEstimatedDuration: { $sum: "$estimatedDuration" },
        totalActualDuration: { $sum: "$actualDuration" }
      }
    },
    {
      $project: {
        date: "$_id",
        tasksCompleted: 1,
        hoursWorked: { $divide: ["$totalHoursMs", 3600000] },
        efficiency: {
          $cond: [
            { $gt: ["$totalActualDuration", 0] },
            {
              $multiply: [
                {
                  $divide: ["$totalEstimatedDuration", "$totalActualDuration"]
                },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);

  // Fill in missing dates
  const result: WorkerDailyActivity[] = [];
  const dataMap = new Map(dailyData.map((d) => [d.date, d]));
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const data = dataMap.get(dateStr);

    result.push({
      date: dateStr,
      tasksCompleted: data?.tasksCompleted || 0,
      hoursWorked: data?.hoursWorked || 0,
      efficiency: data?.efficiency || 0
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

// ==================== KPI CALCULATION FUNCTIONS ====================

export interface WorkerProficiencyResult {
  score: number; // 0-100
  level: "initial" | "intermediate" | "advanced";
  breakdown: {
    completionRate: number;
    qualityScore: number;
    speedEfficiency: number;
    consistency: number;
  };
}

export interface WorkerKPIData {
  workerId: string;
  workerName: string;
  department: string;
  proficiency: WorkerProficiencyResult;
  totalWorkingHours: number;
  productionVolume: number;
  overtimeHours: number;
  jobProcessingDelays: number;
  jobProcessingLatency: number; // Average execution latency in minutes
  partDefects: number; // Failed job count
}

/**
 * Calculate Worker Proficiency Score (0-100)
 * Based on Section 1 of worker_KPI_calculations.md
 */
export async function calculateWorkerProficiency(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerProficiencyResult> {
  const { startDate, endDate } = dateRange;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  }).lean();

  const totalAssignedTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const failedTasks = tasks.filter((t) => t.status === "FAILED").length;
  const tasksWithinEstimate = tasks.filter(
    (t) =>
      t.status === "COMPLETED" &&
      t.actualDuration &&
      t.estimatedDuration &&
      t.actualDuration <= t.estimatedDuration
  ).length;

  // Component 1: Completion Rate (40 points)
  const completionRate =
    totalAssignedTasks > 0 ? (completedTasks / totalAssignedTasks) * 40 : 0;

  // Component 2: Quality Score (30 points)
  const qualityScore =
    completedTasks > 0
      ? ((completedTasks - failedTasks) / completedTasks) * 30
      : 0;

  // Component 3: Speed Efficiency (20 points)
  const speedEfficiency =
    completedTasks > 0 ? (tasksWithinEstimate / completedTasks) * 20 : 0;

  // Component 4: Consistency (10 points)
  const completedTaskDurations = tasks
    .filter(
      (t) =>
        t.status === "COMPLETED" && t.actualDuration && t.actualDuration > 0
    )
    .map((t) => t.actualDuration!);

  let consistency = 0;
  if (completedTaskDurations.length > 1) {
    const meanDuration =
      completedTaskDurations.reduce((sum, d) => sum + d, 0) /
      completedTaskDurations.length;
    const variance =
      completedTaskDurations.reduce(
        (sum, d) => sum + Math.pow(d - meanDuration, 2),
        0
      ) / completedTaskDurations.length;
    const stdDeviation = Math.sqrt(variance);
    consistency = Math.max(0, (1 - stdDeviation / meanDuration) * 10);
  } else if (completedTaskDurations.length === 1) {
    consistency = 10; // Perfect consistency with one task
  }

  // Final Score
  const proficiencyScore =
    completionRate + qualityScore + speedEfficiency + consistency;

  // Classification
  let level: "initial" | "intermediate" | "advanced";
  if (proficiencyScore >= 75) {
    level = "advanced";
  } else if (proficiencyScore >= 40) {
    level = "intermediate";
  } else {
    level = "initial";
  }

  return {
    score: Math.min(100, Math.max(0, proficiencyScore)),
    level,
    breakdown: {
      completionRate,
      qualityScore,
      speedEfficiency,
      consistency
    }
  };
}

/**
 * Calculate Worker Overtime Hours (duration-based)
 * Based on Section 4 of worker_KPI_calculations.md
 */
export async function calculateWorkerOvertimeHours(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    status: "COMPLETED",
    completedAt: { $gte: startDate, $lte: endDate },
    estimatedDuration: { $exists: true, $gt: 0 },
    actualDuration: { $exists: true, $gt: 0 }
  }).lean();

  let totalOvertimeSeconds = 0;

  tasks.forEach((task) => {
    if (
      task.estimatedDuration &&
      task.actualDuration &&
      task.actualDuration > task.estimatedDuration
    ) {
      // Convert minutes to seconds for calculation
      const overtimeMinutes = task.actualDuration - task.estimatedDuration;
      totalOvertimeSeconds += overtimeMinutes * 60;
    }
  });

  // Convert seconds to hours
  return totalOvertimeSeconds / 3600;
}

/**
 * Calculate Worker Job Processing Delay Count
 * Based on Section 5 of worker_KPI_calculations.md
 */
export async function calculateWorkerJobProcessingDelays(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    completedAt: { $gte: startDate, $lte: endDate }
  }).lean();

  let delayCount = 0;

  tasks.forEach((task) => {
    // Delay Type 1: Missed Deadline
    if (task.deadline && task.completedAt && task.completedAt > task.deadline) {
      delayCount++;
      return; // Count once per task
    }

    // Delay Type 2: Exceeded Estimated Duration
    if (
      task.estimatedDuration &&
      task.actualDuration &&
      task.actualDuration > task.estimatedDuration
    ) {
      delayCount++;
      return; // Count once per task
    }
  });

  return delayCount;
}

/**
 * Calculate Worker Job Processing Latency (Average Execution Latency)
 * Based on Section 6 of worker_KPI_calculations.md
 * Excludes tasks with 0 estimated duration
 */
export async function calculateWorkerJobProcessingLatency(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    status: "COMPLETED",
    completedAt: { $gte: startDate, $lte: endDate },
    estimatedDuration: { $exists: true, $gt: 0 },
    actualDuration: { $exists: true, $gt: 0 }
  }).lean();

  const latencies: number[] = [];

  tasks.forEach((task) => {
    if (
      task.estimatedDuration &&
      task.actualDuration &&
      task.estimatedDuration > 0
    ) {
      const executionLatency = task.actualDuration - task.estimatedDuration;
      latencies.push(executionLatency);
    }
  });

  if (latencies.length === 0) {
    return 0;
  }

  const avgLatency =
    latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  return avgLatency; // Returns in minutes
}

/**
 * Calculate Worker Failed Job Count (Part Defects)
 * Based on Section 7 of worker_KPI_calculations.md
 */
export async function calculateWorkerFailedJobCount(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const failedCount = await Task.countDocuments({
    workerId: new mongoose.Types.ObjectId(workerId),
    status: "FAILED",
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  });

  return failedCount;
}

/**
 * Get comprehensive Worker KPI Data
 */
export async function getWorkerKPIData(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerKPIData | null> {
  const worker = await User.findById(workerId).lean();
  if (!worker) {
    return null;
  }

  // Calculate all KPIs in parallel
  const [
    proficiency,
    totalWorkingHoursData,
    productionVolume,
    overtimeHours,
    jobProcessingDelays,
    jobProcessingLatency,
    partDefects
  ] = await Promise.all([
    calculateWorkerProficiency(dateRange, workerId),
    calculateWorkerHours(dateRange, workerId),
    Task.countDocuments({
      workerId: new mongoose.Types.ObjectId(workerId),
      status: "COMPLETED",
      completedAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      }
    }),
    calculateWorkerOvertimeHours(dateRange, workerId),
    calculateWorkerJobProcessingDelays(dateRange, workerId),
    calculateWorkerJobProcessingLatency(dateRange, workerId),
    calculateWorkerFailedJobCount(dateRange, workerId)
  ]);

  const totalWorkingHours =
    totalWorkingHoursData.length > 0 ? totalWorkingHoursData[0].totalHours : 0;

  return {
    workerId,
    workerName: worker.name,
    department: worker.department || "N/A",
    proficiency,
    totalWorkingHours,
    productionVolume,
    overtimeHours,
    jobProcessingDelays,
    jobProcessingLatency,
    partDefects
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get translation value from TRANSLATIONS object
 * @param path Dot notation path to translation (e.g., "titles.workerPerformanceRankings")
 * @param lang Language code ("en" or "ko"), defaults to "en"
 * @returns Translated string value
 */
function getTranslation(path: string, lang: string = "en"): string {
  const keys = path.split(".");
  let value: any = TRANSLATIONS;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation not found for path: ${path}`);
      return path;
    }
  }

  if (typeof value === "object" && value !== null && lang in value) {
    return value[lang];
  }

  console.warn(`Language "${lang}" not found for path: ${path}`);
  return path;
}

// ==================== SHEET GENERATION FUNCTIONS ====================

/**
 * Generate Worker Performance KPI Report Sheet
 * Single sheet with one row per worker (personalized report)
 */
export async function generateWorkerKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  workerId: string,
  lang?: string
): Promise<void> {
  console.log("Generating Worker KPI Sheet...");

  const worksheet = workbook.addWorksheet("Worker KPI");

  // Configure page for A4 portrait and fit-to-width (6 columns max)
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
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

  // Get KPI data
  const kpiData = await getWorkerKPIData(dateRange, workerId);
  if (!kpiData) {
    throw new Error("Worker not found or no data available");
  }

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  // ===== COMPACT 6-COLUMN HEADER + APPROVAL BLOCK =====
  // Layout (6 columns A-F total):
  // Row 1: [A-B] REPORT_TITLE | [C-D] 관리자 (MANAGER) | [E-F] 대표 (CEO)
  // Row 2: [A-B] REPORT_PERIOD | [C-D] 작업자 (WORKER) | [E-F] blank

  // ===== ROW 1: (Title + Period) + Manager + CEO =====
  worksheet.mergeCells(currentRow, 1, currentRow, 3); // A-C
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = `${getTranslation("workerKPI.title", lang)}`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true
  };
  titleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // Manager approval (D-E)
  worksheet.mergeCells(currentRow, 4, currentRow, 5);
  const managerCell = worksheet.getCell(currentRow, 4);
  managerCell.value = `${getTranslation(
    "roles.manager",
    lang
  )}\n____년  __월  __일`;
  managerCell.font = { bold: true, size: 10 };
  managerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  managerCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  managerCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // CEO approval (F-G)
  worksheet.mergeCells(currentRow, 6, currentRow, 7);
  const ceoCell = worksheet.getCell(currentRow, 6);
  ceoCell.value = `${getTranslation("roles.ceo", lang)}\n____년  __월  __일`;
  ceoCell.font = { bold: true, size: 10 };
  ceoCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  ceoCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  ceoCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "medium" }
  };

  worksheet.getRow(currentRow).height = 100; // Tall for signature space
  currentRow++;

  // ===== ROW 2: Basic Information + Worker =====
  worksheet.mergeCells(currentRow, 1, currentRow, 3); // A-C
  const workerInfoCell = worksheet.getCell(currentRow, 1);
  workerInfoCell.value = `${getTranslation(
    "workerKPI.period",
    lang
  )}: ${formatDate(dateRange.startDate)} ~ ${formatDate(
    dateRange.endDate
  )}\n${getTranslation("workerKPI.workerName", lang)}: ${
    kpiData.workerName || "N/A"
  }\n${getTranslation("workerKPI.department", lang)}: ${
    kpiData.department || "N/A"
  }`;
  workerInfoCell.font = { size: 10, bold: true };
  workerInfoCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true
  };
  workerInfoCell.border = {
    top: { style: "thin" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "thin" }
  };

  // Worker approval (D-E)
  worksheet.mergeCells(currentRow, 4, currentRow, 5);
  const workerCell = worksheet.getCell(currentRow, 4);
  workerCell.value = `${getTranslation(
    "roles.worker",
    lang
  )}\n____년  __월  __일`;
  workerCell.font = { bold: true, size: 10 };
  workerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  workerCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  workerCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "thin" }
  };

  // Blank space (F-G)
  worksheet.mergeCells(currentRow, 6, currentRow, 7);
  const blankCell = worksheet.getCell(currentRow, 6);
  blankCell.value = "";
  blankCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "thin" }
  };

  worksheet.getRow(currentRow).height = 100; // Tall for signature space
  currentRow += 2;

  // ===== KPI DATA SECTION - VERTICAL LABEL-VALUE FORMAT =====
  // Format: 4 columns for label (A-D), 3 columns for value (E-G)
  // KPI DATA HEADER
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const kpiHeaderCell = worksheet.getCell(currentRow, 1);
  kpiHeaderCell.value = getTranslation("titles.kpi", lang);
  kpiHeaderCell.font = { bold: true, size: 10 };
  kpiHeaderCell.alignment = { horizontal: "left", vertical: "top" };
  kpiHeaderCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
  // KPI DATA HEADER VALUES
  worksheet.mergeCells(currentRow, 5, currentRow, 7);
  const kpiHeaderValuesCell = worksheet.getCell(currentRow, 5);
  kpiHeaderValuesCell.value = getTranslation("titles.kpiValue", lang);
  kpiHeaderValuesCell.font = { bold: true, size: 10 };
  kpiHeaderValuesCell.alignment = { horizontal: "center", vertical: "top" };
  kpiHeaderValuesCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
  worksheet.getRow(currentRow - 1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  // KPI DATA ROWS
  const kpiRows = [
    {
      label: getTranslation("workerKPI.proficiencyLevel", lang),
      value:
        kpiData.proficiency.level === "advanced"
          ? getTranslation("workerKPI.advanced", lang)
          : kpiData.proficiency.level === "intermediate"
          ? getTranslation("workerKPI.intermediate", lang)
          : getTranslation("workerKPI.initial", lang),
      type: "proficiencyLevel",
      level: kpiData.proficiency.level
    },
    {
      label: getTranslation("workerKPI.proficiencyScore", lang),
      value: kpiData.proficiency.score.toFixed(1),
      type: "proficiencyScore",
      score: kpiData.proficiency.score
    },
    {
      label: getTranslation("workerKPI.totalWorkingHours", lang),
      value: kpiData.totalWorkingHours.toFixed(2),
      type: "number"
    },
    {
      label: getTranslation("workerKPI.productionVolume", lang),
      value: kpiData.productionVolume,
      type: "number"
    },
    {
      label: getTranslation("workerKPI.overtimeHours", lang),
      value: kpiData.overtimeHours.toFixed(2),
      type: "flag",
      flagValue: kpiData.overtimeHours
    },
    {
      label: getTranslation("workerKPI.jobProcessingDelays", lang),
      value: kpiData.jobProcessingDelays,
      type: "flag",
      flagValue: kpiData.jobProcessingDelays
    },
    {
      label: getTranslation("workerKPI.jobProcessingLatency", lang),
      value: kpiData.jobProcessingLatency.toFixed(2),
      type: "flag",
      flagValue: kpiData.jobProcessingLatency
    },
    {
      label: getTranslation("workerKPI.partDefects", lang),
      value: kpiData.partDefects,
      type: "flag",
      flagValue: kpiData.partDefects
    }
  ];

  kpiRows.forEach((kpiRow) => {
    // Label cells (A-D)
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = kpiRow.label;
    labelCell.font = { bold: true, size: 11 };
    labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    labelCell.border = {
      top: { style: "thin" },
      left: { style: "medium" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Value cells (E-G)
    worksheet.mergeCells(currentRow, 5, currentRow, 7);
    const valueCell = worksheet.getCell(currentRow, 5);
    valueCell.value = kpiRow.value;
    valueCell.font = { size: 11 };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "medium" }
    };

    // Apply conditional formatting based on type
    if (kpiRow.type === "proficiencyLevel") {
      if (kpiRow.level === "advanced") {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
        };
        valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
      } else if (kpiRow.level === "intermediate") {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.WARNING }
        };
        valueCell.font = { bold: true, color: { argb: "000000" }, size: 11 };
      } else {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.DANGER }
        };
        valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
      }
    } else if (kpiRow.type === "proficiencyScore") {
      const score = kpiRow.score || 0;
      if (score >= 75) {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
        };
        valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
      } else if (score >= 40) {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.WARNING }
        };
        valueCell.font = { bold: true, color: { argb: "000000" }, size: 11 };
      } else {
        valueCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.DANGER }
        };
        valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
      }
    } else if (
      kpiRow.type === "flag" &&
      kpiRow.flagValue !== undefined &&
      kpiRow.flagValue > 0
    ) {
      // Red flag for overtime, delays, latency, defects
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.DANGER }
      };
      valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    }

    worksheet.getRow(currentRow).height = 25;
    currentRow++;
  });

  // Column widths optimized for 6 columns on A4 portrait
  worksheet.getColumn(1).width = 12; // Label start
  worksheet.getColumn(2).width = 12; // Label middle
  worksheet.getColumn(3).width = 12; // Label end
  worksheet.getColumn(4).width = 12; // Value start
  worksheet.getColumn(5).width = 12; // Value middle
  worksheet.getColumn(6).width = 12; // Value end
  worksheet.getColumn(7).width = 12; // Blank space

  console.log(`✓ Worker KPI Sheet generated for worker: ${kpiData.workerName}`);
}

/**
 * Interface for Worker Performance Summary Data
 */
export interface WorkerPerformanceSummaryData {
  sequence: number;
  workerId: string;
  workerName: string;
  department: string;
  totalWorkHours: number; // in hours
  overtimeHours: number; // in hours
  productionVolume: number; // count of completed tasks
  defectCount: number; // count of failed tasks
  workDelayRate: number; // percentage (0-100)
  remarks?: string;
}

/**
 * Get Worker Performance Summary Data for all workers
 */
export async function getWorkerPerformanceSummaryData(
  dateRange: DateRangeFilter
): Promise<WorkerPerformanceSummaryData[]> {
  const { startDate, endDate } = dateRange;

  // Calculate number of weeks in the period for overtime calculation
  const daysInPeriod =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const weeksInPeriod = daysInPeriod / 7;
  const standardHoursPerPeriod = weeksInPeriod * 40; // 40 hours per week

  // Get all tasks in the date range with worker assignments
  const tasks = await Task.find({
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("workerId", "name department")
    .lean();

  // Group tasks by worker
  const workerMap = new Map<
    string,
    {
      workerId: string;
      workerName: string;
      department: string;
      tasks: any[];
    }
  >();

  tasks.forEach((task) => {
    const worker = task.workerId as any;
    if (!worker || !worker._id) return;

    const workerId = worker._id.toString();
    if (!workerMap.has(workerId)) {
      workerMap.set(workerId, {
        workerId,
        workerName: worker.name || "Unknown",
        department: worker.department || "N/A",
        tasks: []
      });
    }
    workerMap.get(workerId)!.tasks.push(task);
  });

  // Calculate metrics for each worker
  const summaryData: WorkerPerformanceSummaryData[] = [];

  workerMap.forEach((workerData) => {
    const workerTasks = workerData.tasks;
    const completedTasks = workerTasks.filter((t) => t.status === "COMPLETED");
    const failedTasks = workerTasks.filter((t) => t.status === "FAILED");

    // Total Work Hours: Sum of actual durations (convert minutes to hours)
    const totalWorkHours =
      completedTasks.reduce((sum, task) => {
        return sum + (task.actualDuration || 0);
      }, 0) / 60; // Convert minutes to hours

    // Overtime: max(0, Total Hours - Standard Hours)
    const overtimeHours = Math.max(0, totalWorkHours - standardHoursPerPeriod);

    // Production Volume: Count of completed tasks
    const productionVolume = completedTasks.length;

    // Defect Count: Count of failed tasks
    const defectCount = failedTasks.length;

    // Work Delay Rate: (Delayed Tasks / Total Tasks) * 100%
    // Delayed Task: CompletedAt > Deadline OR ActualDuration > EstimatedDuration
    const totalTasks = workerTasks.length;
    let delayedTasks = 0;

    workerTasks.forEach((task) => {
      let isDelayed = false;

      // Check if missed deadline
      if (task.deadline && task.completedAt) {
        if (new Date(task.completedAt) > new Date(task.deadline)) {
          isDelayed = true;
        }
      }

      // Check if exceeded estimated duration
      if (
        !isDelayed &&
        task.estimatedDuration &&
        task.actualDuration &&
        task.actualDuration > task.estimatedDuration
      ) {
        isDelayed = true;
      }

      if (isDelayed) {
        delayedTasks++;
      }
    });

    const workDelayRate =
      totalTasks > 0 ? (delayedTasks / totalTasks) * 100 : 0;

    summaryData.push({
      sequence: 0, // Will be set when sorting
      workerId: workerData.workerId,
      workerName: workerData.workerName,
      department: workerData.department,
      totalWorkHours,
      overtimeHours,
      productionVolume,
      defectCount,
      workDelayRate
    });
  });

  // Sort by worker name and assign sequence numbers
  summaryData.sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department);
    }
    return a.workerName.localeCompare(b.workerName);
  });

  summaryData.forEach((data, index) => {
    data.sequence = index + 1;
  });

  return summaryData;
}

/**
 * Format hours and minutes from decimal hours
 * Example: 52.5 hours -> "52시간30분"
 */
function formatHoursMinutes(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours}시간`;
  }
  return `${wholeHours}시간${minutes}분`;
}

/**
 * Generate Worker Performance Summary Sheet
 * New format: List of all workers with performance metrics
 */
export async function generateWorkerPerformanceSummarySheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang: string = "ko"
): Promise<void> {
  console.log("Generating Worker Performance Summary Sheet...");

  const worksheet = workbook.addWorksheet("Worker Performance Summary");

  // Configure page for A4 landscape
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

  // Get summary data for all workers
  const summaryData = await getWorkerPerformanceSummaryData(dateRange);

  const periodText = `${formatDateKorean(
    dateRange.startDate
  )}~${formatDateKorean(dateRange.endDate)}`;

  // ===== TITLE ROW =====
  worksheet.mergeCells(currentRow, 1, currentRow, 9);
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = getTranslation("titles.workerPerformanceReport", lang);
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 35;
  currentRow++;

  // ===== PERIOD AND SIGNATURE BLOCK ROW =====
  // Left side: Period
  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const periodCell = worksheet.getCell(currentRow, 1);
  periodCell.value = `${getTranslation(
    "workerKPI.period",
    lang
  )}: ${periodText}`;
  periodCell.font = { size: 11, bold: true };
  periodCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // Approval section (작성/검토/승인) - right side
  const approvalCols = [
    { col: 7, label: "workerKPI.prepared" },
    { col: 8, label: "workerKPI.reviewed" },
    { col: 9, label: "workerKPI.approved" }
  ];

  approvalCols.forEach((col) => {
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = `${getTranslation(col.label, lang)}`;
    cell.font = { size: 14 };
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

  // Row 4: Blank Signature cells
  // Blank Signature cells
  approvalCols.forEach((col) => {
    worksheet.mergeCells(currentRow, col.col, currentRow + 3, col.col);
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = "";
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    // Date Row
    worksheet.mergeCells(currentRow + 4, col.col, currentRow + 4, col.col);
    const dateCell = worksheet.getCell(currentRow + 4, col.col);
    dateCell.value = formatDateKorean(new Date());
    dateCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    dateCell.font = { size: 14 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow + 4).height = 24;
  });
  currentRow += 6;

  // ===== TABLE HEADERS =====
  const headers = [
    "순번", // Sequence
    "이름", // Name
    "소속", // Department
    "총 작업시간", // Total Work Hours
    "초과 근무시간", // Overtime
    "생산량", // Production Volume
    "불량 발생건 수", // Defect Count
    "작업 지연률", // Work Delay Rate
    "비고" // Remarks
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  // ===== DATA ROWS =====
  summaryData.forEach((worker, index) => {
    const row = [
      worker.sequence,
      worker.workerName,
      worker.department,
      formatHoursMinutes(worker.totalWorkHours),
      formatHoursMinutes(worker.overtimeHours),
      worker.productionVolume,
      worker.defectCount,
      `${worker.workDelayRate.toFixed(0)}%`,
      worker.remarks || ""
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal:
          idx === 0 || idx === 4 || idx === 5 || idx === 6 || idx === 7
            ? "center"
            : "left",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Alternating row colors
      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 8; // 순번
  worksheet.getColumn(2).width = 15; // 이름
  worksheet.getColumn(3).width = 15; // 소속
  worksheet.getColumn(4).width = 18; // 총 작업시간
  worksheet.getColumn(5).width = 18; // 초과 근무시간
  worksheet.getColumn(6).width = 12; // 생산량
  worksheet.getColumn(7).width = 15; // 불량 발생건 수
  worksheet.getColumn(8).width = 15; // 작업 지연률
  worksheet.getColumn(9).width = 15; // 비고

  console.log(
    `✓ Worker Performance Summary Sheet generated with ${summaryData.length} workers`
  );
}
