import {
  userCreateSchema,
  userUpdateSchema,
  userListQuerySchema,
  userIdParamSchema
} from "../../../../src/modules/user/user.validators";

describe("User Validators", () => {
  describe("userCreateSchema", () => {
    it("should validate valid user creation data", () => {
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should fail when name is missing", () => {
      const invalidData = {
        email: "john@example.com",
        password: "password123",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should fail when admin role has no email", () => {
      const invalidData = {
        name: "John Doe",
        password: "password123",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("email");
      }
    });

    it("should fail when monitor has neither username nor email", () => {
      const invalidData = {
        name: "Monitor User",
        password: "password123",
        role: "monitor" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("username");
      }
    });

    it("should validate monitor with username", () => {
      const validData = {
        name: "Monitor User",
        username: "monitor1",
        password: "password123",
        role: "monitor" as const
      };

      const result = userCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate monitor with email", () => {
      const validData = {
        name: "Monitor User",
        email: "monitor@example.com",
        password: "password123",
        role: "monitor" as const
      };

      const result = userCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should fail when password is too short", () => {
      const invalidData = {
        name: "John Doe",
        email: "john@example.com",
        password: "12345",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should fail when email format is invalid", () => {
      const invalidData = {
        name: "John Doe",
        email: "invalid-email",
        password: "password123",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should fail when name exceeds 100 characters", () => {
      const invalidData = {
        name: "a".repeat(101),
        email: "john@example.com",
        password: "password123",
        role: "admin" as const
      };

      const result = userCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should validate worker without email", () => {
      const validData = {
        name: "Worker User",
        username: "worker1",
        password: "password123",
        role: "worker" as const
      };

      const result = userCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("userUpdateSchema", () => {
    it("should validate partial update data", () => {
      const validData = {
        name: "Updated Name"
      };

      const result = userUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate empty update object", () => {
      const validData = {};

      const result = userUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate nullable email", () => {
      const validData = {
        email: null
      };

      const result = userUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should fail when email format is invalid", () => {
      const invalidData = {
        email: "invalid-email"
      };

      const result = userUpdateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("userListQuerySchema", () => {
    it("should validate with default values", () => {
      const validData = {};

      const result = userListQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe("1");
        expect(result.data.limit).toBe("10");
      }
    });

    it("should validate with role filter", () => {
      const validData = {
        role: "admin"
      };

      const result = userListQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should transform isActive string to boolean", () => {
      const validData = {
        isActive: "true"
      };

      const result = userListQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should fail when limit exceeds 100", () => {
      const invalidData = {
        limit: "101"
      };

      const result = userListQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("userIdParamSchema", () => {
    it("should validate valid MongoDB ObjectId", () => {
      const validData = {
        id: "507f1f77bcf86cd799439011"
      };

      const result = userIdParamSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should fail with invalid ObjectId", () => {
      const invalidData = {
        id: "invalid-id"
      };

      const result = userIdParamSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
