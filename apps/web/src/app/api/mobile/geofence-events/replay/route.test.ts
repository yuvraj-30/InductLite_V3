import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  singlePost: vi.fn(),
}));

vi.mock("../route", () => ({
  POST: mocks.singlePost,
}));

import { POST } from "./route";

describe("POST /api/mobile/geofence-events/replay", () => {
  it("replays multiple events and reports failures", async () => {
    mocks.singlePost
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, duplicate: false, action: "AUTO_CHECKIN" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, error: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

    const req = new Request("http://localhost/api/mobile/geofence-events/replay", {
      method: "POST",
      headers: {
        authorization: "Bearer token-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        events: [
          { eventId: "event-aaaaaa01", eventType: "ENTRY" },
          { eventId: "event-aaaaaa02", eventType: "EXIT" },
        ],
      }),
    });

    const response = await POST(req as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.replayed).toBe(2);
    expect(json.failed).toBe(1);
    expect(json.success).toBe(false);
  });
});
