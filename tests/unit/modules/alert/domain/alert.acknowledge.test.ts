import { acknowledgeAlert } from "../../../../../src/modules/alert/domain/alert.acknowledge";

describe("acknowledgeAlert", () => {
  it("returns null when alert is missing", async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      populateAcknowledgedBy: jest.fn()
    };
    const notifier = { emitAlertAcknowledged: jest.fn() };

    const result = await acknowledgeAlert(
      { repo: repo as never, notifier: notifier as never },
      { id: "507f1f77bcf86cd799439011" }
    );

    expect(result).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
    expect(notifier.emitAlertAcknowledged).not.toHaveBeenCalled();
  });

  it("rejects when alert is already resolved", async () => {
    const repo = {
      findById: jest.fn().mockResolvedValue({
        status: "RESOLVED",
        _id: { toString: () => "507f1f77bcf86cd799439011" }
      }),
      save: jest.fn(),
      populateAcknowledgedBy: jest.fn()
    };
    const notifier = { emitAlertAcknowledged: jest.fn() };

    await expect(
      acknowledgeAlert(
        { repo: repo as never, notifier: notifier as never },
        { id: "507f1f77bcf86cd799439011" }
      )
    ).rejects.toMatchObject({
      name: "AlertDomainError",
      errorCode: "ALREADY_RESOLVED",
      statusCode: 400
    });
  });

  it("acknowledges, saves, populates, and emits", async () => {
    const acknowledgedAt = new Date("2026-01-15T12:00:00.000Z");
    jest.useFakeTimers();
    jest.setSystemTime(acknowledgedAt);

    const alert: Record<string, unknown> = {
      status: "UNREAD",
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      acknowledgedAt: null as Date | null
    };

    const repo = {
      findById: jest.fn().mockResolvedValue(alert),
      save: jest.fn().mockImplementation(async () => undefined),
      populateAcknowledgedBy: jest.fn().mockResolvedValue(undefined)
    };
    const notifier = { emitAlertAcknowledged: jest.fn() };

    const result = await acknowledgeAlert(
      { repo: repo as never, notifier: notifier as never },
      { id: "507f1f77bcf86cd799439011", userId: "507f1f77bcf86cd799439099" }
    );

    expect(alert.status).toBe("ACKNOWLEDGED");
    expect(alert.acknowledgedBy).toBe("507f1f77bcf86cd799439099");
    expect(alert.acknowledgedAt).toEqual(acknowledgedAt);
    expect(repo.save).toHaveBeenCalled();
    expect(repo.populateAcknowledgedBy).toHaveBeenCalledWith(alert);
    expect(notifier.emitAlertAcknowledged).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: "507f1f77bcf86cd799439011",
        acknowledgedBy: "507f1f77bcf86cd799439099"
      })
    );
    expect(result).toBe(alert);

    jest.useRealTimers();
  });
});
