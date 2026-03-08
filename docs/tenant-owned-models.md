# Tenant Owned Models

Version: `v4`
Updated: `2026-03-07`
Source: `apps/web/prisma/schema.prisma`

This file is the canonical `TENANT_OWNED_MODELS` registry.
It must be auto-generated from Prisma schema in CI.
Manual edits are not allowed.

## Models With `company_id`

- `User`
- `Site`
- `InductionTemplate`
- `SignInRecord`
- `PendingSignInEscalation`
- `EmailNotification`
- `Contractor`
- `SiteManagerAssignment`
- `MagicLinkToken`
- `ExportJob`
- `AuditLog`
- `HazardRegisterEntry`
- `SiteEmergencyContact`
- `SiteEmergencyProcedure`
- `IncidentReport`
- `EmergencyDrill`
- `LegalDocumentVersion`
- `PermitTemplate`
- `PermitCondition`
- `PermitRequest`
- `PermitApproval`
- `ContractorPrequalification`
- `VisitorApprovalPolicy`
- `VisitorApprovalRequest`
- `VisitorWatchlistEntry`
- `IdentityVerificationRecord`
- `EmergencyBroadcast`
- `BroadcastRecipient`
- `CommunicationEvent`
- `ChannelIntegrationConfig`
- `ChannelDelivery`
- `DeviceSubscription`
- `PresenceHint`
- `AccessDecisionTrace`
- `HardwareOutageEvent`
- `DeliveryItem`
- `DeliveryEvent`
- `BookableResource`
- `ResourceBooking`
- `SafetyFormTemplate`
- `SafetyFormSubmission`
- `EvidenceManifest`
- `EvidenceArtifact`
- `PolicySimulation`
- `PolicySimulationRun`
- `PolicySimulationResult`
- `ContractorRiskScore`
- `RiskScoreHistory`
- `PlanChangeRequest`
- `PlanChangeHistory`

## Child Models Without `company_id` (Parent-Scoped Only)

- `SitePublicLink` (scoped by `site_id -> Site.company_id`)
- `InductionQuestion` (scoped by `template_id -> InductionTemplate.company_id`)
- `InductionResponse` (scoped by `sign_in_record_id -> SignInRecord.company_id`)
- `ContractorDocument` (scoped by `contractor_id -> Contractor.company_id`)

## Enforcement Notes

- Direct Prisma access to these models outside approved scoped DB modules must fail CI.
- Any model list change must include schema diff + updated tests.
