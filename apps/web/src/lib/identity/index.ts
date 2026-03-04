export {
  parseCompanySsoConfig,
  serializeCompanySsoConfig,
  setClientSecret,
  decryptClientSecret,
  generateDirectorySyncApiKey,
  hashDirectorySyncApiKey,
  verifyDirectorySyncApiKey,
  resolveRoleFromClaims,
  isEmailDomainAllowed,
} from "./config";

export type {
  CompanySsoConfig,
  SsoProvider,
  RoleMapping,
  DirectorySyncConfig,
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
