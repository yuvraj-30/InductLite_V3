import { describe, expect, it } from "vitest";
import {
  buildProcoreConnectorConfig,
  hasProcoreConnectorTarget,
  parseProcoreConnectorConfig,
} from "../config";

describe("procore connector config", () => {
  it("parses enabled config only when provider and endpoint are valid", () => {
    const config = parseProcoreConnectorConfig({
      provider: "PROCORE",
      enabled: true,
      endpointUrl: "https://connector.example.test/sync",
      authToken: "token",
      inboundSharedSecret: "secret",
      projectId: "project-1",
    });

    expect(config.enabled).toBe(true);
    expect(config.endpointUrl).toBe("https://connector.example.test/sync");
    expect(hasProcoreConnectorTarget(config)).toBe(true);
  });

  it("builds disabled config when endpoint is missing", () => {
    const config = buildProcoreConnectorConfig({
      enabled: true,
      endpointUrl: "",
      includePermitEvents: true,
      includeSignInEvents: true,
    });

    expect(config.enabled).toBe(false);
    expect(config.endpointUrl).toBeNull();
    expect(hasProcoreConnectorTarget(config)).toBe(false);
  });
});
