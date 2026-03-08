import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/live", () => {
  it("returns liveness payload", async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alive).toBe(true);
    expect(typeof json.timestamp).toBe("string");
    expect(typeof json.uptime_seconds).toBe("number");
  });
});
