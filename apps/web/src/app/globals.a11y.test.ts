import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRootVariable(css: string, name: string): string {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) {
    throw new Error("Unable to locate :root CSS block");
  }

  const variableMatch = rootMatch[1]?.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!variableMatch?.[1]) {
    throw new Error(`Unable to locate variable ${name}`);
  }

  return variableMatch[1];
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function srgbToLinear(channel: number): number {
  const value = channel / 255;
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const pair: [number, number] = [luminance(foreground), luminance(background)];
  const [lighter, darker] = pair[0] >= pair[1] ? pair : [pair[1], pair[0]];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("apps/web/src/app/globals.css accessibility tokens", () => {
  const css = fs.readFileSync(path.join(__dirname, "globals.css"), "utf8");

  it("keeps accent links above AA on light surface backgrounds", () => {
    const accentPrimary = readRootVariable(css, "--accent-primary");
    expect(contrastRatio(accentPrimary, "#f8fbff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps success badges above AA with white text", () => {
    const accentSuccess = readRootVariable(css, "--accent-success");
    expect(contrastRatio("#ffffff", accentSuccess)).toBeGreaterThanOrEqual(4.5);
  });
});
