import { updateRawMaterialType } from "../../../../../src/modules/raw-material-type/domain/raw-material-type.update";
import type { RawMaterialTypeRecord } from "../../../../../src/modules/raw-material-type/ports/RawMaterialTypeRepo";

function record(overrides: Partial<RawMaterialTypeRecord> = {}): RawMaterialTypeRecord {
  const now = new Date();
  return {
    id: "507f1f77bcf86cd799439011",
    code: "RM-1",
    name: "Steel",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("updateRawMaterialType", () => {
  it("throws NOT_FOUND when row is missing", async () => {
    const repo = {
      findActiveById: jest.fn().mockResolvedValue(null),
      findActiveByCodeAndName: jest.fn(),
      updateActive: jest.fn()
    };

    await expect(
      updateRawMaterialType(
        { repo: repo as never },
        { id: "507f1f77bcf86cd799439011", name: "Alloy" }
      )
    ).rejects.toMatchObject({ errorCode: "NOT_FOUND", statusCode: 404 });

    expect(repo.findActiveByCodeAndName).not.toHaveBeenCalled();
  });

  it("allows same code with a different name than another row (pair uniqueness)", async () => {
    const current = record({ id: "a", code: "C1", name: "Variant A" });
    const repo = {
      findActiveById: jest.fn().mockResolvedValue(current),
      findActiveByCodeAndName: jest.fn().mockResolvedValue(null),
      updateActive: jest.fn().mockResolvedValue(
        record({ id: "a", code: "C1", name: "Variant B" })
      )
    };

    await updateRawMaterialType(
      { repo: repo as never },
      { id: "a", name: "Variant B" }
    );

    expect(repo.findActiveByCodeAndName).toHaveBeenCalledWith("C1", "Variant B");
  });

  it("rejects when another active row already has the target code+name", async () => {
    const current = record({ id: "a", code: "C1", name: "A" });
    const other = record({ id: "b", code: "C2", name: "B" });
    const repo = {
      findActiveById: jest.fn().mockResolvedValue(current),
      findActiveByCodeAndName: jest.fn().mockResolvedValue(other),
      updateActive: jest.fn()
    };

    await expect(
      updateRawMaterialType(
        { repo: repo as never },
        { id: "a", code: "C2", name: "B" }
      )
    ).rejects.toMatchObject({
      errorCode: "DUPLICATE_CODE_NAME",
      statusCode: 409
    });

    expect(repo.updateActive).not.toHaveBeenCalled();
  });

  it("skips duplicate check when trimmed code+name unchanged", async () => {
    const current = record();
    const updated = record({ updatedBy: "507f1f77bcf86cd799439099" });
    const repo = {
      findActiveById: jest.fn().mockResolvedValue(current),
      findActiveByCodeAndName: jest.fn(),
      updateActive: jest.fn().mockResolvedValue(updated)
    };

    await updateRawMaterialType(
      { repo: repo as never },
      {
        id: current.id,
        code: "  RM-1  ",
        name: "  Steel  ",
        updatedBy: "507f1f77bcf86cd799439099"
      }
    );

    expect(repo.findActiveByCodeAndName).not.toHaveBeenCalled();
    expect(repo.updateActive).toHaveBeenCalled();
  });
});
