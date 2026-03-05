import { describe, expect, it } from "vitest";
import type { ChannelProvider } from "@prisma/client";
import {
  filterChannelIntegrationConfigsForEvent,
  isChannelIntegrationConfigEnabledForEvent,
} from "../communication.repository";

function buildConfig(input?: {
  provider?: ChannelProvider;
  is_active?: boolean;
  site_id?: string | null;
  mappings?: Record<string, unknown> | null;
}) {
  return {
    provider: input?.provider ?? "SLACK",
    is_active: input?.is_active ?? true,
    site_id: input?.site_id ?? null,
    mappings: input?.mappings ?? null,
  } as const;
}

describe("communication.repository channel mapping filters", () => {
  it("allows active config when no mappings are defined", () => {
    const allowed = isChannelIntegrationConfigEnabledForEvent(
      buildConfig(),
      {
        provider: "SLACK",
        site_id: "site-a",
        event_type: "emergency.broadcast",
      },
    );
    expect(allowed).toBe(true);
  });

  it("blocks inactive config by default", () => {
    const allowed = isChannelIntegrationConfigEnabledForEvent(
      buildConfig({ is_active: false }),
      {
        provider: "SLACK",
        site_id: "site-a",
        event_type: "emergency.broadcast",
      },
    );
    expect(allowed).toBe(false);
  });

  it("blocks config when site scope mismatches", () => {
    const allowed = isChannelIntegrationConfigEnabledForEvent(
      buildConfig({ site_id: "site-a" }),
      {
        provider: "SLACK",
        site_id: "site-b",
        event_type: "emergency.broadcast",
      },
    );
    expect(allowed).toBe(false);
  });

  it("enforces enabledEvents and disabledEvents lists", () => {
    const config = buildConfig({
      mappings: {
        enabledEvents: ["visitor.approval.required"],
        disabledEvents: ["emergency.broadcast"],
      },
    });

    const broadcastAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "emergency.broadcast",
    });
    const approvalAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "visitor.approval.required",
    });

    expect(broadcastAllowed).toBe(false);
    expect(approvalAllowed).toBe(true);
  });

  it("enforces per-event mapping rules", () => {
    const config = buildConfig({
      mappings: {
        events: {
          "emergency.broadcast": false,
          "*": true,
        },
      },
    });

    const broadcastAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "emergency.broadcast",
    });
    const otherAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "visitor.approval.required",
    });

    expect(broadcastAllowed).toBe(false);
    expect(otherAllowed).toBe(true);
  });

  it("enforces siteIds and excludeSiteIds", () => {
    const config = buildConfig({
      mappings: {
        siteIds: ["site-a", "site-b"],
        excludeSiteIds: ["site-b"],
      },
    });

    const siteAAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "emergency.broadcast",
    });
    const siteBAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-b",
      event_type: "emergency.broadcast",
    });
    const siteCAllowed = isChannelIntegrationConfigEnabledForEvent(config, {
      provider: "SLACK",
      site_id: "site-c",
      event_type: "emergency.broadcast",
    });

    expect(siteAAllowed).toBe(true);
    expect(siteBAllowed).toBe(false);
    expect(siteCAllowed).toBe(false);
  });

  it("filters multiple configs for event/provider/site", () => {
    const configs = [
      buildConfig({ provider: "SLACK", site_id: null }),
      buildConfig({ provider: "SLACK", site_id: "site-a" }),
      buildConfig({ provider: "SLACK", site_id: "site-b" }),
      buildConfig({ provider: "TEAMS", site_id: null }),
      buildConfig({
        provider: "SLACK",
        site_id: null,
        mappings: { events: { "emergency.broadcast": false } },
      }),
    ];

    const filtered = filterChannelIntegrationConfigsForEvent(configs, {
      provider: "SLACK",
      site_id: "site-a",
      event_type: "emergency.broadcast",
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((config) => config.provider === "SLACK")).toBe(true);
    expect(filtered.some((config) => config.site_id === "site-a")).toBe(true);
    expect(filtered.some((config) => config.site_id === null)).toBe(true);
  });
});
