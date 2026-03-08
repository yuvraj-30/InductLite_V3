import type { AccessConnectorProviderRuntime } from "./base";

function toLenelCommand(command: "grant" | "deny" | "heartbeat" | "status") {
  switch (command) {
    case "grant":
      return "GRANT_ACCESS";
    case "deny":
      return "DENY_ACCESS";
    case "heartbeat":
      return "HEARTBEAT";
    case "status":
    default:
      return "STATUS_CHECK";
  }
}

export const lenelS2AccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "LENELS2",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "LENELS2",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      lenelS2: {
        command: toLenelCommand(context.command),
      },
      reason: context.reason,
      site: {
        id: context.siteId,
        name: context.siteName,
      },
      subject: {
        signInRecordId: context.signInRecordId ?? null,
        visitorName: context.visitorName ?? null,
        visitorPhoneLast4: context.visitorPhoneLast4 ?? null,
      },
      metadata: context.metadata ?? {},
    };
  },
};
