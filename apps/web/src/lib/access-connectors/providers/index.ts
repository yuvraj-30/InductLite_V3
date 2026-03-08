import type { AccessConnectorProvider } from "@prisma/client";
import type { AccessConnectorProviderRuntime } from "./base";
import { genericAccessConnectorProvider } from "./generic";
import { hidOrigoAccessConnectorProvider } from "./hid-origo";
import { brivoAccessConnectorProvider } from "./brivo";
import { gallagherAccessConnectorProvider } from "./gallagher";
import { lenelS2AccessConnectorProvider } from "./lenels2";
import { genetecAccessConnectorProvider } from "./genetec";

const PROVIDERS: Record<AccessConnectorProvider, AccessConnectorProviderRuntime> = {
  GENERIC: genericAccessConnectorProvider,
  HID_ORIGO: hidOrigoAccessConnectorProvider,
  BRIVO: brivoAccessConnectorProvider,
  GALLAGHER: gallagherAccessConnectorProvider,
  LENELS2: lenelS2AccessConnectorProvider,
  GENETEC: genetecAccessConnectorProvider,
};

export function resolveAccessConnectorProvider(
  provider: AccessConnectorProvider,
): AccessConnectorProviderRuntime {
  return PROVIDERS[provider];
}
