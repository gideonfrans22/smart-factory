import {
  rawMaterialTypeCreateSchema,
  rawMaterialTypeIdParamSchema,
  rawMaterialTypeListQuerySchema,
  rawMaterialTypeUpdateSchema
} from "../../../../src/modules/raw-material-type/raw-material-type.validators";

describe("raw-material-type validators", () => {
  describe("rawMaterialTypeCreateSchema", () => {
    it("accepts valid code and name", () => {
      const r = rawMaterialTypeCreateSchema.safeParse({
        code: "RM-01",
        name: "Cold rolled"
      });
      expect(r.success).toBe(true);
    });

    it("trims code and name", () => {
      const r = rawMaterialTypeCreateSchema.safeParse({
        code: "  x  ",
        name: "  y  "
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data).toEqual({ code: "x", name: "y" });
      }
    });

    it("rejects empty code", () => {
      const r = rawMaterialTypeCreateSchema.safeParse({ code: "", name: "N" });
      expect(r.success).toBe(false);
    });

    it("rejects code longer than 100", () => {
      const r = rawMaterialTypeCreateSchema.safeParse({
        code: "a".repeat(101),
        name: "ok"
      });
      expect(r.success).toBe(false);
    });

    it("rejects name longer than 200", () => {
      const r = rawMaterialTypeCreateSchema.safeParse({
        code: "ok",
        name: "n".repeat(201)
      });
      expect(r.success).toBe(false);
    });
  });

  describe("rawMaterialTypeUpdateSchema", () => {
    it("accepts partial fields", () => {
      expect(rawMaterialTypeUpdateSchema.safeParse({}).success).toBe(true);
      expect(rawMaterialTypeUpdateSchema.safeParse({ code: "c" }).success).toBe(
        true
      );
      expect(rawMaterialTypeUpdateSchema.safeParse({ name: "n" }).success).toBe(
        true
      );
    });
  });

  describe("rawMaterialTypeListQuerySchema", () => {
    it("applies defaults for page and limit", () => {
      const r = rawMaterialTypeListQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.limit).toBe(10);
      }
    });

    it("rejects limit above 100", () => {
      const r = rawMaterialTypeListQuerySchema.safeParse({
        page: "1",
        limit: "101"
      });
      expect(r.success).toBe(false);
    });
  });

  describe("rawMaterialTypeIdParamSchema", () => {
    it("accepts valid ObjectId", () => {
      const r = rawMaterialTypeIdParamSchema.safeParse({
        id: "507f1f77bcf86cd799439011"
      });
      expect(r.success).toBe(true);
    });

    it("rejects invalid id", () => {
      const r = rawMaterialTypeIdParamSchema.safeParse({ id: "not-an-id" });
      expect(r.success).toBe(false);
    });
  });
});
