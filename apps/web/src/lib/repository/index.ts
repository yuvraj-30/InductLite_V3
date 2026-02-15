/**
 * Repository Layer Barrel Export
 */

// Base utilities
export {
  RepositoryError,
  handlePrismaError,
  requireCompanyId,
  normalizePagination,
  paginatedResult,
  buildDateRangeFilter,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "./base";

export type {
  RepositoryErrorCode,
  PaginationParams,
  PaginatedResult,
  SortDirection,
  SortParams,
  FilterOperators,
  DateRangeFilter,
} from "./base";

// User repository
export {
  findUserById,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserForLogin,
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  updateUserPassword,
  updateLastLogin,
  countActiveUsers,
} from "./user.repository";

export type {
  SafeUser,
  UserFilter,
  CreateUserInput,
  UpdateUserInput,
} from "./user.repository";

// Site repository
export {
  findSiteById,
  findSiteByIdWithCounts,
  findSiteByPublicSlug,
  findAllSites,
  findSitesByIds,
  listSites,
  listSitesWithCounts,
  createSite,
  updateSite,
  deactivateSite,
  reactivateSite,
  countActiveSites,
  getAllSiteIds,
} from "./site.repository";

export type {
  SiteWithCounts,
  SiteListItem,
  SiteListWithCounts,
  SiteFilter,
  CreateSiteInput,
  UpdateSiteInput,
} from "./site.repository";

// Contractor repository
export {
  findContractorById,
  findContractorByIdWithDocuments,
  findContractorByEmail,
  listContractors,
  listContractorsWithDocuments,
  createContractor,
  updateContractor,
  deactivateContractor,
  addContractorDocument,
  deleteContractorDocument,
  findContractorsWithExpiringDocuments,
  findContractorsWithExpiredDocuments,
  countActiveContractors,
} from "./contractor.repository";

export type {
  ContractorWithDocuments,
  ContractorFilter,
  CreateContractorInput,
  UpdateContractorInput,
  CreateDocumentInput,
} from "./contractor.repository";

// Site manager repository
export {
  listManagedSiteIds,
  isUserSiteManagerForSite,
  assignSiteManager,
  removeSiteManager,
} from "./site-manager.repository";

// Magic link repository
export {
  createMagicLinkToken,
  findMagicLinkTokenById,
  consumeMagicLinkToken,
} from "./magic-link.repository";

// Audit repository
export {
  createAuditLog,
  createSystemAuditLog,
  listAuditLogs,
  getEntityAuditLogs,
  getUserActivity,
  getFailedLoginAttempts,
  purgeOldAuditLogs,
} from "./audit.repository";

export type {
  AuditAction,
  CreateAuditLogInput,
  AuditLogFilter,
} from "./audit.repository";

// Sign-in repository
export {
  findSignInById,
  listCurrentlyOnSite,
  countCurrentlyOnSite,
  listSignInHistory,
  createSignIn,
  signOutVisitor,
  getDistinctEmployers,
  getSignInStats,
} from "./signin.repository";

export type {
  SignInRecordWithDetails,
  SignInFilter,
  CreateSignInInput,
  VisitorType,
} from "./signin.repository";

// Template repository
export {
  findTemplateById,
  findTemplateWithQuestions,
  listTemplates,
  getActiveTemplateForSite,
  getTemplateVersions,
  createTemplate,
  updateTemplate,
  publishTemplate,
  createNewVersion,
  archiveTemplate,
  unarchiveTemplate,
  deleteTemplate,
  countTemplates,
} from "./template.repository";

export type {
  TemplateWithCounts,
  TemplateWithQuestions,
  TemplateFilter,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./template.repository";

// Question repository
export {
  findQuestionById,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  bulkCreateQuestions,
} from "./question.repository";

export type {
  Question,
  QuestionType,
  CreateQuestionInput,
  UpdateQuestionInput,
  ReorderQuestionsInput,
} from "./question.repository";

// Public sign-in repository (unauthenticated)
export {
  createPublicSignIn,
  signOutWithToken,
  findPublicSignInById,
} from "./public-signin.repository";

export type {
  PublicSignInInput,
  SignInResult,
} from "./public-signin.repository";
