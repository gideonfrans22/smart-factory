import { createRawMaterialType } from "../../../../../src/modules/raw-material-type/domain/raw-material-type.create";
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

describe("createRawMaterialType", () => {
  it("inserts when code+name pair is unused", async () => {
    const inserted = record({ id: "507f1f77bcf86cd799439012" });
    const repo = {
      findActiveByCodeAndName: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(inserted)
    };

    const result = await createRawMaterialType(
      { repo: repo as never },
      { code: " RM-1 ", name: " Steel ", createdBy: "507f1f77bcf86cd799439011" }
    );

    expect(repo.findActiveByCodeAndName).toHaveBeenCalledWith("RM-1", "Steel");
    expect(repo.insert).toHaveBeenCalledWith({
      code: "RM-1",
      name: "Steel",
      createdBy: "507f1f77bcf86cd799439011"
    });
    expect(result).toBe(inserted);
  });

  it("rejects when the same active code+name pair exists", async () => {
    const repo = {
      findActiveByCodeAndName: jest.fn().mockResolvedValue(record()),
      insert: jest.fn()
    };

    await expect(
      createRawMaterialType({ repo: repo as never }, { code: "RM-1", name: "Steel" })
    ).rejects.toMatchObject({
      name: "RawMaterialTypeDomainError",
      errorCode: "DUPLICATE_CODE_NAME",
      statusCode: 409
    });

    expect(repo.insert).not.toHaveBeenCalled();
  });
});
