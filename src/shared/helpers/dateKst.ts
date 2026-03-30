/**
 * KST 기준으로 날짜 문자열을 파싱 (dashboard service / task statistics와 동일 기준)
 *
 * "2026-01-29" → 2026-01-29 00:00:00 KST = 2026-01-28T15:00:00.000Z
 * "2026-01-29" (end) → 2026-01-29 23:59:59.999 KST
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function parseDateAsKST(
  dateStr: string,
  isEndOfDay: boolean = false
): Date {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  if (isDateOnly) {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (isEndOfDay) {
      return new Date(
        Date.UTC(year, month - 1, day, 23, 59, 59, 999) - KST_OFFSET_MS
      );
    }
    return new Date(
      Date.UTC(year, month - 1, day, 0, 0, 0, 0) - KST_OFFSET_MS
    );
  }

  return new Date(dateStr);
}
