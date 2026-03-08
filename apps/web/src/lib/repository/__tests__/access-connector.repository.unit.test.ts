import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessConnectorConfig } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  scopedDb: vi.fn(),
  encryptNullableString: vi.fn(),
  configCreate: vi.fn(),
  configFindFirst: vi.fn(),
  configFindMany: vi.fn(),
  configUpdateMany: vi.fn(),
  healthCreate: vi.fn(),
  healthFindMany: vi.fn(),
  healthCount: vi.fn(),
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: mocks.scopedDb,
}));

vi.mock("@/lib/security/data-protection", () => ({
  encryptNullableString: mocks.encryptNullableString,
}));

import {
  findActiveAccessConnectorConfig,
  upsertAccessConnectorConfig,
} from "../access-connector.repository";

function mockConfig(overrides: Partial<AccessConnectorConfig> = {}): AccessConnectorConfig {
  return {
    id: "cfg-1",
    company_id: "company-1",
    site_id: "site-1",
    provider: "GALLAGHER",
    endpoint_url: "https://connector.example.test/dispatch",
    auth_token_encrypted: "enc-token",
    settings: { lane: "north" },
    is_active: true,
    created_at: new Date("2026-03-08T00:00:00.000Z"),
    updated_at: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("access-connector.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encryptNullableString.mockImplementation((value: string | null) =>
      value ? `enc:${value}` : null,
    );
    mocks.scopedDb.mockReturnValue({
      accessConnectorConfig: {
        create: mocks.configCreate,
        findFirst: mocks.configFindFirst,
        findMany: mocks.configFindMany,
        updateMany: mocks.configUpdateMany,
      },
      accessConnectorHealthEvent: {
        create: mocks.healthCreate,
        findMany: mocks.healthFindMany,
        count: mocks.healthCount,
      },
    });
  });

  it("creates new config when provider/site config does not exist", async () => {
    mocks.configFindFirst.mockResolvedValue(null);
    mocks.configCreate.mockResolvedValue(mockConfig({ id: "cfg-new" }));

    const result = await upsertAccessConnectorConfig("company-1", {
      provider: "GALLAGHER",
      site_id: "site-1",
      endpoint_url: "https://connector.example.test/dispatch",
      auth_token: "secret-token",
      is_active: true,
    });

    expect(result.id).toBe("cfg-new");
    expect(mocks.configCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "GALLAGHER",
          auth_token_encrypted: "enc:secret-token",
          site_id: "site-1",
        }),
      }),
    );
  });

  it("updates existing config and returns refreshed record", async () => {
    mocks.configFindFirst
      .mockResolvedValueOnce(mockConfig({ id: "cfg-existing" }))
      .mockResolvedValueOnce(mockConfig({ id: "cfg-existing", endpoint_url: "https://updated.example.test/path" }));
    mocks.configUpdateMany.mockResolvedValue({ count: 1 });

    const result = await upsertAccessConnectorConfig("company-1", {
      provider: "GALLAGHER",
      site_id: "site-1",
      endpoint_url: "https://updated.example.test/path",
      settings: { lane: "south" },
    });

    expect(result.endpoint_url).toBe("https://updated.example.test/path");
    expect(mocks.configUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cfg-existing" },
      }),
    );
  });

  it("prefers site-scoped config before global fallback", async () => {
    mocks.configFindFirst
      .mockResolvedValueOnce(mockConfig({ id: "cfg-site", site_id: "site-1" }))
      .mockResolvedValueOnce(mockConfig({ id: "cfg-global", site_id: null }));

    const siteResult = await findActiveAccessConnectorConfig("company-1", {
      provider: "GALLAGHER",
      site_id: "site-1",
    });
    const globalResult = await findActiveAccessConnectorConfig("company-1", {
      provider: "GALLAGHER",
      site_id: null,
    });

    expect(siteResult?.id).toBe("cfg-site");
    expect(globalResult?.id).toBe("cfg-global");
  });
});
