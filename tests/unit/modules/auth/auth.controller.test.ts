import { loginSchema } from "../../../../src/modules/auth/auth.validators";

describe("AuthController (modules/auth)", () => {
  it("requires username and password on login", () => {
    const result = loginSchema.safeParse({ username: "" });
    expect(result.success).toBe(false);
  });
});

