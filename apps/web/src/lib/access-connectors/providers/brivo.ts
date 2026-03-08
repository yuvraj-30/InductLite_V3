import type { AccessConnectorProviderRuntime } from "./base";

function toBrivoAction(command: "grant" | "deny" | "heartbeat" | "status"): string {
  switch (command) {
    case "grant":
      return "unlock";
    case "deny":
      return "lock";
    case "heartbeat":
      return "heartbeat";
    case "status":
    default:
      return "status";
  }
}

export const brivoAccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "BRIVO",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "BRIVO",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      brivo: {
        action: toBrivoAction(context.command),
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

