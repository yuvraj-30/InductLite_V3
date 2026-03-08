import type { AccessConnectorProviderRuntime } from "./base";

function toGallagherDecision(command: "grant" | "deny" | "heartbeat" | "status") {
  switch (command) {
    case "grant":
      return "ALLOW";
    case "deny":
      return "DENY";
    case "heartbeat":
      return "HEARTBEAT";
    case "status":
    default:
      return "STATUS";
  }
}

export const gallagherAccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "GALLAGHER",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "GALLAGHER",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      gallagher: {
        decision: toGallagherDecision(context.command),
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
