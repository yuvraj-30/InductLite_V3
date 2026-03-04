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
  purgeInactiveUser,
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

// Auth repository
export {
  registerCompanyWithAdmin,
} from "./auth.repository";

export type {
  RegisterCompanyWithAdminInput,
  RegisterCompanyWithAdminResult,
} from "./auth.repository";

// Company repository
export {
  findCompanyComplianceSettings,
  updateCompanyComplianceSettings,
  findCompanySsoSettings,
  findCompanySsoSettingsBySlug,
  updateCompanySsoSettings,
} from "./company.repository";

export type {
  CompanyComplianceSettings,
  CompanySsoSettingsRecord,
  UpdateCompanyComplianceSettingsInput,
} from "./company.repository";

// Plan entitlement repository
export {
  findCompanyEntitlementSettings,
  updateCompanyEntitlementSettings,
  findSiteEntitlementOverrides,
  updateSiteEntitlementOverrides,
} from "./plan-entitlement.repository";

export type {
  FeatureToggleMap,
  FeatureCreditMap,
  CompanyEntitlementSettings,
  SiteEntitlementOverrides,
  UpdateCompanyEntitlementSettingsInput,
  UpdateSiteEntitlementOverridesInput,
} from "./plan-entitlement.repository";

// Pre-registration repository
export {
  createPreRegistrationInvite,
  listPreRegistrationInvites,
  findActivePreRegistrationInviteByToken,
  markPreRegistrationInviteUsed,
  deactivatePreRegistrationInvite,
} from "./pre-registration.repository";

export type {
  CreatePreRegistrationInviteInput,
  PreRegistrationInviteRecord,
  CreatedPreRegistrationInvite,
  PreRegistrationInviteFilter,
} from "./pre-registration.repository";

// Site repository
export {
  findSiteById,
  findSiteByIdWithCounts,
  findSiteByPublicSlug,
  listSiteManagerNotificationRecipients,
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
  SiteManagerNotificationRecipient,
  SiteFilter,
  CreateSiteInput,
  UpdateSiteInput,
} from "./site.repository";

// Email repository
export { queueEmailNotification } from "./email.repository";
export type { QueueEmailNotificationInput } from "./email.repository";

// Outbound webhook delivery repository
export {
  queueOutboundWebhookDeliveries,
  listOutboundWebhookDeliveries,
  countOutboundWebhookDeliveriesByStatus,
  listDueOutboundWebhookDeliveries,
  claimOutboundWebhookDelivery,
  markOutboundWebhookDeliverySent,
  markOutboundWebhookDeliveryRetriableFailure,
} from "./webhook-delivery.repository";

export type {
  QueueOutboundWebhookDeliveryInput,
  OutboundWebhookDeliveryWorkItem,
  OutboundWebhookDeliveryListItem,
} from "./webhook-delivery.repository";

// Induction quiz attempt repository
export {
  findInductionQuizAttemptState,
  upsertInductionQuizAttemptState,
} from "./induction-quiz-attempt.repository";

export type {
  InductionQuizAttemptState,
} from "./induction-quiz-attempt.repository";

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
  purgeInactiveContractor,
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

// Export repository
export {
  countExportJobsSince,
  countRunningExportJobs,
  countRunningExportJobsGlobal,
  createExportJob,
  queueExportJobWithLimits,
  listExportJobs,
  findNextQueuedExportJob,
  claimNextQueuedExportJob,
  requeueStaleExportJobs,
  listExpiredExportJobs,
  deleteExportJob,
  markExportJobRunning,
  markExportJobSucceeded,
  markExportJobFailed,
  requeueExportJob,
  findExportJobById,
  ExportLimitReachedError,
} from "./export.repository";

export type { CreateExportJobInput, ExportJobFilter } from "./export.repository";

// Sitemap repository
export { listActiveSitemapPublicLinks } from "./sitemap.repository";
export type { SitemapPublicLink } from "./sitemap.repository";

// Public demo booking repository
export {
  createDemoBookingRequest,
  updateDemoBookingNotificationStatus,
} from "./demo-booking.repository";
export type {
  CreateDemoBookingRequestInput,
  UpdateDemoBookingNotificationInput,
} from "./demo-booking.repository";

// Permit and prequalification repository
export {
  listPermitTemplates,
  findRequiredPermitTemplateForSite,
  createPermitTemplate,
  updatePermitTemplate,
  listPermitConditions,
  createPermitCondition,
  createPermitRequest,
  listPermitRequests,
  transitionPermitRequest,
  createPermitApproval,
  findActivePermitForVisitor,
  upsertContractorPrequalification,
  listContractorPrequalifications,
  listPermitRequestsExpiringSoon,
  listContractorPrequalificationsExpiringSoon,
} from "./permit.repository";
export type {
  CreatePermitTemplateInput,
  CreatePermitConditionInput,
  CreatePermitRequestInput,
  ListPermitRequestFilter,
  TransitionPermitRequestInput,
  CreatePermitApprovalInput,
  UpsertContractorPrequalificationInput,
} from "./permit.repository";

// Visitor approval and identity hardening repository
export {
  shouldTriggerRandomCheck,
  listVisitorApprovalPolicies,
  findActiveVisitorApprovalPolicy,
  upsertVisitorApprovalPolicy,
  createVisitorWatchlistEntry,
  listVisitorWatchlistEntries,
  deactivateVisitorWatchlistEntry,
  matchVisitorAgainstWatchlist,
  createVisitorApprovalRequest,
  listVisitorApprovalRequests,
  findVisitorApprovalRequestByTokenHash,
  findLatestVisitorApprovalDecision,
  transitionVisitorApprovalRequest,
  createIdentityVerificationRecord,
  listIdentityVerificationRecords,
} from "./visitor-approval.repository";
export type {
  UpsertVisitorApprovalPolicyInput,
  CreateVisitorWatchlistEntryInput,
  MatchVisitorAgainstWatchlistInput,
  CreateVisitorApprovalRequestInput,
  TransitionVisitorApprovalRequestInput,
  CreateIdentityVerificationRecordInput,
  WatchlistMatchResult,
} from "./visitor-approval.repository";

// Communications and channel integrations repository
export {
  createEmergencyBroadcast,
  listEmergencyBroadcasts,
  createBroadcastRecipient,
  listBroadcastRecipients,
  findBroadcastRecipientByTokenHash,
  updateBroadcastRecipientStatus,
  createCommunicationEvent,
  listCommunicationEvents,
  findCommunicationEventByStatus,
  upsertChannelIntegrationConfig,
  listChannelIntegrationConfigs,
  findChannelIntegrationConfigById,
  createChannelDelivery,
  listChannelDeliveries,
  markChannelDeliveryStatus,
  buildBroadcastAckToken,
} from "./communication.repository";
export type {
  CreateEmergencyBroadcastInput,
  CreateBroadcastRecipientInput,
  UpdateBroadcastRecipientStatusInput,
  UpsertChannelIntegrationConfigInput,
  CreateChannelDeliveryInput,
} from "./communication.repository";

// Mobile push and presence operations repository
export {
  upsertDeviceSubscription,
  deactivateDeviceSubscription,
  listActiveDeviceSubscriptions,
  createPresenceHint,
  listPresenceHints,
  resolvePresenceHint,
} from "./mobile-ops.repository";
export type {
  UpsertDeviceSubscriptionInput,
  CreatePresenceHintInput,
} from "./mobile-ops.repository";

// Hardware trace and outage repository
export {
  createAccessDecisionTrace,
  updateAccessDecisionTraceAck,
  listAccessDecisionTraces,
  createHardwareOutageEvent,
  resolveHardwareOutageEvent,
  listHardwareOutageEvents,
} from "./hardware-trace.repository";
export type {
  CreateAccessDecisionTraceInput,
  UpdateAccessDecisionTraceAckInput,
  CreateHardwareOutageEventInput,
} from "./hardware-trace.repository";

// Evidence manifest repository
export {
  sha256Hex,
  computeEvidenceHashRoot,
  signEvidenceHashRoot,
  verifyEvidenceSignature,
  createEvidenceManifest,
  findEvidenceManifestById,
  findEvidenceManifestByExportJobId,
  listEvidenceManifests,
  createEvidenceArtifact,
  listEvidenceArtifactsForManifest,
} from "./evidence.repository";
export type {
  CreateEvidenceManifestInput,
  CreateEvidenceArtifactInput,
} from "./evidence.repository";

// Policy simulator repository
export {
  createPolicySimulation,
  listPolicySimulations,
  findPolicySimulationById,
  createPolicySimulationRun,
  updatePolicySimulationRunStatus,
  createPolicySimulationResult,
  listPolicySimulationRuns,
  findPolicySimulationResultByRunId,
  estimatePolicySimulationImpact,
  countPolicySimulationRunsSince,
} from "./policy-simulator.repository";
export type {
  CreatePolicySimulationInput,
  RunPolicySimulationInput,
  PolicySimulationEstimate,
} from "./policy-simulator.repository";

// Risk passport repository
export {
  computeContractorRiskScore,
  upsertContractorRiskScore,
  refreshContractorRiskScore,
  refreshAllContractorRiskScores,
  listContractorRiskScores,
  listContractorRiskHistory,
  countRiskScoreHistorySince,
} from "./risk-passport.repository";
export type { ContractorRiskComputation } from "./risk-passport.repository";

// Plan change repository
export {
  createPlanChangeRequest,
  listPlanChangeRequests,
  createPlanChangeHistoryEntry,
  schedulePlanChangeRequest,
  cancelPlanChangeRequest,
  applyDuePlanChanges,
  listPlanChangeHistory,
} from "./plan-change.repository";
export type { CreatePlanChangeRequestInput } from "./plan-change.repository";

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

// Advanced audit analytics repository
export { getAdvancedAuditAnalytics } from "./audit-analytics.repository";
export type { AdvancedAuditAnalytics } from "./audit-analytics.repository";

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
  ensureDefaultPublishedTemplate,
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

// Hazard repository
export {
  findHazardById,
  listHazards,
  createHazard,
  updateHazard,
  closeHazard,
} from "./hazard.repository";

export type {
  HazardFilter,
  CreateHazardInput,
  UpdateHazardInput,
} from "./hazard.repository";

// Emergency repository
export {
  listSiteEmergencyContacts,
  createSiteEmergencyContact,
  updateSiteEmergencyContact,
  deactivateSiteEmergencyContact,
  listSiteEmergencyProcedures,
  createSiteEmergencyProcedure,
  updateSiteEmergencyProcedure,
  deactivateSiteEmergencyProcedure,
  listEmergencyDrills,
  createEmergencyDrill,
  findActiveRollCallEvent,
  listRollCallEvents,
  listRollCallAttendances,
  startRollCallEvent,
  updateRollCallAttendance,
  markAllRollCallAttendancesAccounted,
  closeRollCallEvent,
  getRollCallEventExportCsv,
} from "./emergency.repository";

export type {
  CreateEmergencyContactInput,
  UpdateEmergencyContactInput,
  CreateEmergencyProcedureInput,
  UpdateEmergencyProcedureInput,
  CreateEmergencyDrillInput,
  StartRollCallEventInput,
  UpdateRollCallAttendanceInput,
  CloseRollCallEventInput,
} from "./emergency.repository";

// Incident repository
export {
  findIncidentReportById,
  listIncidentReports,
  createIncidentReport,
  resolveIncidentReport,
} from "./incident.repository";

export type { IncidentFilter, CreateIncidentInput } from "./incident.repository";

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

// Sign-in escalation repository
export {
  createPendingSignInEscalation,
  findSignInEscalationById,
  listSignInEscalations,
  setSignInEscalationNotificationCounts,
  approveSignInEscalation,
  denySignInEscalation,
} from "./signin-escalation.repository";

export type {
  CreateSignInEscalationInput,
  SignInEscalationRecord,
} from "./signin-escalation.repository";
