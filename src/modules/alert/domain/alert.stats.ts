import type { AlertStatsResult } from "../alert.types";

export interface AlertStatsRow {
  level: string;
  status: string;
  createdAt: Date;
  acknowledgedAt?: Date | null;
}

function countBuckets(rows: AlertStatsRow[]): {
  total: number;
  critical: number;
  unread: number;
  pending: number;
  resolved: number;
} {
  return {
    total: rows.length,
    critical: rows.filter((a) => a.level === "CRITICAL").length,
    unread: rows.filter((a) => a.status === "UNREAD").length,
    pending: rows.filter(
      (a) => a.status === "READ" || a.status === "ACKNOWLEDGED"
    ).length,
    resolved: rows.filter((a) => a.status === "RESOLVED").length
  };
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export function buildAlertStats(input: {
  currentPeriod: AlertStatsRow[];
  previousPeriod: AlertStatsRow[];
  todayNewAlerts: number;
  all: AlertStatsRow[];
}): AlertStatsResult {
  const currentStats = countBuckets(input.currentPeriod);
  const previousStats = countBuckets(input.previousPeriod);

  const trends = {
    total: calculateTrend(currentStats.total, previousStats.total),
    critical: calculateTrend(currentStats.critical, previousStats.critical),
    unread: calculateTrend(currentStats.unread, previousStats.unread),
    pending: calculateTrend(currentStats.pending, previousStats.pending)
  };

  const alertsWithAcknowledgment = input.currentPeriod.filter(
    (a) => a.acknowledgedAt && a.createdAt
  );

  let avgResponseTime = 0;
  if (alertsWithAcknowledgment.length > 0) {
    const totalResponseTime = alertsWithAcknowledgment.reduce((sum, row) => {
      const createdAt = new Date(row.createdAt);
      const acknowledgedAt = new Date(row.acknowledgedAt!);
      const diffMinutes =
        (acknowledgedAt.getTime() - createdAt.getTime()) / (1000 * 60);
      return sum + diffMinutes;
    }, 0);
    avgResponseTime = Math.round(
      totalResponseTime / alertsWithAcknowledgment.length
    );
  }

  const overallStats = countBuckets(input.all);

  return {
    stats: overallStats,
    trends,
    avgResponseTime,
    todayNewAlerts: input.todayNewAlerts
  };
}

export function toStatsRow(doc: {
  level: string;
  status: string;
  createdAt: Date;
  acknowledgedAt?: Date | null;
}): AlertStatsRow {
  return {
    level: doc.level,
    status: doc.status,
    createdAt: doc.createdAt,
    acknowledgedAt: doc.acknowledgedAt
  };
}
