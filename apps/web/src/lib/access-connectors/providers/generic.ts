import type {
  AccessConnectorDispatchContext,
  AccessConnectorProviderRuntime,
} from "./base";

function toDecision(command: AccessConnectorDispatchContext["command"]): "ALLOW" | "DENY" | "INFO" {
  if (command === "grant") return "ALLOW";
  if (command === "deny") return "DENY";
  return "INFO";
}

export const genericAccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "GENERIC",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "GENERIC",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      command: context.command,
      decision: toDecision(context.command),
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

