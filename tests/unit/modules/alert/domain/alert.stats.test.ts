import { buildAlertStats } from "../../../../../src/modules/alert/domain/alert.stats";

describe("buildAlertStats", () => {
  it("computes trends and overall stats from row slices", () => {
    const currentPeriod = [
      { level: "CRITICAL", status: "UNREAD", createdAt: new Date() },
      { level: "LOW", status: "RESOLVED", createdAt: new Date() }
    ];
    const previousPeriod = [
      { level: "LOW", status: "UNREAD", createdAt: new Date() }
    ];
    const all = [
      ...currentPeriod,
      { level: "MEDIUM", status: "READ", createdAt: new Date() }
    ];

    const result = buildAlertStats({
      currentPeriod,
      previousPeriod,
      todayNewAlerts: 5,
      all
    });

    expect(result.stats.total).toBe(3);
    expect(result.stats.critical).toBe(1);
    expect(result.todayNewAlerts).toBe(5);
    expect(result.trends.total).toBe(100);
  });

  it("averages response time from acknowledgments in current period", () => {
    const t0 = new Date("2026-01-01T10:00:00.000Z");
    const t1 = new Date("2026-01-01T10:30:00.000Z");
    const currentPeriod = [
      {
        level: "LOW",
        status: "READ",
        createdAt: t0,
        acknowledgedAt: t1
      }
    ];

    const result = buildAlertStats({
      currentPeriod,
      previousPeriod: [],
      todayNewAlerts: 0,
      all: currentPeriod
    });

    expect(result.avgResponseTime).toBe(30);
  });
});
