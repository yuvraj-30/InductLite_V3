import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map()),
}));

// Mock repositories
vi.mock("@/lib/repository/site.repository", () => ({
  findSiteByPublicSlug: vi.fn(),
}));
vi.mock("@/lib/repository/template.repository", () => ({
  getActiveTemplateForSite: vi.fn(),
}));
vi.mock("@/lib/repository/public-signin.repository", () => ({
  createPublicSignIn: vi.fn(),
  signOutWithToken: vi.fn(),
}));
vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkSignInRateLimit: vi.fn(() => ({ success: true })),
  checkPublicSlugRateLimit: vi.fn(() => ({ success: true })),
}));

// Import actions AFTER mocks
import { submitSignIn } from "@/app/s/[slug]/actions";
import { findSiteByPublicSlug } from "@/lib/repository/site.repository";
import { getActiveTemplateForSite } from "@/lib/repository/template.repository";
import { createPublicSignIn } from "@/lib/repository/public-signin.repository";
import { headers } from "next/headers";

describe("Webhook Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.mocked(headers).mockResolvedValue(new Map() as any);
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

    // Wait for the detached promise to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
