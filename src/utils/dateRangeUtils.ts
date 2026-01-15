import { DateTime } from "luxon";

/**
 * Date Range Utilities for Scheduled Reports
 * All calculations use Asia/Seoul timezone
 */

const TIMEZONE = "Asia/Seoul";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Get date range for previous day (yesterday)
 * Returns start of yesterday 00:00:00 to end of yesterday 23:59:59
 */
export function getPreviousDayRange(): DateRange {
  const now = DateTime.now().setZone(TIMEZONE);
  const yesterday = now.minus({ days: 1 });

  const startDate = yesterday.startOf("day").toJSDate();
  const endDate = yesterday.endOf("day").toJSDate();

  return { startDate, endDate };
}

/**
 * Get date range for previous week (Monday to Sunday)
 * Returns start of previous Monday 00:00:00 to end of previous Sunday 23:59:59
 */
export function getPreviousWeekRange(): DateRange {
  const now = DateTime.now().setZone(TIMEZONE);
  
  // Get the start of current week (Monday)
  const currentWeekStart = now.startOf("week");
  
  // Previous week is 7 days before current week start
  const previousWeekStart = currentWeekStart.minus({ weeks: 1 });
  const previousWeekEnd = previousWeekStart.endOf("week");

  const startDate = previousWeekStart.toJSDate();
  const endDate = previousWeekEnd.toJSDate();

  return { startDate, endDate };
}

/**
 * Get date range for previous month
 * Returns start of previous month (1st day) 00:00:00 to end of previous month (last day) 23:59:59
 */
export function getPreviousMonthRange(): DateRange {
  const now = DateTime.now().setZone(TIMEZONE);
  
  // Get first day of current month
  const currentMonthStart = now.startOf("month");
  
  // Previous month is 1 month before current month start
  const previousMonthStart = currentMonthStart.minus({ months: 1 });
  const previousMonthEnd = previousMonthStart.endOf("month");

  const startDate = previousMonthStart.toJSDate();
  const endDate = previousMonthEnd.toJSDate();

  return { startDate, endDate };
}

/**
 * Format date for logging/debugging
 */
export function formatDateRange(range: DateRange): string {
  const start = DateTime.fromJSDate(range.startDate)
    .setZone(TIMEZONE)
    .toFormat("yyyy-MM-dd HH:mm:ss");
  const end = DateTime.fromJSDate(range.endDate)
    .setZone(TIMEZONE)
    .toFormat("yyyy-MM-dd HH:mm:ss");
  return `${start} to ${end}`;
}
