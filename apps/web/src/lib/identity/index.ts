export {
  parseCompanySsoConfig,
  serializeCompanySsoConfig,
  setClientSecret,
  decryptClientSecret,
  generateDirectorySyncApiKey,
  fingerprintApiKey,
  hashDirectorySyncApiKey,
  verifyDirectorySyncApiKey,
  generatePartnerApiKey,
  hashPartnerApiKey,
  verifyPartnerApiKey,
  resolveRoleFromClaims,
  isEmailDomainAllowed,
} from "./config";

export type {
  CompanySsoConfig,
  SsoProvider,
  RoleMapping,
  DirectorySyncConfig,
  PartnerApiConfig,
} from "./config";

export {
  discoverOidcConfiguration,
  buildOidcAuthorizationUrl,
  exchangeAuthorizationCode,
  verifyIdToken,
} from "./oidc";

export type {
  OidcDiscoveryDocument,
  OidcTokenResponse,
  VerifiedIdToken,
} from "./oidc";

export {
  upsertIdentityUser,
  applyDirectorySyncBatch,
} from "./user-sync";

export type {
  UpsertIdentityUserInput,
  UpsertIdentityUserResult,
  DirectorySyncUserInput,
  DirectorySyncBatchResult,
} from "./user-sync";
