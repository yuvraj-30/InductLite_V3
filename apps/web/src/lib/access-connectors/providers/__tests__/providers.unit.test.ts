import { describe, expect, it } from "vitest";
import { resolveAccessConnectorProvider } from "../index";
import type { AccessConnectorDispatchContext } from "../base";

const baseContext: AccessConnectorDispatchContext = {
  correlationId: "corr-1",
  command: "grant",
  reason: "unit_test",
  siteId: "site-1",
  siteName: "Alpha",
  signInRecordId: "sign-1",
  visitorName: "Ari",
  visitorPhoneLast4: "4567",
  metadata: { source: "test" },
};

describe("access connector provider resolver", () => {
  it("resolves all named providers", () => {
    expect(resolveAccessConnectorProvider("GENERIC").provider).toBe("GENERIC");
    expect(resolveAccessConnectorProvider("HID_ORIGO").provider).toBe("HID_ORIGO");
    expect(resolveAccessConnectorProvider("BRIVO").provider).toBe("BRIVO");
    expect(resolveAccessConnectorProvider("GALLAGHER").provider).toBe("GALLAGHER");
    expect(resolveAccessConnectorProvider("LENELS2").provider).toBe("LENELS2");
    expect(resolveAccessConnectorProvider("GENETEC").provider).toBe("GENETEC");
  });

  it("builds provider-specific payload shape for new providers", () => {
    const gallagher = resolveAccessConnectorProvider("GALLAGHER").buildPayload({
      ...baseContext,
      command: "grant",
    });
    expect(gallagher.provider).toBe("GALLAGHER");
    expect((gallagher as { gallagher?: { decision?: string } }).gallagher?.decision).toBe(
      "ALLOW",
    );

    const lenel = resolveAccessConnectorProvider("LENELS2").buildPayload({
      ...baseContext,
      command: "deny",
    });
    expect(lenel.provider).toBe("LENELS2");
    expect((lenel as { lenelS2?: { command?: string } }).lenelS2?.command).toBe(
      "DENY_ACCESS",
    );

    const genetec = resolveAccessConnectorProvider("GENETEC").buildPayload({
      ...baseContext,
      command: "heartbeat",
    });
    expect(genetec.provider).toBe("GENETEC");
    expect((genetec as { genetec?: { action?: string } }).genetec?.action).toBe("PING");
  });

  it("maps status checks for new providers", () => {
    const gallagher = resolveAccessConnectorProvider("GALLAGHER").buildPayload({
      ...baseContext,
      command: "status",
    });
    expect((gallagher as { gallagher?: { decision?: string } }).gallagher?.decision).toBe(
      "STATUS",
    );

    const lenel = resolveAccessConnectorProvider("LENELS2").buildPayload({
      ...baseContext,
      command: "status",
    });
    expect((lenel as { lenelS2?: { command?: string } }).lenelS2?.command).toBe(
      "STATUS_CHECK",
    );

    const genetec = resolveAccessConnectorProvider("GENETEC").buildPayload({
      ...baseContext,
      command: "deny",
    });
    expect((genetec as { genetec?: { action?: string } }).genetec?.action).toBe("LOCK");
  });
});
