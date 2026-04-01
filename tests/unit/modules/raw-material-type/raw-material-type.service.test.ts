import mongoose from "mongoose";
import { RawMaterialTypeDomainError } from "../../../../src/modules/raw-material-type/domain/errors";
import { createRawMaterialType } from "../../../../src/modules/raw-material-type/domain/raw-material-type.create";
import { updateRawMaterialType } from "../../../../src/modules/raw-material-type/domain/raw-material-type.update";
import { softDeleteRawMaterialType } from "../../../../src/modules/raw-material-type/domain/raw-material-type.soft-delete";
import {
  RawMaterialTypeService
} from "../../../../src/modules/raw-material-type/raw-material-type.service";
import type { RawMaterialTypeRecord } from "../../../../src/modules/raw-material-type/ports/RawMaterialTypeRepo";

jest.mock("../../../../src/modules/raw-material-type/domain/raw-material-type.create");
jest.mock("../../../../src/modules/raw-material-type/domain/raw-material-type.update");
jest.mock("../../../../src/modules/raw-material-type/domain/raw-material-type.soft-delete");

const mockedCreate = createRawMaterialType as jest.MockedFunction<
  typeof createRawMaterialType
>;
const mockedUpdate = updateRawMaterialType as jest.MockedFunction<
  typeof updateRawMaterialType
>;
const mockedSoftDelete = softDeleteRawMaterialType as jest.MockedFunction<
  typeof softDeleteRawMaterialType
>;

function sampleRecord(): RawMaterialTypeRecord {
  const now = new Date();
  return {
    id: "507f1f77bcf86cd799439011",
    code: "RM-1",
    name: "Steel",
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

describe("RawMaterialTypeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getById returns null for invalid ObjectId", async () => {
    const repo = { findActiveById: jest.fn() };
    const svc = new RawMaterialTypeService(repo as never);
    await expect(svc.getById("bad")).resolves.toBeNull();
    expect(repo.findActiveById).not.toHaveBeenCalled();
  });

  it("create maps Mongo duplicate key to DUPLICATE_CODE_NAME", async () => {
    mockedCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const svc = new RawMaterialTypeService({} as never);

    await expect(
      svc.create({ code: "c", name: "n" })
    ).rejects.toMatchObject({
      errorCode: "DUPLICATE_CODE_NAME",
      statusCode: 409
    });
  });

  it("create returns record on success", async () => {
    const row = sampleRecord();
    mockedCreate.mockResolvedValue(row);
    const svc = new RawMaterialTypeService({} as never);
    const userId = new mongoose.Types.ObjectId();

    await expect(
      svc.create({ code: "RM-1", name: "Steel" }, userId)
    ).resolves.toEqual(row);

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        code: "RM-1",
        name: "Steel",
        createdBy: userId.toString()
      })
    );
  });

  it("create maps RawMaterialTypeDomainError to service error", async () => {
    mockedCreate.mockRejectedValue(
      new RawMaterialTypeDomainError({
        statusCode: 409,
        errorCode: "DUPLICATE_CODE_NAME",
        message: "taken"
      })
    );
    const svc = new RawMaterialTypeService({} as never);

    await expect(svc.create({ code: "c", name: "n" })).rejects.toMatchObject({
      name: "RawMaterialTypeServiceError",
      errorCode: "DUPLICATE_CODE_NAME",
      statusCode: 409
    });
  });

  it("update throws VALIDATION_ERROR for invalid id", async () => {
    const svc = new RawMaterialTypeService({} as never);
    await expect(svc.update("x", { name: "n" })).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR",
      statusCode: 400
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("update maps Mongo duplicate key to DUPLICATE_CODE_NAME", async () => {
    mockedUpdate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const svc = new RawMaterialTypeService({} as never);
    const id = "507f1f77bcf86cd799439011";

    await expect(svc.update(id, { code: "c" })).rejects.toMatchObject({
      errorCode: "DUPLICATE_CODE_NAME",
      statusCode: 409
    });
  });

  it("list computes pagination from repo result", async () => {
    const row = sampleRecord();
    const repo = {
      listActive: jest.fn().mockResolvedValue({
        items: [row],
        total: 25,
        page: 2,
        limit: 10
      })
    };
    const svc = new RawMaterialTypeService(repo as never);

    const result = await svc.list({ page: 2, limit: 10, search: "st" });

    expect(repo.listActive).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: "st"
    });
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true
    });
  });

  it("softDelete throws for invalid id", async () => {
    const svc = new RawMaterialTypeService({} as never);
    await expect(svc.softDelete("bad")).rejects.toMatchObject({
      errorCode: "VALIDATION_ERROR"
    });
    expect(mockedSoftDelete).not.toHaveBeenCalled();
  });
});
