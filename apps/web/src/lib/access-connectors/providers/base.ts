import type { AccessConnectorProvider } from "@prisma/client";

export type AccessConnectorCommand = "grant" | "deny" | "heartbeat" | "status";

export interface AccessConnectorDispatchContext {
  correlationId: string;
  command: AccessConnectorCommand;
  reason: string;
  siteId: string;
  siteName: string;
  signInRecordId?: string;
  visitorName?: string;
  visitorPhoneLast4?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AccessConnectorProviderRuntime {
  provider: AccessConnectorProvider;
  buildPayload(context: AccessConnectorDispatchContext): Record<string, unknown>;
}

