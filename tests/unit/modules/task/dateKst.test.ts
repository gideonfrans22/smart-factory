import { parseDateAsKST } from "../../../../src/shared/helpers/dateKst";

describe("parseDateAsKST", () => {
  it("parses YYYY-MM-DD as start of day in KST (UTC+9)", () => {
    const d = parseDateAsKST("2026-01-29", false);
    expect(d.toISOString()).toBe("2026-01-28T15:00:00.000Z");
  });

  it("parses YYYY-MM-DD as end of day in KST when isEndOfDay is true", () => {
    const d = parseDateAsKST("2026-01-29", true);
    expect(d.toISOString()).toBe("2026-01-29T14:59:59.999Z");
  });

  it("passes through full ISO strings", () => {
    const iso = "2026-03-01T12:00:00.000Z";
    const d = parseDateAsKST(iso, false);
    expect(d.toISOString()).toBe(iso);
  });
});
