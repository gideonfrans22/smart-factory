export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

/**
 * Adjust date range based on period type
 */
export function adjustDateRangeForPeriod(
  startDate: Date,
  endDate: Date,
  period?: "daily" | "weekly" | "monthly"
): DateRangeFilter {
  if (!period) {
    return { startDate, endDate };
  }

  const adjustedStart = new Date(startDate);
  const adjustedEnd = new Date(endDate);

  switch (period) {
    case "daily":
      // Set to start of day and end of same day
      adjustedStart.setHours(0, 0, 0, 0);
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "weekly":
      // Set to Monday of the week containing startDate
      const dayOfWeek = adjustedStart.getDay();
      const diff =
        adjustedStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      adjustedStart.setDate(diff);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to Sunday of the same week
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setDate(adjustedStart.getDate() + 6);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // Set to first day of month
      adjustedStart.setDate(1);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to last day of month
      adjustedEnd.setMonth(adjustedStart.getMonth() + 1);
      adjustedEnd.setDate(0);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { startDate: adjustedStart, endDate: adjustedEnd };
}
