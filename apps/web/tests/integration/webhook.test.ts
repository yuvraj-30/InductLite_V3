import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitSignIn } from "../../src/app/s/[slug]/actions";

// Mock dependencies
vi.mock("../../src/lib/repository/site.repository", () => ({
  findSiteByPublicSlug: vi.fn(),
}));
vi.mock("../../src/lib/repository/template.repository", () => ({
  getActiveTemplateForSite: vi.fn(),
}));
vi.mock("../../src/lib/repository/public-signin.repository", () => ({
  createPublicSignIn: vi.fn(),
}));
vi.mock("../../src/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));
vi.mock("../../src/lib/rate-limit", () => ({
  checkSignInRateLimit: vi.fn(() => ({ success: true })),
}));

import { findSiteByPublicSlug } from "../../src/lib/repository/site.repository";
import { getActiveTemplateForSite } from "../../src/lib/repository/template.repository";
import { createPublicSignIn } from "../../src/lib/repository/public-signin.repository";

describe("Webhook Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
  });

  it("should fire webhooks when a visitor signs in", async () => {
    const mockSite = {
      id: "site-1",
      company: { id: "company-1", name: "Co" },
      name: "Site A",
      webhooks: ["https://example.com/webhook"],
    };

    vi.mocked(findSiteByPublicSlug).mockResolvedValue(mockSite as any);
    vi.mocked(getActiveTemplateForSite).mockResolvedValue({
      id: "t1",
      version: 1,
      questions: [],
    } as any);
    vi.mocked(createPublicSignIn).mockResolvedValue({
      signInRecordId: "r1",
      token: "tok",
    } as any);

    const result = await submitSignIn({
      slug: "site-a",
      visitorName: "Alice",
      visitorPhone: "0211234567",
      visitorType: "CONTRACTOR",
      answers: [],
    } as any);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
