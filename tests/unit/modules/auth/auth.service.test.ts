import { registerSchema } from "../../../../src/modules/auth/auth.validators";

describe("AuthService (modules/auth)", () => {
  it("validates register input with missing required fields", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

