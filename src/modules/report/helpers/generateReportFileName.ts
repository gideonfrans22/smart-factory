export function generateReportFileName(
  reportType: string,
  startDate: Date,
  endDate: Date
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return `${reportType}_${start}_${end}.xlsx`;
}
