const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

export const FEATURE_FLAGS = {
  EXPORTS: toBool(process.env.FEATURE_EXPORTS_ENABLED, true),
  UPLOADS: toBool(process.env.FEATURE_UPLOADS_ENABLED, true),
  VISUAL_REGRESSION: toBool(process.env.FEATURE_VISUAL_REGRESSION_ENABLED, false),
};

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}
