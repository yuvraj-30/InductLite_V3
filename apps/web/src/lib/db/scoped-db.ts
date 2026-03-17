/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const TENANT_MODELS = [
  "user",
  "site",
  "inductionTemplate",
  "signInRecord",
  "contractor",
  "contractorDocument",
  "hazardRegisterEntry",
  "siteEmergencyContact",
  "siteEmergencyProcedure",
  "emergencyDrill",
  "evacuationEvent",
  "evacuationAttendance",
  "incidentReport",
  "actionRegisterEntry",
  "actionComment",
  "legalDocumentVersion",
  "siteManagerAssignment",
  "magicLinkToken",
  "exportJob",
  "auditLog",
  "emailNotification",
  "outboundWebhookDelivery",
  "inductionQuizAttempt",
  "pendingSignInEscalation",
  "preRegistrationInvite",
  "permitTemplate",
  "permitCondition",
  "permitRequest",
  "permitApproval",
  "contractorPrequalification",
  "competencyRequirement",
  "workerCertification",
  "competencyDecision",
  "visitorApprovalPolicy",
  "visitorApprovalRequest",
  "visitorWatchlistEntry",
  "identityVerificationRecord",
  "identityOcrVerification",
  "emergencyBroadcast",
  "broadcastRecipient",
  "communicationEvent",
  "channelIntegrationConfig",
  "channelDelivery",
  "deviceSubscription",
  "mobileDeviceRuntimeEvent",
  "presenceHint",
  "accessDecisionTrace",
  "hardwareOutageEvent",
  "accessConnectorConfig",
  "accessConnectorHealthEvent",
  "deliveryItem",
  "deliveryEvent",
  "bookableResource",
  "resourceBooking",
  "resourceInspectionRecord",
  "inspectionSchedule",
  "inspectionRun",
  "safetyFormTemplate",
  "safetyFormSubmission",
  "evidenceManifest",
  "evidenceArtifact",
  "policySimulation",
  "policySimulationRun",
  "policySimulationResult",
  "contractorRiskScore",
  "riskScoreHistory",
  "planChangeRequest",
  "planChangeHistory",
] as const;

function andWhere(companyGuard: object, where?: any) {
  if (!where) return companyGuard;
  return { AND: [where, companyGuard] };
}

function getModelGuard(
  model: string,
  companyId: string,
): {
  where: object;
  data?: object;
} {
  switch (model) {
    case "contractorDocument":
      return { where: { contractor: { company_id: companyId } } };
    default:
      return {
        where: { company_id: companyId },
        data: { company_id: companyId },
      };
  }
}

function throwIfUnsafe(operation: string, model: string) {
  const UNSAFE = new Set([
    "findUnique",
    "findUniqueOrThrow",
    "update",
    "delete",
    "upsert",
  ]);
  if (UNSAFE.has(operation)) {
    throw new Error(
      `Unsafe Prisma operation "${operation}" on tenant model "${model}". Use updateMany/deleteMany instead.`,
    );
  }
}

/**
 * scopedDb enforces company_id in WHERE clauses for tenant models.
 * It also prevents unsafe unique operations on tenant models.
 */
export function scopedDb(
  companyId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!companyId || typeof companyId !== "string") {
    throw new Error("company_id is required");
  }

  const proxy: Record<string, unknown> = {};

  // Narrow Prisma to a generic record keyed by model name with function delegates
  const genericPrisma = client as unknown as Record<
    string,
    Record<string, (...args: any[]) => any>
  >;

  for (const model of TENANT_MODELS) {
    const delegate = genericPrisma[model] as
      | Record<string, (...args: unknown[]) => unknown>
      | undefined;

    // If a test did not mock this delegate, provide a stub delegate object that
    // implements the common Prisma delegate methods and throws a descriptive
    // error when invoked. This ensures we never hit a "delegate not found"
    // scenario and gives a clear instruction to authors to add the necessary
    // mock for the model in their test.
    const delegateObj =
      delegate ??
      ({
        findFirst: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        findMany: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        count: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        create: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        updateMany: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        deleteMany: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
        groupBy: () => {
          throw new Error(
            `Prisma delegate "${model}" is not mocked in this test. Add a mock for prisma.${model} with the required methods (findFirst/findMany/count/create/updateMany/deleteMany/groupBy).`,
          );
        },
      } as Record<string, (...args: unknown[]) => unknown>);

    // Resolve the tenant guard for this model
    const modelGuard = getModelGuard(model, companyId);

    // Narrow to an object with required delegate methods so TypeScript understands
    const d = delegateObj as {
      findFirst: (args?: any) => any;
      findMany: (args?: any) => any;
      count: (args?: any) => any;
      create: (args?: any) => any;
      updateMany: (args?: any) => any;
      deleteMany: (args?: any) => any;
      groupBy?: (args?: any) => any;
    };

    proxy[model] = {
      findFirst: (args?: Record<string, unknown>) =>
        d.findFirst({
          ...(args ?? {}),
          where: andWhere(modelGuard.where, args?.where),
        }),
      findMany: (args?: Record<string, unknown>) =>
        d.findMany({
          ...(args ?? {}),
          where: andWhere(modelGuard.where, args?.where),
        }),
      count: (args?: Record<string, unknown>) =>
        d.count({
          ...(args ?? {}),
          where: andWhere(modelGuard.where, args?.where),
        }),
      create: (args?: Record<string, unknown>) =>
        d.create({
          ...(args ?? {}),
          data: {
            ...((args as Record<string, any>)?.data ?? {}),
            ...(modelGuard.data ?? {}),
          },
        }),
      updateMany: (args?: Record<string, unknown>) =>
        d.updateMany({
          ...(args ?? {}),
          where: andWhere(modelGuard.where, args?.where),
        }),
      deleteMany: (args?: Record<string, unknown>) =>
        d.deleteMany({
          ...(args ?? {}),
          where: andWhere(modelGuard.where, args?.where),
        }),
      groupBy: (args?: Record<string, unknown>) => {
        if (typeof d.groupBy === "function") {
          return d.groupBy({
            ...(args ?? {}),
            where: andWhere(modelGuard.where, args?.where) as Record<
              string,
              unknown
            >,
          });
        }
        throw new Error(`groupBy not supported on model "${model}"`);
      }, // intentionally do NOT expose findUnique/update/delete/upsert - throw if attempted
      _unsafe: {
        query: (operation: string) => {
          throwIfUnsafe(operation, model);
          // This branch should never be used - kept for completeness.
        },
      },
    };
  }

  return proxy as {
    user: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
      groupBy: (args?: any) => Promise<any>;
      _unsafe: { query: (op: string) => any };
    };
    site: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
    };
    inductionTemplate: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    signInRecord: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      groupBy: (args?: any) => Promise<any>;
    };
    contractor: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    contractorDocument: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    hazardRegisterEntry: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    siteEmergencyContact: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    siteEmergencyProcedure: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    emergencyDrill: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    evacuationEvent: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    evacuationAttendance: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    incidentReport: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    actionRegisterEntry: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    actionComment: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    legalDocumentVersion: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    siteManagerAssignment: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    magicLinkToken: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    auditLog: {
      create: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      deleteMany: (args?: any) => Promise<any>;
    };
    exportJob: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    emailNotification: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    outboundWebhookDelivery: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
      groupBy: (args?: any) => Promise<any>;
    };
    inductionQuizAttempt: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    pendingSignInEscalation: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    preRegistrationInvite: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    permitTemplate: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    permitCondition: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    permitRequest: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    permitApproval: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    contractorPrequalification: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    competencyRequirement: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    workerCertification: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    competencyDecision: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    visitorApprovalPolicy: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    visitorApprovalRequest: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    visitorWatchlistEntry: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    identityVerificationRecord: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    emergencyBroadcast: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    broadcastRecipient: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    communicationEvent: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    channelIntegrationConfig: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    channelDelivery: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    deviceSubscription: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    presenceHint: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    accessDecisionTrace: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    hardwareOutageEvent: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    deliveryItem: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    deliveryEvent: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    bookableResource: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    resourceBooking: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    resourceInspectionRecord: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    inspectionSchedule: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    inspectionRun: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    evidenceManifest: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    evidenceArtifact: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    policySimulation: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    policySimulationRun: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    policySimulationResult: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    contractorRiskScore: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    riskScoreHistory: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    planChangeRequest: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
    planChangeHistory: {
      findFirst: (args?: any) => Promise<any>;
      findMany: (args?: any) => Promise<any[]>;
      count: (args?: any) => Promise<number>;
      create: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<{ count: number }>;
      deleteMany: (args?: any) => Promise<any>;
    };
  };
}
