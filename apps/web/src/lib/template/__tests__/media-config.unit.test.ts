import { describe, expect, it } from "vitest";
import { hasInductionMedia, parseInductionMediaConfig } from "../media-config";

describe("template media config parser", () => {
  it("returns defaults for invalid input", () => {
    const config = parseInductionMediaConfig(null);

    expect(config.blocks).toEqual([]);
    expect(config.requireAcknowledgement).toBe(false);
    expect(hasInductionMedia(config)).toBe(false);
  });

  it("parses configured media blocks and acknowledgement settings", () => {
    const config = parseInductionMediaConfig({
      blocks: [
        {
          type: "PDF",
          title: "Site Safety",
          url: "https://example.com/safety.pdf",
        },
        {
          type: "TEXT",
          title: "Daily Brief",
          body: "Read this before entering the site.",
        },
      ],
      requireAcknowledgement: true,
      acknowledgementLabel: "I confirm I reviewed this material.",
    });

    expect(config.blocks).toHaveLength(2);
    expect(config.blocks[0]).toMatchObject({
      type: "PDF",
      title: "Site Safety",
      url: "https://example.com/safety.pdf",
    });
    expect(config.blocks[1]).toMatchObject({
      type: "TEXT",
      body: "Read this before entering the site.",
    });
    expect(config.requireAcknowledgement).toBe(true);
    expect(config.acknowledgementLabel).toBe(
      "I confirm I reviewed this material.",
    );
  });

  it("drops invalid blocks and disables acknowledgement when none remain", () => {
    const config = parseInductionMediaConfig({
      blocks: [
        {
          type: "PDF",
          title: "Bad",
          url: "ftp://example.com/file.pdf",
        },
      ],
      requireAcknowledgement: true,
      acknowledgementLabel: "Ack",
    });

    expect(config.blocks).toEqual([]);
    expect(config.requireAcknowledgement).toBe(false);
  });

  it("caps total body text across all blocks", () => {
    const veryLongText = "x".repeat(5_000);
    const config = parseInductionMediaConfig({
      blocks: [
        { type: "TEXT", title: "A", body: veryLongText },
        { type: "TEXT", title: "B", body: veryLongText },
        { type: "TEXT", title: "C", body: veryLongText },
        { type: "TEXT", title: "D", body: veryLongText },
      ],
    });

    const totalBodyChars = config.blocks.reduce(
      (sum, block) => sum + (block.body?.length ?? 0),
      0,
    );

    expect(totalBodyChars).toBeLessThanOrEqual(15_000);
  });

  it("rejects excessively long media URLs", () => {
    const oversizedUrl = `https://example.com/${"a".repeat(1_300)}.pdf`;
    const config = parseInductionMediaConfig({
      blocks: [{ type: "PDF", title: "Too long", url: oversizedUrl }],
      requireAcknowledgement: true,
    });

    expect(config.blocks).toEqual([]);
    expect(config.requireAcknowledgement).toBe(false);
  });

  it("enforces config byte budget by trimming trailing blocks", () => {
    const oversizedText = "x".repeat(5_000);
    const oversizedUrlBase = "https://example.com/";
    const config = parseInductionMediaConfig({
      blocks: [
        {
          type: "PDF",
          title: "Block 1",
          body: oversizedText,
          url: `${oversizedUrlBase}${"a".repeat(1_000)}.pdf`,
        },
        {
          type: "PDF",
          title: "Block 2",
          body: oversizedText,
          url: `${oversizedUrlBase}${"b".repeat(1_000)}.pdf`,
        },
        {
          type: "PDF",
          title: "Block 3",
          body: oversizedText,
          url: `${oversizedUrlBase}${"c".repeat(1_000)}.pdf`,
        },
        {
          type: "PDF",
          title: "Block 4",
          body: oversizedText,
          url: `${oversizedUrlBase}${"d".repeat(1_000)}.pdf`,
        },
        {
          type: "PDF",
          title: "Block 5",
          body: oversizedText,
          url: `${oversizedUrlBase}${"e".repeat(1_000)}.pdf`,
        },
      ],
      requireAcknowledgement: true,
    });

    const encodedLength = new TextEncoder().encode(
      JSON.stringify(config),
    ).length;

    expect(encodedLength).toBeLessThanOrEqual(20_000);
    expect(config.blocks.length).toBeLessThan(5);
    expect(config.blocks.length).toBeGreaterThan(0);
    expect(config.requireAcknowledgement).toBe(true);
  });
});
