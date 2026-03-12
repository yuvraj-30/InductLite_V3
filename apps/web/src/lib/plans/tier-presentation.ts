import type { CompanyPlan } from "@prisma/client";
import { PLAN_BASE_PRICE_CENTS, STANDARD_FLOOR_PRICE_CENTS } from "./pricing";

export type PublicTier = CompanyPlan | "ADD_ONS";
export type TierBadgeTone = "default" | "primary" | "success" | "warning";

export const COMPANY_TIERS = ["STANDARD", "PLUS", "PRO"] as const satisfies readonly CompanyPlan[];

export interface TierPresentation {
  key: PublicTier;
  label: string;
  subtitle: string;
  audience: string;
  badgeTone: TierBadgeTone;
  priceCents?: number;
  floorPriceCents?: number;
  highlights: string[];
}

export const TIER_PRESENTATION: TierPresentation[] = [
  {
    key: "STANDARD",
    label: "Standard",
    subtitle: "Core operations for small-to-medium site teams.",
    audience: "Best for teams that need essential compliance workflows without enterprise overhead.",
    badgeTone: "default",
    priceCents: PLAN_BASE_PRICE_CENTS.STANDARD,
    floorPriceCents: STANDARD_FLOOR_PRICE_CENTS,
    highlights: [
      "QR sign-in, inductions, and live register",
      "Emergency roll-call and evidence exports",
      "SWMS/JSA/RAMS/toolbox/fatigue safety forms",
      "Pre-registration and reminder workflows",
      "Removable feature credits for cost-sensitive sites",
    ],
  },
  {
    key: "PLUS",
    label: "Plus",
    subtitle: "Deeper workflow control for higher-volume operations.",
    audience: "Best for active sites that need richer field workflow controls.",
    badgeTone: "primary",
    priceCents: PLAN_BASE_PRICE_CENTS.PLUS,
    highlights: [
      "Everything in Standard",
      "Quiz scoring and retry control",
      "Media-first induction blocks",
      "Stronger policy depth for field workflows",
      "Offline-assist runtime and communication hub surfaces",
    ],
  },
  {
    key: "PRO",
    label: "Pro",
    subtitle: "Best for multi-site environments and advanced governance.",
    audience: "Best for enterprise operations requiring analytics and connector depth.",
    badgeTone: "success",
    priceCents: PLAN_BASE_PRICE_CENTS.PRO,
    highlights: [
      "Everything in Plus",
      "LMS connector capability",
      "Advanced analytics surfaces",
      "Risk passport and policy simulator",
      "Named access connectors and OCR verification",
    ],
  },
  {
    key: "ADD_ONS",
    label: "Add-ons",
    subtitle: "Optional capabilities with controlled recurring cost.",
    audience: "Best for staged rollouts that enable variable-cost features only when needed.",
    badgeTone: "warning",
    highlights: [
      "SMS workflows for high-urgency communications",
      "Hardware access integration for gate/turnstile decisions",
      "Premium access connectors (HID Origo, Brivo, Gallagher, LenelS2, Genetec)",
      "Premium implementation support for larger teams",
    ],
  },
];

export function getTierPresentation(tier: PublicTier): TierPresentation {
  const entry = TIER_PRESENTATION.find((item) => item.key === tier);
  if (!entry) {
    throw new Error(`Unknown tier key: ${tier}`);
  }
  return entry;
}

export function getCompanyTierPresentation(
  tier: CompanyPlan,
): TierPresentation & { key: CompanyPlan } {
  return getTierPresentation(tier) as TierPresentation & { key: CompanyPlan };
}
