import { Request, Response } from "express";
import mongoose from "mongoose";
import { Task } from "../models/Task";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { User } from "../models/User";
import { Project } from "../models/Project";
import { GridLayout } from "../models/GridLayout";
import { APIResponse } from "../types";

/**
 * GET /api/dashboard/monitor-overview
 * Get aggregated metrics for Monitor TV display
 *
 * 수정 기준:
 * - 전체 작업 진행률: 금일 완료 + 미완료(ONGOING/PENDING/PAUSED) 기준
 * - 납품일 기준 현황: 납기 임박(6시간 이내) + 납기 지연(납기일 지남)
 * - 작업인원: role="worker"인 사용자만
 * - 에러유형 Top 5: 항상 5가지 유형 표시 (0건이어도)
 * - 생산성: 일간(오늘), 주간(월~일), 월간(월초~월말) 현재까지 기준
 */
export const getMonitorOverview = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Use Korea Standard Time (KST = UTC+9)
    const now = new Date();
    const KST_OFFSET = 9 * 60 * 60 * 1000; // 9 hours in milliseconds
    const nowKST = new Date(now.getTime() + KST_OFFSET);

    // Time boundaries
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // 일간: 오늘 자정 (AM 00:00) ~ PM 11:59 (KST 기준)
    const todayStartKST = new Date(
      Date.UTC(
        nowKST.getUTCFullYear(),
        nowKST.getUTCMonth(),
        nowKST.getUTCDate(),
        0,
        0,
        0
      ) - KST_OFFSET
    );
    const todayStart = todayStartKST;

    // 주간: 이번 주 월요일 ~ 현재 (KST 기준)
    const dayOfWeekNum = nowKST.getUTCDay(); // 0 = Sunday
    const mondayOffset = dayOfWeekNum === 0 ? 6 : dayOfWeekNum - 1;
    const weekStartKST = new Date(
      Date.UTC(
        nowKST.getUTCFullYear(),
        nowKST.getUTCMonth(),
        nowKST.getUTCDate() - mondayOffset,
        0,
        0,
        0
      ) - KST_OFFSET
    );
    const weekStart = weekStartKST;

    // 월간: 이번 달 1일 ~ 현재 (KST 기준)
    const monthStartKST = new Date(
      Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1, 0, 0, 0) -
        KST_OFFSET
    );
    const monthStart = monthStartKST;

    // Get days in current month for context
    const daysInMonth = new Date(
      nowKST.getUTCFullYear(),
      nowKST.getUTCMonth() + 1,
      0
    ).getDate();
    const dayOfMonth = nowKST.getUTCDate();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Sunday = 7

    // 삭제된 프로젝트의 task 제외 (getTaskStatistics와 동일 기준)
    const activeProjects = await Project.find().select("_id").lean();
    const activeProjectIds = activeProjects.map((p) => p._id);
    const projectFilter = { projectId: { $in: activeProjectIds } };

    // === 배치도 기반 장비 필터링 ===
    // isMonitorDisplay=true인 GridLayout에 배치된 장비만 기준으로 설비 상태/가동률 계산
    const monitorLayouts = await GridLayout.find({ isMonitorDisplay: true })
      .select("devices.deviceId")
      .lean();
    const monitorDeviceIds = [
      ...new Set(
        monitorLayouts.flatMap((layout) =>
          layout.devices.map((d: any) => d.deviceId.toString())
        )
      )
    ].map((id) => new mongoose.Types.ObjectId(id));
    // Bug fix: Device.countDocuments() does NOT trigger the pre(/^find/) hook, so
    // isActive filter must be applied explicitly to exclude soft-deleted devices.
    const monitorDeviceFilter =
      monitorDeviceIds.length > 0
        ? { _id: { $in: monitorDeviceIds }, isActive: { $ne: false } }
        : { isActive: { $ne: false } }; // fallback: 배치도가 없으면 전체 활성 장비

    // Work-time aggregation device filter (Task.deviceId ↔ monitored devices)
    const workTimeDeviceFilter: Record<string, any> =
      monitorDeviceIds.length > 0
        ? { deviceId: { $in: monitorDeviceIds } }
        : { deviceId: { $exists: true, $ne: null } };

    // Run all queries in parallel
    const [
      // 전체 작업 진행률 (금일 완료 + 미완료 기준)
      completedTasksToday,
      ongoingTasks,
      pendingTasks,
      pausedTasks,

      // 납품일 기준 현황 (납기 임박 6시간 + 납기 지연)
      deadlineImminentTasks, // 납기 6시간 이내
      deadlineDelayedTasks, // 납기 지남

      // 생산성 현황 - Daily (오늘 AM00:00 ~ 현재)
      dailyCompletedTasks,
      dailyTotalTasks,

      // 생산성 현황 - Weekly (월요일 ~ 현재)
      weeklyCompletedTasks,
      weeklyTotalTasks,

      // 생산성 현황 - Monthly (월초 ~ 현재)
      monthlyCompletedTasks,
      monthlyTotalTasks,

      // Equipment Utilization (real-time)
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      errorDevices,

      // Equipment Utilization - Actual Work Time (분)
      dailyWorkTimeResult, // 일간 총 작업시간 (분)
      weeklyWorkTimeResult, // 주간 총 작업시간 (분)
      monthlyWorkTimeResult, // 월간 총 작업시간 (분)

      // Workers - only role="worker" (사용자 마스터에서 "작업자"로 분류된 수만)
      totalWorkers,
      activeWorkers,
      pausedWorkers,

      // Alert Summary
      newAlerts24h, // 24시간 내 생성된 알림
      overdueAlerts, // 24시간 이전 생성, 미해결
      resolvedToday, // 오늘 해결된 알림
      pendingAlerts, // 전체 미해결 알림
      highPriorityAlerts, // 긴급 미해결 알림

      // Top 5 Devices with Most Alerts (for 설비 현황 page - 3페이지)
      topDevicesWithAlerts,

      // Error Types Counts (for 전체 현황 page - 1페이지) - 모든 유형 각각 카운트
      errorTypeCounts
    ] = await Promise.all([
      // === 전체 작업 진행률 (금일 작업지시 기준) ===
      // 오늘 생성되고 오늘 완료된 작업 수 (일간 생산성과 동일 기준)
      Task.countDocuments({
        ...projectFilter,
        status: "COMPLETED",
        createdAt: { $gte: todayStart },
        completedAt: { $gte: todayStart }
      }),
      // 오늘 생성된 작업 중 진행 중인 작업
      Task.countDocuments({
        ...projectFilter,
        status: "ONGOING",
        createdAt: { $gte: todayStart }
      }),
      // 오늘 생성된 작업 중 대기 중인 작업
      Task.countDocuments({
        ...projectFilter,
        status: "PENDING",
        createdAt: { $gte: todayStart }
      }),
      // 오늘 생성된 작업 중 일시정지된 작업
      Task.countDocuments({
        ...projectFilter,
        status: { $in: ["PAUSED", "PAUSED_EMERGENCY"] },
        createdAt: { $gte: todayStart }
      }),

      // === 납품일 기준 현황 ===
      // 납기 임박: 납기일이 현재~6시간 이내 (미완료 작업)
      Task.countDocuments({
        ...projectFilter,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        deadline: { $exists: true, $gte: now, $lte: sixHoursFromNow }
      }),
      // 납기 지연: 납기일이 지났으나 미완료 작업
      Task.countDocuments({
        ...projectFilter,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        deadline: { $exists: true, $lt: now }
      }),

      // === 생산성 일간: 오늘 (AM00:00 ~ 현재) ===
      // 완료: 오늘 생성되고 오늘 완료된 작업만 카운트
      Task.countDocuments({
        ...projectFilter,
        status: "COMPLETED",
        createdAt: { $gte: todayStart, $lte: now },
        completedAt: { $gte: todayStart, $lte: now }
      }),
      // 목표: 오늘 생성된 작업 수
      Task.countDocuments({
        ...projectFilter,
        createdAt: { $gte: todayStart, $lte: now }
      }),

      // === 생산성 주간: 월요일 ~ 현재 ===
      // 완료: 이번 주에 생성되고 이번 주에 완료된 작업만 카운트
      Task.countDocuments({
        ...projectFilter,
        status: "COMPLETED",
        createdAt: { $gte: weekStart, $lte: now },
        completedAt: { $gte: weekStart, $lte: now }
      }),
      // 목표: 이번 주에 생성된 작업 수
      Task.countDocuments({
        ...projectFilter,
        createdAt: { $gte: weekStart, $lte: now }
      }),

      // === 생산성 월간: 월초 ~ 현재 ===
      // 완료: 이번 달에 생성되고 이번 달에 완료된 작업만 카운트
      Task.countDocuments({
        ...projectFilter,
        status: "COMPLETED",
        createdAt: { $gte: monthStart, $lte: now },
        completedAt: { $gte: monthStart, $lte: now }
      }),
      // 목표: 이번 달에 생성된 작업 수
      Task.countDocuments({
        ...projectFilter,
        createdAt: { $gte: monthStart, $lte: now }
      }),

      // === Equipment Utilization (real-time) - 배치도 기준 장비만 ===
      Device.countDocuments(monitorDeviceFilter),
      Device.countDocuments({ ...monitorDeviceFilter, status: "ONLINE" }),
      Device.countDocuments({ ...monitorDeviceFilter, status: "OFFLINE" }),
      Device.countDocuments({ ...monitorDeviceFilter, status: "MAINTENANCE" }),
      Device.countDocuments({ ...monitorDeviceFilter, status: "ERROR" }),

      // === Equipment Utilization - Actual Work Time (from completed tasks) ===
      // Scoped to monitorDeviceIds for consistency with device count queries.
      // 일간: 오늘 완료된 모니터 장비 작업의 actualDuration 합계 (분)
      Task.aggregate([
        {
          $match: {
            ...projectFilter,
            status: "COMPLETED",
            ...workTimeDeviceFilter,
            completedAt: { $gte: todayStart }
          }
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ["$actualDuration", 0] } }
          }
        }
      ]),
      // 주간: 이번 주 완료된 모니터 장비 작업의 actualDuration 합계 (분)
      Task.aggregate([
        {
          $match: {
            ...projectFilter,
            status: "COMPLETED",
            ...workTimeDeviceFilter,
            completedAt: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ["$actualDuration", 0] } }
          }
        }
      ]),
      // 월간: 이번 달 완료된 모니터 장비 작업의 actualDuration 합계 (분)
      Task.aggregate([
        {
          $match: {
            ...projectFilter,
            status: "COMPLETED",
            ...workTimeDeviceFilter,
            completedAt: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ["$actualDuration", 0] } }
          }
        }
      ]),

      // === Workers - role="worker"인 사용자만 ===
      User.countDocuments({ role: "worker", deletedAt: null }),
      // 활동 작업자 수 (DB 기반: ONGOING 작업을 보유한 고유 작업자 수)
      // WebSocket 의존 제거 → 설비 종류와 무관하게 정확한 집계
      Task.distinct("workerId", {
        ...projectFilter,
        status: "ONGOING",
        workerId: { $exists: true, $ne: null }
      }).then((ids) => ids.length),
      // 일시정지 상태인 작업자 수 (unique workerId from PAUSED tasks)
      Task.distinct("workerId", {
        ...projectFilter,
        status: { $in: ["PAUSED", "PAUSED_EMERGENCY"] },
        workerId: { $exists: true, $ne: null }
      }).then((ids) => ids.length),

      // === Alert Summary ===
      // 1. 신규 알림 24시간: 24시간 내 생성된 알림
      Alert.countDocuments({
        createdAt: { $gte: last24Hours }
      }),
      // 2. 오래된 미해결 알림: 24시간 이전에 생성되었는데 아직 미해결
      Alert.countDocuments({
        createdAt: { $lt: last24Hours },
        status: { $in: ["UNREAD", "PENDING"] }
      }),
      // 3. 오늘 해결된 알림: resolvedAt이 오늘인 알림 (생성일 무관)
      Alert.countDocuments({
        status: "RESOLVED",
        resolvedAt: { $gte: todayStart }
      }),
      // 4. 전체 미해결 알림: 현재 pending인 모든 알림 (시간 무관)
      Alert.countDocuments({
        status: { $in: ["UNREAD", "PENDING"] }
      }),
      // 5. 긴급 알림: HIGH/CRITICAL 미해결
      Alert.countDocuments({
        level: { $in: ["HIGH", "CRITICAL"] },
        status: { $nin: ["RESOLVED", "READ"] }
      }),

      // === Top 5 Devices with Most Alerts in Last 24 Hours ===
      Alert.aggregate([
        {
          $match: {
            device: { $exists: true, $ne: null },
            createdAt: { $gte: last24Hours }
          }
        },
        {
          $lookup: {
            from: "devices",
            localField: "device",
            foreignField: "_id",
            as: "deviceInfo"
          }
        },
        { $unwind: "$deviceInfo" },
        {
          $lookup: {
            from: "devicetypes",
            localField: "deviceInfo.deviceTypeId",
            foreignField: "_id",
            as: "deviceType"
          }
        },
        { $unwind: { path: "$deviceType", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$deviceInfo._id",
            deviceName: { $first: "$deviceInfo.name" },
            deviceTypeName: { $first: "$deviceType.name" },
            alertCount: { $sum: 1 }
          }
        },
        { $sort: { alertCount: -1 } },
        { $limit: 5 }
      ]),

      // === Error Types - 각 유형별 카운트 (오늘 KST 기준 AM00:00~PM11:59) ===
      Alert.aggregate([
        {
          $match: {
            createdAt: { $gte: todayStart }
          }
        },
        {
          $group: {
            _id: "$type",
            alertCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // === 전체 작업 진행률 계산 (금일 작업지시 기준) ===
    // 모든 항목 createdAt ≥ 오늘 기준 → 일간 생산성과 동일 집계 기준
    const totalTaskProgress =
      completedTasksToday + ongoingTasks + pendingTasks + pausedTasks;
    const taskProgressPercentage =
      totalTaskProgress > 0
        ? Math.round((completedTasksToday / totalTaskProgress) * 100)
        : 0;

    // === 생산성 계산 ===
    const dailyTotal = Math.max(1, dailyTotalTasks);
    const weeklyTotal = Math.max(1, weeklyTotalTasks);
    const monthlyTotal = Math.max(1, monthlyTotalTasks);

    // 생산성 퍼센트 계산 - 100% 상한
    const dailyPercentage = Math.min(
      100,
      Math.round((dailyCompletedTasks / dailyTotal) * 100)
    );
    const weeklyPercentage = Math.min(
      100,
      Math.round((weeklyCompletedTasks / weeklyTotal) * 100)
    );
    const monthlyPercentage = Math.min(
      100,
      Math.round((monthlyCompletedTasks / monthlyTotal) * 100)
    );

    // === Equipment utilization (real-time) ===
    // Snapshot: currently ONLINE / total active monitor devices
    const equipmentUtilizationPercentage =
      totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;

    // Raw work time (분) from completed tasks on monitor devices
    const dailyWorkMinutes = dailyWorkTimeResult[0]?.totalMinutes || 0;
    const weeklyWorkMinutes = weeklyWorkTimeResult[0]?.totalMinutes || 0;
    const monthlyWorkMinutes = monthlyWorkTimeResult[0]?.totalMinutes || 0;

    // === Equipment utilization - 기간별 실가동률 ===
    // Formula: actualDuration 합계(완료 작업) / (장비수 × 경과시간(분)) × 100
    // This gives distinct values per period that reflect actual device usage trends.
    // Note: only COMPLETED tasks are counted; ONGOING tasks' in-progress time is excluded.
    const totalDevicesForCalc = Math.max(1, totalDevices);

    const dailyElapsedMinutes = Math.max(
      1,
      (now.getTime() - todayStart.getTime()) / (1000 * 60)
    );
    const weeklyElapsedMinutes = Math.max(
      1,
      (now.getTime() - weekStart.getTime()) / (1000 * 60)
    );
    const monthlyElapsedMinutes = Math.max(
      1,
      (now.getTime() - monthStart.getTime()) / (1000 * 60)
    );

    const dailyUtilization = Math.min(
      100,
      Math.round(
        (dailyWorkMinutes / (totalDevicesForCalc * dailyElapsedMinutes)) * 100
      )
    );
    const weeklyUtilization = Math.min(
      100,
      Math.round(
        (weeklyWorkMinutes / (totalDevicesForCalc * weeklyElapsedMinutes)) * 100
      )
    );
    const monthlyUtilization = Math.min(
      100,
      Math.round(
        (monthlyWorkMinutes / (totalDevicesForCalc * monthlyElapsedMinutes)) *
          100
      )
    );

    // === Worker metrics (작업자 role만) ===
    const workerPercentage =
      totalWorkers > 0 ? Math.round((activeWorkers / totalWorkers) * 100) : 0;
    const idleWorkers = Math.max(
      0,
      totalWorkers - activeWorkers - pausedWorkers
    );

    // === Alert summary ===
    const avgResponseTimeMinutes = 12; // TODO: Calculate from actual alert response times
    // Resolution rate: 오늘 해결된 알림 / (오늘 해결 + 미해결) × 100
    // 오늘 얼마나 처리했는지 보여주는 지표
    const totalWorkableAlerts = resolvedToday + pendingAlerts;
    const resolutionRate =
      totalWorkableAlerts > 0
        ? Math.min(100, Math.round((resolvedToday / totalWorkableAlerts) * 100))
        : 100;

    // === Top 5 devices with alerts (for 설비 현황 page) ===
    const maxAlertCount =
      topDevicesWithAlerts.length > 0
        ? Math.max(...topDevicesWithAlerts.map((d: any) => d.alertCount))
        : 0;

    const topDeviceErrors = topDevicesWithAlerts.map((item: any) => {
      const deviceName = item.deviceName || "Unknown Device";
      const deviceTypeName = item.deviceTypeName || "Unknown Type";
      const displayName = `${deviceName}(${deviceTypeName})`;
      return {
        deviceName: displayName,
        alertCount: item.alertCount,
        percentage:
          maxAlertCount > 0
            ? Math.round((item.alertCount / maxAlertCount) * 100)
            : 0
      };
    });

    // === 에러 유형 Top 5 - 항상 5가지 표시 (0건이어도) ===
    const ERROR_TYPES_LIST = [
      { type: "EQUIPMENT_DEFECT", label: "장비결함" },
      { type: "TOOL_CHANGE", label: "툴체인지" },
      { type: "MATERIAL_DEFECT", label: "소재불량" },
      { type: "PROCESSING_DEFECT", label: "가공불량" },
      { type: "OTHER", label: "기타" }
    ];

    // Convert aggregation result to a map for easy lookup
    const errorCountMap: Record<string, number> = {};
    errorTypeCounts.forEach((item: any) => {
      errorCountMap[item._id] = item.alertCount;
    });

    // Build the full list - always 5 items, sorted by count descending
    const fullErrorTypesList = ERROR_TYPES_LIST.map((et) => ({
      errorType: et.type,
      errorTypeName: et.label,
      alertCount: errorCountMap[et.type] || 0
    })).sort((a, b) => b.alertCount - a.alertCount);

    const maxErrorTypeCount = Math.max(
      ...fullErrorTypesList.map((d) => d.alertCount),
      1
    );
    const topErrorTypesList = fullErrorTypesList.map((item) => ({
      ...item,
      percentage:
        maxErrorTypeCount > 0
          ? Math.round((item.alertCount / maxErrorTypeCount) * 100)
          : 0
    }));

    const response: APIResponse = {
      success: true,
      message: "Monitor overview data retrieved successfully",
      data: {
        // === 전체 작업 진행률 (하이브리드: 완료=completedAt, 진행/정지=전체, 대기=createdAt) ===
        taskProgress: {
          percentage: taskProgressPercentage,
          completed: completedTasksToday,
          ongoing: ongoingTasks,
          pending: pendingTasks,
          paused: pausedTasks,
          total: totalTaskProgress
        },
        // === 납품일 기준 현황 (납기준수율 삭제) ===
        deadlineStatus: {
          imminent: deadlineImminentTasks, // 납기 임박 (6시간 이내)
          delayed: deadlineDelayedTasks // 납기 지연 (납기일 지남)
        },
        // === 생산성 현황 ===
        productivity: {
          daily: {
            current: dailyCompletedTasks,
            target: dailyTotal,
            percentage: dailyPercentage
          },
          weekly: {
            current: weeklyCompletedTasks,
            target: weeklyTotal,
            percentage: weeklyPercentage
          },
          monthly: {
            current: monthlyCompletedTasks,
            target: monthlyTotal,
            percentage: monthlyPercentage
          }
        },
        // === Top 5 devices with alerts (for 설비 현황 page - 3페이지) ===
        deviceErrorFrequency: topDeviceErrors,
        // === 에러 유형 Top 5 (항상 5가지 표시, 0건이어도) ===
        errorTypeFrequency: topErrorTypesList,
        // === 장비 가동률 ===
        // 계산 기준: 가동장비수(ONLINE) ÷ 총장비수 × 100%
        // 일간·주간·월간 모두 동일 기준으로 산출
        equipmentUtilization: {
          percentage: equipmentUtilizationPercentage, // 가동장비수 / 총장비수
          // 가동장비수 기반 가동률 (일간·주간·월간 동일)
          daily: dailyUtilization, // 가동장비수 / 총장비수
          weekly: weeklyUtilization, // 가동장비수 / 총장비수
          monthly: monthlyUtilization, // 가동장비수 / 총장비수
          // Raw work time (minutes) - 참고용
          dailyWorkMinutes: dailyWorkMinutes,
          weeklyWorkMinutes: weeklyWorkMinutes,
          monthlyWorkMinutes: monthlyWorkMinutes,
          // Device counts
          online: onlineDevices,
          offline: offlineDevices,
          maintenance: maintenanceDevices,
          error: errorDevices,
          total: totalDevices
        },
        // === 작업인원 (role="worker"만) ===
        workers: {
          online: activeWorkers, // 활동 작업자 수 (WebSocket 접속 OR ONGOING 작업 보유)
          total: totalWorkers, // 사용자 마스터의 "작업자" 분류 인원
          percentage: workerPercentage,
          active: activeWorkers,
          paused: pausedWorkers, // 일시정지 중인 작업자 수
          idle: idleWorkers
        },
        // === 알림 요약 ===
        alerts: {
          newAlerts24h: newAlerts24h, // 24시간 내 신규 알림
          overdueAlerts: overdueAlerts, // 24시간 이전 생성, 미해결 (백로그)
          resolvedToday: resolvedToday, // 오늘 해결된 알림
          pending: pendingAlerts, // 전체 미해결 알림
          highPriority: highPriorityAlerts, // 긴급 미해결 알림
          resolutionRate: resolutionRate, // 해결률 (오늘 해결 / 전체 workable)
          avgResponseTime: avgResponseTimeMinutes,
          // Legacy fields for backward compatibility
          total: pendingAlerts,
          resolved: resolvedToday,
          averageResponseTime: avgResponseTimeMinutes
        },
        // === Context info ===
        periodInfo: {
          daysInMonth: daysInMonth,
          dayOfMonth: dayOfMonth,
          dayOfWeek: dayOfWeek
        },
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get monitor overview error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve monitor overview data"
    };
    res.status(500).json(response);
  }
};

/**
 * GET /api/dashboard/task-status-distribution
 * Get task count by status for donut chart
 */
export const getTaskStatusDistribution = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // 일간: 현재 날짜 기준 (KST AM00:00~PM11:59)
    const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9
    const now = new Date();
    const nowKST = new Date(now.getTime() + KST_OFFSET);

    // Today start at AM00:00 KST
    const todayStartKST = new Date(
      Date.UTC(
        nowKST.getUTCFullYear(),
        nowKST.getUTCMonth(),
        nowKST.getUTCDate(),
        0,
        0,
        0
      ) - KST_OFFSET
    );
    // Today end at PM11:59:59 KST
    const todayEndKST = new Date(
      Date.UTC(
        nowKST.getUTCFullYear(),
        nowKST.getUTCMonth(),
        nowKST.getUTCDate(),
        23,
        59,
        59,
        999
      ) - KST_OFFSET
    );

    const distribution = await Task.aggregate([
      {
        // Filter:
        // 1. 일간: 완료 tasks from today (KST AM00:00~PM11:59)
        // 2. 미완료: All non-completed tasks regardless of date
        $match: {
          $or: [
            // 1. Non-completed tasks (any date)
            { status: { $ne: "COMPLETED" } },
            // 2. Completed tasks from today (KST)
            {
              status: "COMPLETED",
              completedAt: { $gte: todayStartKST, $lte: todayEndKST }
            }
          ]
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const total = distribution.reduce((sum, item) => sum + item.count, 0);

    const formattedDistribution = distribution.map((item) => ({
      status: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));

    const response: APIResponse = {
      success: true,
      message: "Task status distribution retrieved successfully",
      data: {
        total,
        distribution: formattedDistribution
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get task status distribution error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve task status distribution"
    };
    res.status(500).json(response);
  }
};

// ...existing code...

/**
 * GET /api/dashboard/monitor-tasks
 * Get optimized task list for Monitor TV display
 *
 * Optimized for performance:
 * - Server-side filtering (exclude old COMPLETED tasks)
 * - Flattened data structure (no deep populates)
 * - Limited to 100 tasks max
 */
export const getMonitorTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 100, 200); // Cap at 200

    // KST timezone: Today start at AM00:00 KST
    const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9
    const now = new Date();
    const nowKST = new Date(now.getTime() + KST_OFFSET);
    const todayStartKST = new Date(nowKST);
    todayStartKST.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = new Date(todayStartKST.getTime() - KST_OFFSET);

    // Step 1: Find all projectNumbers that have at least one non-COMPLETED task
    // These projects should show ALL their tasks (including completed ones)
    const projectsWithPendingTasks = await Task.distinct("projectNumber", {
      status: { $ne: "COMPLETED" },
      projectNumber: { $ne: null }
    });

    // Use aggregation for optimized data fetching with flattened structure
    const tasks = await Task.aggregate([
      // Stage 1: Filter - 일간 기준 (KST AM00:00~PM11:59)
      // Show: 1) Non-completed tasks, 2) Completed today (KST), 3) Completed tasks from projects with pending tasks
      {
        $match: {
          $or: [
            // 1. All non-completed tasks
            { status: { $ne: "COMPLETED" } },
            // 2. Completed tasks from today (KST)
            {
              status: "COMPLETED",
              completedAt: { $gte: todayStartUTC }
            },
            // 3. Completed tasks from projects that still have pending tasks
            {
              status: "COMPLETED",
              projectNumber: { $in: projectsWithPendingTasks }
            }
          ]
        }
      },
      // Stage 2: Sort by priority and creation date
      {
        $sort: {
          status: 1, // PENDING/ONGOING first
          priority: -1, // URGENT first
          createdAt: -1
        }
      },
      // Stage 3: Limit results
      { $limit: limitNum },
      // Stage 4: Lookup project data (lightweight)
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
          pipeline: [{ $project: { name: 1, targetQuantity: 1, deadline: 1 } }]
        }
      },
      // Stage 5: Lookup product snapshot data
      {
        $lookup: {
          from: "productsnapshots",
          localField: "productSnapshotId",
          foreignField: "_id",
          as: "productSnapshot",
          pipeline: [
            {
              $project: {
                name: 1,
                productNumber: 1,
                customerName: 1,
                department: 1,
                personInCharge: 1
              }
            }
          ]
        }
      },
      // Stage 6: Lookup product data (fallback)
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
          pipeline: [
            {
              $project: {
                productName: 1,
                designNumber: 1,
                customerName: 1,
                department: 1,
                personInCharge: 1
              }
            }
          ]
        }
      },
      // Stage 7: Lookup recipe snapshot for step name and dwgNo
      {
        $lookup: {
          from: "recipesnapshots",
          localField: "recipeSnapshotId",
          foreignField: "_id",
          as: "recipeSnapshot",
          pipeline: [{ $project: { name: 1, steps: 1, dwgNo: 1 } }]
        }
      },
      // Stage 7.5: Lookup device data for equipment name
      {
        $lookup: {
          from: "devices",
          localField: "deviceId",
          foreignField: "_id",
          as: "device",
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      // Stage 7.6: Lookup device type data (for deviceTypeName - separate from deviceName)
      {
        $lookup: {
          from: "devicetypes",
          localField: "deviceTypeId",
          foreignField: "_id",
          as: "deviceType",
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      // Stage 8: Project flattened fields
      {
        $project: {
          _id: 1,
          title: 1,
          status: 1,
          priority: 1,
          progress: 1,
          deadline: 1,
          estimatedDuration: 1,
          actualDuration: 1,
          pausedDuration: 1,
          startedAt: 1,
          projectNumber: 1,
          stepOrder: 1,
          recipeExecutionNumber: 1,
          totalRecipeExecutions: 1,
          completedAt: 1,
          updatedAt: 1,
          createdAt: 1,
          // Flattened project fields
          projectName: { $arrayElemAt: ["$project.name", 0] },
          projectTargetQuantity: {
            $arrayElemAt: ["$project.targetQuantity", 0]
          },
          projectDeadline: { $arrayElemAt: ["$project.deadline", 0] },
          // Flattened product fields (from snapshot or product)
          productName: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.name", 0] },
              { $arrayElemAt: ["$product.productName", 0] }
            ]
          },
          productNumber: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.productNumber", 0] },
              { $arrayElemAt: ["$product.designNumber", 0] }
            ]
          },
          customerName: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.customerName", 0] },
              { $arrayElemAt: ["$product.customerName", 0] }
            ]
          },
          department: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.department", 0] },
              { $arrayElemAt: ["$product.department", 0] }
            ]
          },
          personInCharge: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.personInCharge", 0] },
              { $arrayElemAt: ["$product.personInCharge", 0] }
            ]
          },
          // Recipe snapshot for step name and dwgNo
          recipeName: { $arrayElemAt: ["$recipeSnapshot.name", 0] },
          recipeSteps: { $arrayElemAt: ["$recipeSnapshot.steps", 0] },
          dwgNo: { $arrayElemAt: ["$recipeSnapshot.dwgNo", 0] },
          // Device type name (ONLY from deviceType lookup - NO fallback to avoid duplication)
          deviceTypeName: { $arrayElemAt: ["$deviceType.name", 0] },
          // Device/Equipment name (ONLY from device lookup - NO fallback to deviceType)
          deviceName: { $arrayElemAt: ["$device.name", 0] }
        }
      },
      // Stage 9: Add computed step name, total steps, and device type name from step
      {
        $addFields: {
          stepName: {
            $let: {
              vars: {
                matchedStep: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ["$recipeSteps", []] },
                        as: "step",
                        cond: { $eq: ["$$step.order", "$stepOrder"] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ["$$matchedStep.name", "$recipeName"] }
            }
          },
          // Total steps in recipe
          totalSteps: { $size: { $ifNull: ["$recipeSteps", []] } },
          // Get deviceTypeId from recipe step if task doesn't have deviceTypeId
          stepDeviceTypeId: {
            $let: {
              vars: {
                matchedStep: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ["$recipeSteps", []] },
                        as: "step",
                        cond: { $eq: ["$$step.order", "$stepOrder"] }
                      }
                    },
                    0
                  ]
                }
              },
              in: "$$matchedStep.deviceTypeId"
            }
          }
        }
      },
      // Stage 9.5: Lookup device type from step's deviceTypeId as fallback for deviceTypeName only
      {
        $lookup: {
          from: "devicetypes",
          localField: "stepDeviceTypeId",
          foreignField: "_id",
          as: "stepDeviceType",
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      // Stage 9.6: Final deviceTypeName fallback - use step's deviceType if task doesn't have one
      // deviceName stays as-is (null if no device assigned - no fallback to avoid duplication)
      {
        $addFields: {
          deviceTypeName: {
            $ifNull: [
              "$deviceTypeName", // From task's deviceType
              { $arrayElemAt: ["$stepDeviceType.name", 0] } // Fallback to step's deviceType
            ]
          }
          // deviceName: NOT modified - stays null if no device assigned
        }
      },
      // Stage 10: Remove temporary fields from final output
      {
        $project: {
          recipeSteps: 0,
          stepDeviceTypeId: 0,
          stepDeviceType: 0
        }
      }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Monitor tasks retrieved successfully",
      data: {
        items: tasks,
        total: tasks.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get monitor tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve monitor tasks"
    };
    res.status(500).json(response);
  }
};
