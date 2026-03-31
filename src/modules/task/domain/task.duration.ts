export function computeActualDurationMinutes(
  startedAt: Date,
  completedAt: Date,
  pausedDuration: number
): number {
  const totalDuration = Math.floor(
    (completedAt.getTime() - startedAt.getTime()) / 60000
  );
  return Math.max(0, totalDuration - (pausedDuration || 0));
}
