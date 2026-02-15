import { describe, expect, it } from "vitest";
import { getUtcDayRangeForTimeZone } from "../day-range";

describe("getUtcDayRangeForTimeZone", () => {
  const tz = "Pacific/Auckland";

  it("maps NZ summer day boundaries to UTC", () => {
    const { from, to } = getUtcDayRangeForTimeZone("2025-01-27", tz);

    expect(from.toISOString()).toBe("2025-01-26T11:00:00.000Z");
    expect(to.toISOString()).toBe("2025-01-27T10:59:59.999Z");
  });

  it("maps NZ winter day boundaries to UTC", () => {
    const { from, to } = getUtcDayRangeForTimeZone("2025-06-15", tz);

    expect(from.toISOString()).toBe("2025-06-14T12:00:00.000Z");
    expect(to.toISOString()).toBe("2025-06-15T11:59:59.999Z");
  });
});
