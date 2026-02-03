import { describe, it, expect } from "vitest";
import { hashPhone } from "@inductlite/shared";

describe("Shared utils - phone hashing", () => {
  it("produces same hash for equivalent local and E.164 formats", () => {
    const local = hashPhone("021 123 4567");
    const e164 = hashPhone("+64211234567");
    expect(local).toBe(e164);
  });
});
