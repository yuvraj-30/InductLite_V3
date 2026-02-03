/* eslint-disable no-restricted-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    site: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    sitePublicLink: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  findSiteById,
  findSiteByPublicSlug,
  listSites,
  createSite,
  updateSite,
  countActiveSites,
} from "../site.repository";
import type { Site } from "@prisma/client";
import { RepositoryError } from "../base";

function createMockSite(overrides: Partial<Site> = {}): Site {
  return {
    id: "s1",
    company_id: "company-123",
    name: "Site One",
    address: "1 Test St",
    description: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Site;
}

describe("Site Repository (unit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("findSiteById should call prisma site findFirst with company scope", async () => {
    vi.mocked(prisma.site.findFirst).mockResolvedValue(createMockSite());

    const res = await findSiteById("company-123", "s1");

    expect(prisma.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "s1", company_id: "company-123" }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );

    expect(res!.id).toBe("s1");
  });

  it("findSiteByPublicSlug returns site when active and not expired", async () => {
    const mockPublicLink: import("@prisma/client").Prisma.SitePublicLinkGetPayload<{
      include: { site: true };
    }> = {
      id: "pl1",
      slug: "public-slug",
      is_active: true,
      expires_at: null,
      created_at: new Date(),
      site_id: "s1",
      rotated_at: new Date(),
      site: createMockSite(),
    };

    vi.mocked(prisma.sitePublicLink.findUnique).mockResolvedValue(
      mockPublicLink,
    );

    const res = await findSiteByPublicSlug("public-slug");

    expect(prisma.sitePublicLink.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "public-slug" } }),
    );

    expect(res).not.toBeNull();
    expect(res!.id).toBe("s1");
  });

  it("findSiteByPublicSlug returns null when link inactive or site inactive", async () => {
    vi.mocked(prisma.sitePublicLink.findUnique).mockResolvedValue({
      id: "pl1",
      slug: "public-slug",
      is_active: false,
      expires_at: null,
      created_at: new Date(),
      site_id: "s1",
      rotated_at: new Date(),
      site: createMockSite(),
    } as import("@prisma/client").Prisma.SitePublicLinkGetPayload<{
      include: { site: true };
    }>);
    const res1 = await findSiteByPublicSlug("public-slug");
    expect(res1).toBeNull();

    vi.mocked(prisma.sitePublicLink.findUnique).mockResolvedValue({
      id: "pl1",
      slug: "public-slug",
      is_active: true,
      expires_at: null,
      created_at: new Date(),
      site_id: "s1",
      rotated_at: new Date(),
      site: { ...createMockSite(), is_active: false },
    } as import("@prisma/client").Prisma.SitePublicLinkGetPayload<{
      include: { site: true };
    }>);
    const res2 = await findSiteByPublicSlug("public-slug");
    expect(res2).toBeNull();
  });

  it("listSites should call findMany and count with company scope", async () => {
    vi.mocked(prisma.site.findMany).mockResolvedValue([createMockSite()]);
    vi.mocked(prisma.site.count).mockResolvedValue(1);

    const res = await listSites(
      "company-123",
      { name: "Site" },
      { page: 1, pageSize: 10 },
    );

    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );

    expect(res.items.length).toBe(1);
  });

  it("createSite should create a site with company_id injected", async () => {
    const mock = createMockSite();
    vi.mocked(prisma.site.create).mockResolvedValue(mock);

    const res = await createSite("company-123", { name: "New" });

    expect(prisma.site.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "New",
          company_id: "company-123",
        }),
      }),
    );

    expect(res.id).toBe("s1");
  });

  it("updateSite should throw RepositoryError when no rows updated", async () => {
    vi.mocked(prisma.site.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      updateSite("company-123", "s1", { name: "X" }),
    ).rejects.toThrow(RepositoryError);
  });

  it("countActiveSites should call count with company scope", async () => {
    vi.mocked(prisma.site.count).mockResolvedValue(2);

    const n = await countActiveSites("company-123");

    expect(prisma.site.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );

    expect(n).toBe(2);
  });
});
