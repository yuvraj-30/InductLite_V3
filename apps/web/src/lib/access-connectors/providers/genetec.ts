import type { AccessConnectorProviderRuntime } from "./base";

function toGenetecAction(command: "grant" | "deny" | "heartbeat" | "status") {
  switch (command) {
    case "grant":
      return "UNLOCK";
    case "deny":
      return "LOCK";
    case "heartbeat":
      return "PING";
    case "status":
    default:
      return "STATUS";
  }
}

export const genetecAccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "GENETEC",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "GENETEC",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      genetec: {
        action: toGenetecAction(context.command),
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
