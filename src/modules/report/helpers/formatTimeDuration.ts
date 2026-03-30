/**
 * Format time duration in minutes to Korean format (X시간 Y분)
 */
export function formatTimeDuration(minutes: number, lang?: string): string {
  if (lang === "ko") {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0 && mins > 0) {
      return `${hours}시간${mins}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else if (mins > 0) {
      return `${mins}분`;
    }
    return "0분";
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (mins > 0) {
      return `${mins}m`;
    }
    return "0m";
  }
}
