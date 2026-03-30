const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

export const FEATURE_FLAGS = {
  // Global kill switches.
  EXPORTS: toBool(process.env.FEATURE_EXPORTS_ENABLED, true),
  UPLOADS: toBool(process.env.FEATURE_UPLOADS_ENABLED, true),
  PUBLIC_SIGNIN: toBool(process.env.FEATURE_PUBLIC_SIGNIN_ENABLED, true),
  VISUAL_REGRESSION: toBool(process.env.FEATURE_VISUAL_REGRESSION_ENABLED, false),

  // UI/UX modernization rollout flags.
  UIX_S1_VISUAL: toBool(process.env.UIX_S1_VISUAL, false),
  UIX_S2_FLOW: toBool(process.env.UIX_S2_FLOW, false),
  UIX_S3_MOBILE: toBool(process.env.UIX_S3_MOBILE, true),
  UIX_S4_AI: toBool(process.env.UIX_S4_AI, false),
  UIX_S5_A11Y: toBool(process.env.UIX_S5_A11Y, false),

  // Market parity + differentiation rollout flags.
  PERMITS_V1: toBool(process.env.FF_PERMITS_V1, false),
  ID_HARDENING_V1: toBool(process.env.FF_ID_HARDENING_V1, false),
  EMERGENCY_COMMS_V1: toBool(process.env.FF_EMERGENCY_COMMS_V1, false),
  TEAMS_SLACK_V1: toBool(process.env.FF_TEAMS_SLACK_V1, false),
  PWA_PUSH_V1: toBool(process.env.FF_PWA_PUSH_V1, false),
  EVIDENCE_TAMPER_V1: toBool(process.env.FF_EVIDENCE_TAMPER_V1, false),
  POLICY_SIMULATOR_V1: toBool(process.env.FF_POLICY_SIMULATOR_V1, false),
  RISK_PASSPORT_V1: toBool(process.env.FF_RISK_PASSPORT_V1, false),
  SELF_SERVE_CONFIG_V1: toBool(process.env.FF_SELF_SERVE_CONFIG_V1, false),
  NATIVE_MOBILE_RUNTIME_V1: toBool(process.env.FEATURE_NATIVE_MOBILE_RUNTIME, false),
  IDENTITY_OCR_V1: toBool(process.env.FEATURE_IDENTITY_OCR, false),
  ACCESS_CONNECTORS_V1: toBool(process.env.FEATURE_ACCESS_CONNECTORS, false),
};

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}
