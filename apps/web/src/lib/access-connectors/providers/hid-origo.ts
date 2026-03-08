import type { AccessConnectorProviderRuntime } from "./base";

function toHidCommand(command: "grant" | "deny" | "heartbeat" | "status"): string {
  switch (command) {
    case "grant":
      return "grant";
    case "deny":
      return "deny";
    case "heartbeat":
      return "heartbeat";
    case "status":
    default:
      return "status";
  }
}

export const hidOrigoAccessConnectorProvider: AccessConnectorProviderRuntime = {
  provider: "HID_ORIGO",
  buildPayload(context) {
    return {
      event: "hardware.access.decision",
      provider: "HID_ORIGO",
      correlationId: context.correlationId,
      occurredAt: new Date().toISOString(),
      hidOrigo: {
        command: toHidCommand(context.command),
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

