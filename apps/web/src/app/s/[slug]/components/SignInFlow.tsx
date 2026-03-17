"use client";

/**
 * Sign-In Flow Component
 *
 * Multi-step sign-in flow:
 * 1. Visitor details
 * 2. Induction questions
 * 3. Signature + submit
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentClass,
} from "react";
import dynamic from "next/dynamic";
import type SignatureCanvas from "react-signature-canvas";
import type { SignatureCanvasProps } from "react-signature-canvas";
import { submitSignIn, type SiteInfo, type TemplateInfo } from "../actions";
import { isValidPhoneE164, formatToE164 } from "@inductlite/shared";
import { shouldSkipQuestions } from "@/lib/logic/evaluator";
import {
  clearQueuedSignIn,
  hasQueuedSignIn,
  saveQueuedSignIn,
} from "@/lib/offline/signin-queue";
import { syncQueuedSignIn } from "@/lib/offline/signin-sync";
import { reportUxEvent } from "@/lib/ux-events/client";

const InductionQuestions = dynamic(
  () =>
    import("./InductionQuestions").then((mod) => ({
      default: mod.InductionQuestions,
    })),
  {
    loading: () => (
      <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 text-sm text-secondary">
        Loading induction questions...
      </div>
    ),
  },
);

const SuccessScreen = dynamic(
  () =>
    import("./SuccessScreen").then((mod) => ({
      default: mod.SuccessScreen,
    })),
  {
    loading: () => (
      <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 text-sm text-secondary">
        Finalizing your sign-in...
      </div>
    ),
  },
);

interface SignInFlowProps {
  slug: string;
  site: SiteInfo;
  template: TemplateInfo;
  isKiosk?: boolean;
  prefillInvite?: {
    token: string;
    visitorName: string;
    visitorPhone: string;
    visitorEmail?: string | null;
    employerName?: string | null;
    visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
    roleOnSite?: string | null;
  };
}

type Step = "details" | "induction" | "signature" | "success";

const SIGN_IN_STEPS: Exclude<Step, "success">[] = [
  "details",
  "induction",
  "signature",
];

const STEP_META: Record<
  Exclude<Step, "success">,
  {
    index: number;
    label: string;
    shortLabel: string;
    title: string;
    description: string;
    eta: string;
  }
> = {
  details: {
    index: 1,
    label: "Your Details",
    shortLabel: "Identify",
    title: "Confirm who is checking in",
    description:
      "Start with the essentials so we can move you into site clearance quickly.",
    eta: "About 30 seconds",
  },
  induction: {
    index: 2,
    label: "Induction",
    shortLabel: "Review",
    title: "Review site rules and answer required checks",
    description:
      "Work through the induction content, emergency instructions, and any mandatory questions.",
    eta: "About 1 to 2 minutes",
  },
  signature: {
    index: 3,
    label: "Sign Off",
    shortLabel: "Clear",
    title: "Complete the final clearance check",
    description:
      "Sign once to confirm your induction is complete and activate your site access record.",
    eta: "About 15 seconds",
  },
};

interface VisitorDetails {
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string;
  employerName: string;
  visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  roleOnSite: string;
  hostRecipientId: string;
  hasAcceptedTerms: boolean;
}

interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
  competencyStatus?: "CLEAR" | "EXPIRING" | "BLOCKED";
  competencyBlockedReason?: string | null;
  competencyRequirementCount?: number;
  competencyMissingCount?: number;
  competencyExpiringCount?: number;
}

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
}

type PublicSignInPayload = Parameters<typeof submitSignIn>[0];

type PersistedVisitorDetails = Omit<VisitorDetails, "employerName">;

interface DraftState {
  step: Exclude<Step, "success">;
  details: PersistedVisitorDetails;
  answers: Record<string, unknown>;
  selectedLanguageCode: string;
  mediaAcknowledged: boolean;
  geofenceOverrideCode: string;
  expressMode: boolean;
  rememberDetails: boolean;
  rememberSignature: boolean;
  reuseSavedSignature: boolean;
  updatedAt: string;
}

interface LastVisitSnapshot {
  details: Omit<VisitorDetails, "hasAcceptedTerms" | "employerName">;
  signatureData?: string;
  templateId?: string;
  templateVersion?: number;
  termsVersion?: number;
  privacyVersion?: number;
  languageCode?: string;
  savedAt: string;
}

function getPersistableDetails(details: VisitorDetails): PersistedVisitorDetails {
  return {
    visitorName: details.visitorName,
    visitorPhone: details.visitorPhone,
    visitorEmail: details.visitorEmail,
    visitorType: details.visitorType,
    roleOnSite: details.roleOnSite,
    hostRecipientId: details.hostRecipientId,
    hasAcceptedTerms: details.hasAcceptedTerms,
  };
}

function sanitizeOfflineQueuePayload(
  payload: PublicSignInPayload,
): PublicSignInPayload {
  // Do not persist sensitive profile or identity evidence in browser storage.
  return {
    ...payload,
    employerName: undefined,
    geofenceOverrideCode: undefined,
    visitorPhotoDataUrl: undefined,
    visitorIdDataUrl: undefined,
    visitorIdType: undefined,
    identityConsentAccepted: undefined,
  };
}

function createClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function isAnswerPresent(answer: unknown): boolean {
  if (answer === null || answer === undefined || answer === "") return false;
  if (Array.isArray(answer)) return answer.length > 0;
  return true;
}

function getMissingRequiredQuestionIds(
  questions: TemplateInfo["questions"],
  answers: Record<string, unknown>,
): string[] {
  return questions
    .filter((question) => question.isRequired)
    .filter((question) => {
      const value = answers[question.id];
      if (!isAnswerPresent(value)) return true;

      if (question.questionType === "ACKNOWLEDGMENT" && value !== true) {
        return true;
      }

      return false;
    })
    .map((question) => question.id);
}

function toTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized) {
    return `tel:${phone}`;
  }
  return `tel:${normalized}`;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const latDelta = degreesToRadians(endLatitude - startLatitude);
  const lonDelta = degreesToRadians(endLongitude - startLongitude);
  const fromLat = degreesToRadians(startLatitude);
  const toLat = degreesToRadians(endLatitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

const MAX_IDENTITY_EVIDENCE_BYTES = 2 * 1024 * 1024;

function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value.startsWith("data:image/")) {
        reject(new Error("Only image files are supported."));
        return;
      }
      resolve(value);
    };
    reader.onerror = () => reject(new Error("Unable to read selected image."));
    reader.readAsDataURL(file);
  });
}

export function SignInFlow({
  slug,
  site,
  template,
  isKiosk,
  prefillInvite,
}: SignInFlowProps) {
  const [step, setStep] = useState<Step>("details");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [missingRequiredQuestionIds, setMissingRequiredQuestionIds] = useState<
    string[]
  >([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(
    template.language.defaultLanguage,
  );
  const [mediaAcknowledged, setMediaAcknowledged] = useState(false);
  const [geofenceOverrideCode, setGeofenceOverrideCode] = useState("");
  const [visitorPhotoDataUrl, setVisitorPhotoDataUrl] = useState<string | undefined>(
    undefined,
  );
  const [visitorIdDataUrl, setVisitorIdDataUrl] = useState<string | undefined>(
    undefined,
  );
  const [visitorIdType, setVisitorIdType] = useState("Driver Licence");
  const [identityConsentAccepted, setIdentityConsentAccepted] = useState(false);
  const [expressMode, setExpressMode] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueueMessage, setPendingQueueMessage] = useState<string | null>(
    null,
  );
  const [rememberDetails, setRememberDetails] = useState(true);
  const [rememberSignature, setRememberSignature] = useState(false);
  const [reuseSavedSignature, setReuseSavedSignature] = useState(false);
  const [lastVisitSnapshot, setLastVisitSnapshot] = useState<LastVisitSnapshot | null>(
    null,
  );
  const [capturedLocation, setCapturedLocation] = useState<CapturedLocation | null>(
    null,
  );
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const previousStepRef = useRef<Step>("details");

  const sigCanvas = useRef<SignatureCanvas>(null);
  const [SignatureCanvasComponent, setSignatureCanvasComponent] =
    useState<ComponentClass<SignatureCanvasProps> | null>(null);

  const [details, setDetails] = useState<VisitorDetails>(() => ({
    visitorName: prefillInvite?.visitorName ?? "",
    visitorPhone: prefillInvite?.visitorPhone ?? "",
    visitorEmail: prefillInvite?.visitorEmail ?? "",
    employerName: prefillInvite?.employerName ?? "",
    visitorType: prefillInvite?.visitorType ?? "CONTRACTOR",
    roleOnSite: prefillInvite?.roleOnSite ?? "",
    hostRecipientId: "",
    hasAcceptedTerms: false,
  }));

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [signInResult, setSignInResult] = useState<SignInResult | null>(null);
  const [idempotencyKey] = useState<string>(() => createClientIdempotencyKey());

  const draftStorageKey = useMemo(() => `inductlite:sign-in-draft:${slug}`, [slug]);
  const queueStorageKey = useMemo(() => `inductlite:sign-in-queue:${slug}`, [slug]);
  const lastVisitStorageKey = useMemo(
    () => `inductlite:last-visit:${slug}`,
    [slug],
  );
  const emergencyContacts = site.emergencyContacts ?? [];
  const emergencyProcedures = site.emergencyProcedures ?? [];
  const hostRecipients = site.hostRecipients ?? [];
  const locationAudit = site.locationAudit;
  const geofencePolicy = site.geofence;
  const identityEvidence = site.identityEvidence ?? {
    enabled: false,
    requirePhoto: false,
    requireIdScan: false,
    requireConsent: false,
    requireOcrVerification: false,
    allowedDocumentTypes: [],
    ocrDecisionMode: "assist",
  };
  const mediaConfig = template.media;
  const languageConfig = template.language;
  const languageChoices = languageConfig.available;
  const languageSelectionEnabled = languageConfig.enabled && languageChoices.length > 1;
  const selectedLanguageVariant = useMemo(
    () =>
      languageConfig.variants.find(
        (variant) => variant.languageCode === selectedLanguageCode,
      ) ?? null,
    [languageConfig.variants, selectedLanguageCode],
  );
  const localizedTemplateName =
    selectedLanguageVariant?.templateName ?? template.name;
  const localizedTemplateDescription =
    selectedLanguageVariant?.templateDescription ?? template.description;
  const localizedQuestions = useMemo(() => {
    const questionOverridesById = new Map(
      (selectedLanguageVariant?.questions ?? []).map((question) => [
        question.questionId,
        question,
      ]),
    );

    return template.questions.map((question) => {
      const override = questionOverridesById.get(question.id);
      return {
        ...question,
        questionText: override?.questionText ?? question.questionText,
      };
    });
  }, [selectedLanguageVariant, template.questions]);
  const localizedOptionLabels = useMemo(() => {
    const labelsByQuestionId: Record<string, string[]> = {};
    for (const question of selectedLanguageVariant?.questions ?? []) {
      if (question.optionLabels && question.optionLabels.length > 0) {
        labelsByQuestionId[question.questionId] = question.optionLabels;
      }
    }
    return labelsByQuestionId;
  }, [selectedLanguageVariant]);
  const templateForInduction = useMemo(
    () => ({
      ...template,
      questions: localizedQuestions,
    }),
    [localizedQuestions, template],
  );
  const visibleQuestions = useMemo(() => {
    const allQuestions = templateForInduction.questions;
    const visible: typeof allQuestions = [];

    for (let index = 0; index < allQuestions.length; ) {
      const question = allQuestions[index];
      if (!question) break;

      visible.push(question);

      const answer = answers[question.id];
      const skipCountRaw = shouldSkipQuestions(question.logic, answer);
      const skipCount =
        Number.isFinite(skipCountRaw) && skipCountRaw > 0
          ? Math.trunc(skipCountRaw)
          : 0;

      index += 1 + skipCount;
    }

    return visible;
  }, [answers, templateForInduction.questions]);
  const visibleTemplateForInduction = useMemo(
    () => ({
      ...templateForInduction,
      questions: visibleQuestions,
    }),
    [templateForInduction, visibleQuestions],
  );
  const mediaAcknowledgementLabel =
    selectedLanguageVariant?.acknowledgementLabel ??
    mediaConfig.acknowledgementLabel;
  const mediaAcknowledgementRequired =
    mediaConfig.enabled && mediaConfig.requireAcknowledgement;
  const locationAuditEnabled = Boolean(locationAudit?.enabled);
  const siteHasLocationTarget =
    locationAudit?.siteLatitude !== null &&
    locationAudit?.siteLatitude !== undefined &&
    locationAudit?.siteLongitude !== null &&
    locationAudit?.siteLongitude !== undefined;
  const legalConsentStatement =
    site.legal?.consentStatement ??
    "I acknowledge the site safety terms and privacy notice.";
  const lastVisitMatchesCurrentInduction = useMemo(() => {
    if (!lastVisitSnapshot || !site.legal) {
      return false;
    }

    return (
      lastVisitSnapshot.templateId === template.id &&
      lastVisitSnapshot.templateVersion === template.version &&
      lastVisitSnapshot.termsVersion === site.legal.termsVersion &&
      lastVisitSnapshot.privacyVersion === site.legal.privacyVersion
    );
  }, [lastVisitSnapshot, site.legal, template.id, template.version]);
  const locationDistanceMeters = useMemo(() => {
    if (!capturedLocation || !siteHasLocationTarget) {
      return null;
    }

    return calculateDistanceMeters(
      locationAudit!.siteLatitude!,
      locationAudit!.siteLongitude!,
      capturedLocation.latitude,
      capturedLocation.longitude,
    );
  }, [capturedLocation, locationAudit, siteHasLocationTarget]);
  const locationWithinRadius =
    locationDistanceMeters !== null
      ? locationDistanceMeters <= (locationAudit?.siteRadiusMeters ?? 150)
      : null;
  const geofenceEnforcementEnabled = geofencePolicy?.enforcementEnabled === true;
  const geofenceLocationMissingAndRequired =
    geofenceEnforcementEnabled &&
    geofencePolicy?.allowMissingLocation === false &&
    !capturedLocation;
  const geofenceOutsideRadius =
    geofenceEnforcementEnabled && locationWithinRadius === false;
  const geofenceNeedsOverride =
    geofenceEnforcementEnabled &&
    geofencePolicy?.mode === "OVERRIDE" &&
    (geofenceLocationMissingAndRequired || geofenceOutsideRadius);
  const identityEvidenceEnabled = identityEvidence.enabled === true;
  const identityPhotoRequired =
    identityEvidenceEnabled && identityEvidence.requirePhoto === true;
  const identityIdRequired =
    identityEvidenceEnabled && identityEvidence.requireIdScan === true;
  const identityConsentRequired =
    identityEvidenceEnabled && identityEvidence.requireConsent === true;
  const identityOcrRequired =
    identityEvidenceEnabled &&
    identityEvidence.requireOcrVerification === true &&
    identityIdRequired;

  useEffect(() => {
    if (SignatureCanvasComponent) return;

    let cancelled = false;
    void import("react-signature-canvas").then((mod) => {
      if (!cancelled) {
        setSignatureCanvasComponent(
          () => mod.default as ComponentClass<SignatureCanvasProps>,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [SignatureCanvasComponent]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(window.navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(draftStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DraftState;
        if (parsed.step) setStep(parsed.step);
        if (parsed.details) {
          setDetails((previous) => ({
            ...previous,
            ...parsed.details,
            employerName: "",
          }));
        }
        if (parsed.answers) setAnswers(parsed.answers);
        if (
          typeof parsed.selectedLanguageCode === "string" &&
          parsed.selectedLanguageCode
        ) {
          setSelectedLanguageCode(parsed.selectedLanguageCode);
        }
        if (typeof parsed.mediaAcknowledged === "boolean") {
          setMediaAcknowledged(parsed.mediaAcknowledged);
        }
        if (typeof parsed.geofenceOverrideCode === "string") {
          setGeofenceOverrideCode(parsed.geofenceOverrideCode);
        }
        if (typeof parsed.expressMode === "boolean") {
          setExpressMode(parsed.expressMode);
        }
        if (typeof parsed.rememberDetails === "boolean") {
          setRememberDetails(parsed.rememberDetails);
        }
        if (typeof parsed.rememberSignature === "boolean") {
          setRememberSignature(parsed.rememberSignature);
        }
        if (typeof parsed.reuseSavedSignature === "boolean") {
          setReuseSavedSignature(parsed.reuseSavedSignature);
        }
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      }
    }

    if (hasQueuedSignIn(queueStorageKey)) {
      setPendingQueueMessage(
        "A previous sign-in is queued and ready to sync when online.",
      );
    }

    const snapshotRaw = window.localStorage.getItem(lastVisitStorageKey);
    if (!snapshotRaw) return;

    try {
      const parsedSnapshot = JSON.parse(snapshotRaw) as LastVisitSnapshot;
      if (parsedSnapshot.details?.visitorPhone) {
        setLastVisitSnapshot(parsedSnapshot);
        if (parsedSnapshot.signatureData) {
          setRememberSignature(true);
        }
      } else {
        window.localStorage.removeItem(lastVisitStorageKey);
      }
    } catch {
      window.localStorage.removeItem(lastVisitStorageKey);
    }
  }, [draftStorageKey, lastVisitStorageKey, queueStorageKey]);

  useEffect(() => {
    const isKnownLanguage = languageChoices.some(
      (choice) => choice.code === selectedLanguageCode,
    );
    if (!isKnownLanguage) {
      setSelectedLanguageCode(languageConfig.defaultLanguage);
    }
  }, [
    languageChoices,
    languageConfig.defaultLanguage,
    selectedLanguageCode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (step === "success") {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }

    const draft: DraftState = {
      step: step as Exclude<Step, "success">,
      details: getPersistableDetails(details),
      answers,
      selectedLanguageCode,
      mediaAcknowledged,
      geofenceOverrideCode,
      expressMode,
      rememberDetails,
      rememberSignature,
      reuseSavedSignature,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [
    answers,
    details,
    draftStorageKey,
    expressMode,
    mediaAcknowledged,
    geofenceOverrideCode,
    selectedLanguageCode,
    rememberDetails,
    rememberSignature,
    reuseSavedSignature,
    step,
  ]);

  useEffect(() => {
    setMissingRequiredQuestionIds((prev) =>
      prev.filter((questionId) =>
        visibleQuestions.some((question) => question.id === questionId),
      ),
    );
  }, [visibleQuestions]);

  useEffect(() => {
    if (!isKiosk || step !== "success") return;

    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [isKiosk, step]);

  useEffect(() => {
    if (!isKiosk) return;
    if (!rememberSignature && !reuseSavedSignature) return;

    setRememberSignature(false);
    setReuseSavedSignature(false);
  }, [isKiosk, rememberSignature, reuseSavedSignature]);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    if (previousStep === step) return;

    previousStepRef.current = step;
    reportUxEvent({
      event: "ux.induction.step_transition",
      slug,
      fromStep: previousStep,
      toStep: step,
      flowId: idempotencyKey,
      isKiosk,
    });
  }, [idempotencyKey, isKiosk, slug, step]);

  const applySuccessResult = (data: SignInResult) => {
    setSignInResult(data);
    setStep("success");
    setError(null);
    setMissingRequiredQuestionIds([]);
    setPendingQueueMessage(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
      clearQueuedSignIn(queueStorageKey);
    }
  };

  const rememberLastVisit = (payload: PublicSignInPayload) => {
    if (typeof window === "undefined") return;
    if (!rememberDetails && !rememberSignature) {
      window.localStorage.removeItem(lastVisitStorageKey);
      setLastVisitSnapshot(null);
      return;
    }

    const signatureData =
      rememberSignature && typeof payload.signatureData === "string"
        ? payload.signatureData
        : undefined;

    const snapshot: LastVisitSnapshot = {
      details: {
        visitorName: payload.visitorName,
        visitorPhone: payload.visitorPhone,
        visitorEmail: payload.visitorEmail ?? "",
        visitorType: payload.visitorType,
        roleOnSite: payload.roleOnSite ?? "",
        hostRecipientId: payload.hostRecipientId ?? "",
      },
      signatureData,
      templateId: template.id,
      templateVersion: template.version,
      termsVersion: site.legal?.termsVersion,
      privacyVersion: site.legal?.privacyVersion,
      languageCode: payload.languageCode,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(lastVisitStorageKey, JSON.stringify(snapshot));
    setLastVisitSnapshot(snapshot);
  };

  const applyLastVisitDetails = () => {
    if (!lastVisitSnapshot) return;

    setDetails((prev) => ({
      ...prev,
      ...lastVisitSnapshot.details,
      employerName: "",
      hasAcceptedTerms: false,
    }));
    setExpressMode(true);
    setError(null);
    setFieldErrors({});
    if (lastVisitSnapshot.signatureData) {
      setReuseSavedSignature(true);
      setRememberSignature(true);
    }
  };

  const updateDetails = (updates: Partial<VisitorDetails>) => {
    setDetails((previous) => ({
      ...previous,
      ...updates,
    }));
  };

  const submitPayload = async (payload: PublicSignInPayload): Promise<boolean> => {
    const result = await submitSignIn(payload);

    if (!result.success) {
      if (
        result.error.code === "VALIDATION_ERROR" &&
        result.error.fieldErrors
      ) {
        setFieldErrors(result.error.fieldErrors);
      }
      setError(result.error.message || "Failed to sign in");
      return false;
    }

    rememberLastVisit(payload);
    applySuccessResult({
      signInRecordId: result.data.signInRecordId,
      signOutToken: result.data.signOutToken,
      signOutTokenExpiresAt: new Date(result.data.signOutTokenExpiresAt),
      visitorName: result.data.visitorName,
      siteName: result.data.siteName,
      signInTime: new Date(result.data.signInTime),
      competencyStatus: result.data.competencyStatus,
      competencyBlockedReason: result.data.competencyBlockedReason,
      competencyRequirementCount: result.data.competencyRequirementCount,
      competencyMissingCount: result.data.competencyMissingCount,
      competencyExpiringCount: result.data.competencyExpiringCount,
    });
    return true;
  };

  const queuePayloadForSync = (payload: PublicSignInPayload) => {
    saveQueuedSignIn(queueStorageKey, sanitizeOfflineQueuePayload(payload));
    setPendingQueueMessage(
      "No internet connection. Sign-in saved and ready to sync when you are online.",
    );
  };

  const syncQueuedSubmission = () => {
    startTransition(async () => {
      const status = await syncQueuedSignIn<PublicSignInPayload>({
        storageKey: queueStorageKey,
        submit: submitPayload,
      });

      if (status === "synced" || status === "missing" || status === "invalid") {
        setPendingQueueMessage(null);
      }
    });
  };

  useEffect(() => {
    if (!isOnline || step === "success") return;
    if (!hasQueuedSignIn(queueStorageKey)) return;
    syncQueuedSubmission();
  }, [isOnline, queueStorageKey, step]);

  const handleDetailsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setMissingRequiredQuestionIds([]);

    const formData = new FormData(e.currentTarget);
    const nextDetails: VisitorDetails = {
      ...details,
      visitorName: String(formData.get("visitorName") ?? "").trim(),
      visitorPhone: String(formData.get("visitorPhone") ?? "").trim(),
      visitorEmail: String(formData.get("visitorEmail") ?? "").trim(),
      employerName: String(formData.get("employerName") ?? "").trim(),
      roleOnSite: String(formData.get("roleOnSite") ?? "").trim(),
      visitorType:
        (formData.get("visitorType") as VisitorDetails["visitorType"] | null) ??
        details.visitorType,
      hostRecipientId: String(formData.get("hostRecipientId") ?? "").trim(),
    };

    if (!nextDetails.visitorName) {
      setFieldErrors({ visitorName: ["Name is required"] });
      return;
    }

    if (!nextDetails.visitorPhone) {
      setFieldErrors({ visitorPhone: ["Phone number is required"] });
      return;
    }

    if (!isValidPhoneE164(nextDetails.visitorPhone, "NZ")) {
      setFieldErrors({
        visitorPhone: ["Please enter a valid NZ phone number"],
      });
      return;
    }

    const formatted = formatToE164(nextDetails.visitorPhone, "NZ");
    if (!formatted) {
      setFieldErrors({
        visitorPhone: ["Please enter a valid NZ phone number"],
      });
      return;
    }
    if (geofenceEnforcementEnabled && geofencePolicy?.mode === "DENY") {
      if (geofenceLocationMissingAndRequired) {
        setError(
          "This site requires location capture before sign-in can continue.",
        );
        return;
      }
      if (geofenceOutsideRadius) {
        setError(
          "You are currently outside the allowed site radius and cannot continue.",
        );
        return;
      }
    }

    updateDetails({
      visitorName: nextDetails.visitorName,
      visitorPhone: formatted,
      visitorEmail: nextDetails.visitorEmail,
      employerName: nextDetails.employerName,
      visitorType: nextDetails.visitorType,
      roleOnSite: nextDetails.roleOnSite,
      hostRecipientId: nextDetails.hostRecipientId,
    });
    const canFastPassDirectToSignature =
      lastVisitMatchesCurrentInduction &&
      expressMode &&
      !mediaConfig.enabled &&
      visibleQuestions.length === 0;
    setStep(canFastPassDirectToSignature ? "signature" : "induction");
  };

  const captureLocation = () => {
    if (!locationAuditEnabled) {
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationError("Location services are not available on this device.");
      return;
    }

    setIsCapturingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsCapturingLocation(false);
        setCapturedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : undefined,
          capturedAt: new Date().toISOString(),
        });
      },
      (error) => {
        setIsCapturingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission denied. You can continue without it.");
          return;
        }
        setLocationError("Unable to capture location. You can continue without it.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleInductionSubmit = () => {
    if (mediaAcknowledgementRequired && !mediaAcknowledged) {
      setFieldErrors((prev) => ({
        ...prev,
        mediaAcknowledged: [
          "Please confirm you reviewed the induction material before continuing.",
        ],
      }));
      setError("Please review and acknowledge the induction media.");
      return;
    }

    const missing = getMissingRequiredQuestionIds(visibleQuestions, answers);
    setMissingRequiredQuestionIds(missing);

    if (missing.length > 0) {
      setFieldErrors({
        answers: ["Please answer all required questions before continuing."],
      });
      setError("Please complete required induction questions.");
      return;
    }

    setFieldErrors((prev) => ({ ...prev, answers: [] }));
    setError(null);
    setStep("signature");
  };

  const handleAnswerChange = (questionId: string, answer: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (missingRequiredQuestionIds.includes(questionId)) {
      setMissingRequiredQuestionIds((prev) => prev.filter((id) => id !== questionId));
    }
    if (fieldErrors.answers && fieldErrors.answers.length > 0) {
      setFieldErrors((prev) => ({ ...prev, answers: [] }));
    }
  };

  const handleIdentityImageSelect = async (
    kind: "photo" | "id",
    fileList: FileList | null,
  ) => {
    const file = fileList?.[0];
    if (!file) return;

    if (file.size > MAX_IDENTITY_EVIDENCE_BYTES) {
      const message = "Image is too large. Max upload size is 2MB.";
      setError(message);
      setFieldErrors((prev) => ({
        ...prev,
        [kind === "photo" ? "visitorPhotoDataUrl" : "visitorIdDataUrl"]: [message],
      }));
      return;
    }

    try {
      const encoded = await fileToImageDataUrl(file);
      if (kind === "photo") {
        setVisitorPhotoDataUrl(encoded);
      } else {
        setVisitorIdDataUrl(encoded);
      }
      setError(null);
      setFieldErrors((prev) => ({
        ...prev,
        [kind === "photo" ? "visitorPhotoDataUrl" : "visitorIdDataUrl"]: [],
      }));
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to process selected image.";
      setError(message);
      setFieldErrors((prev) => ({
        ...prev,
        [kind === "photo" ? "visitorPhotoDataUrl" : "visitorIdDataUrl"]: [message],
      }));
    }
  };

  const handleSignatureSubmit = () => {
    if (!details.hasAcceptedTerms) {
      setFieldErrors({ hasAcceptedTerms: ["You must accept the terms"] });
      return;
    }

    const savedSignatureData =
      reuseSavedSignature && lastVisitSnapshot?.signatureData
        ? lastVisitSnapshot.signatureData
        : undefined;
    const isCanvasEmpty = sigCanvas.current?.isEmpty() ?? true;

    if (!savedSignatureData && isCanvasEmpty) {
      setError("Please provide a signature");
      return;
    }
    if (
      geofenceNeedsOverride &&
      geofencePolicy?.requiresOverrideCode &&
      geofenceOverrideCode.trim().length === 0
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        geofenceOverrideCode: [
          "Supervisor override code is required for this geofence policy.",
        ],
      }));
      setError("Please provide the supervisor geofence override code.");
      return;
    }

    if (identityPhotoRequired && !visitorPhotoDataUrl) {
      setFieldErrors((prev) => ({
        ...prev,
        visitorPhotoDataUrl: ["Visitor photo is required for this site."],
      }));
      setError("Please capture a visitor photo before signing off.");
      return;
    }

    if (identityIdRequired && !visitorIdDataUrl) {
      setFieldErrors((prev) => ({
        ...prev,
        visitorIdDataUrl: ["Visitor ID image is required for this site."],
      }));
      setError("Please upload a visitor ID image before signing off.");
      return;
    }

    if (identityConsentRequired && !identityConsentAccepted) {
      setFieldErrors((prev) => ({
        ...prev,
        identityConsentAccepted: [
          "Identity evidence consent is required for this site.",
        ],
      }));
      setError("Please confirm identity evidence consent to continue.");
      return;
    }

    const signatureData =
      savedSignatureData ?? sigCanvas.current?.toDataURL("image/png");
    const payload = {
      slug,
      visitorName: details.visitorName,
      visitorPhone: details.visitorPhone,
      visitorEmail: details.visitorEmail || undefined,
      employerName: details.employerName || undefined,
      visitorType: details.visitorType,
      roleOnSite: details.roleOnSite || undefined,
      hostRecipientId: details.hostRecipientId || undefined,
      hasAcceptedTerms: details.hasAcceptedTerms,
      answers: Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
      signatureData,
      visitorPhotoDataUrl: identityEvidenceEnabled ? visitorPhotoDataUrl : undefined,
      visitorIdDataUrl: identityEvidenceEnabled ? visitorIdDataUrl : undefined,
      visitorIdType:
        identityEvidenceEnabled && visitorIdDataUrl
          ? visitorIdType.trim() || undefined
          : undefined,
      identityConsentAccepted: identityEvidenceEnabled
        ? identityConsentAccepted
        : undefined,
      location: capturedLocation ?? undefined,
      inviteToken: prefillInvite?.token,
      languageCode: selectedLanguageCode,
      mediaAcknowledged: mediaConfig.enabled ? mediaAcknowledged : undefined,
      geofenceOverrideCode: geofenceOverrideCode.trim() || undefined,
      idempotencyKey,
    } as unknown as PublicSignInPayload;

    setError(null);
    setFieldErrors({});
    setMissingRequiredQuestionIds([]);

    if (!isOnline) {
      if (
        identityEvidenceEnabled &&
        (visitorPhotoDataUrl || visitorIdDataUrl || identityPhotoRequired || identityIdRequired)
      ) {
        setError(
          "Identity evidence sign-ins require a live connection and cannot be queued offline.",
        );
        return;
      }
      queuePayloadForSync(payload);
      return;
    }

    startTransition(async () => {
      await submitPayload(payload);
    });
  };

  if (step === "success" && signInResult) {
    return <SuccessScreen slug={slug} result={signInResult} />;
  }
  const currentStep = step === "success" ? "signature" : step;
  const currentStepMeta = STEP_META[currentStep];
  const currentStepNumber = currentStepMeta.index;
  const currentStepLabel = currentStepMeta.label;
  const currentStepIndex = SIGN_IN_STEPS.indexOf(currentStep);
  const statusPills = [
    prefillInvite ? "Invite loaded" : null,
    lastVisitSnapshot ? "Fast pass available" : null,
    lastVisitSnapshot && lastVisitMatchesCurrentInduction
      ? "Induction unchanged"
      : null,
    lastVisitSnapshot && !lastVisitMatchesCurrentInduction
      ? "Review updates required"
      : null,
    locationAuditEnabled ? "Location audit active" : null,
    !isOnline ? "Offline queue ready" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div
      className="surface-panel-strong overflow-hidden"
      role="region"
      aria-label="Sign-In Form"
    >
      <div className="border-b border-surface-soft bg-surface-soft px-4 py-3 backdrop-blur-xl">
        {!isOnline && (
          <div className="mb-3 rounded-lg border border-amber-400/45 bg-amber-100/75 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/45 dark:text-amber-100">
            You are offline. We can save this sign-in and sync when connection returns.
          </div>
        )}

        {pendingQueueMessage && (
          <div className="mb-3 rounded-lg border border-cyan-400/45 bg-cyan-100/70 px-3 py-2 text-sm text-cyan-950 dark:bg-cyan-950/45 dark:text-cyan-100">
            {pendingQueueMessage}
            {isOnline && (
              <button
                type="button"
                onClick={syncQueuedSubmission}
                className="ml-2 font-semibold text-cyan-800 underline dark:text-cyan-100"
              >
                Sync now
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
              Site clearance | Step {currentStepNumber} of 3 | {currentStepLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-[color:var(--text-primary)]">
                {currentStepMeta.title}
              </h2>
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/12 px-3 py-1 text-xs font-semibold text-indigo-950 dark:text-indigo-100">
                {currentStepMeta.eta}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-secondary">
              {currentStepMeta.description}
            </p>
            {statusPills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {statusPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-1 text-xs font-semibold text-secondary"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
              Clearance path
            </p>
            <ul className="mt-3 space-y-2">
              {SIGN_IN_STEPS.map((stepName, index) => {
                const status =
                  index < currentStepIndex
                    ? "complete"
                    : index === currentStepIndex
                      ? "active"
                      : "upcoming";

                return (
                  <li key={stepName} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        status === "complete"
                          ? "bg-emerald-500 text-white"
                          : status === "active"
                            ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white"
                            : "bg-surface-soft text-secondary"
                      }`}
                    >
                      {status === "complete" ? "OK" : index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {STEP_META[stepName].shortLabel}
                      </p>
                      <p className="text-xs text-secondary">{STEP_META[stepName].label}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {SIGN_IN_STEPS.map((stepName, index) => (
            <div key={stepName} className="flex flex-1 items-center gap-2">
              <div
                className={`h-2 flex-1 rounded-full transition-all ${
                  index <= currentStepIndex
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-500"
                    : "bg-surface-strong"
                }`}
              />
              {index < SIGN_IN_STEPS.length - 1 && (
                <div className="h-2 w-4 rounded-full bg-transparent" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="border-b border-red-400/45 bg-red-100/70 px-4 py-3 dark:bg-red-950/45">
          <p className="text-sm font-semibold text-red-950 dark:text-red-100">{error}</p>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-4 p-4">
          <div className="kinetic-hover">
            <h2 className="kinetic-title mb-1 text-xl font-black">Welcome to {site.name}</h2>
            {site.address && <p className="text-sm text-secondary">{site.address}</p>}
          </div>

          <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                Fastest path to site access
              </p>
              <ul className="mt-3 space-y-2 text-sm text-secondary">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-900 dark:text-indigo-100">
                    1
                  </span>
                  <span>Confirm your identity and contact details.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-900 dark:text-indigo-100">
                    2
                  </span>
                  <span>Review induction content and answer any required questions.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-900 dark:text-indigo-100">
                    3
                  </span>
                  <span>Sign once to become active on site.</span>
                </li>
              </ul>
              {prefillInvite && (
                <div className="mt-3 rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-3 py-2">
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Pre-registration loaded
                  </p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                    We already loaded invite details for this visit. Review and continue.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-950 dark:text-emerald-100">
                Repeat visitor
              </p>
              {lastVisitSnapshot ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Fast pass available on this device
                  </p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                    Last used {new Date(lastVisitSnapshot.savedAt).toLocaleString("en-NZ")}.
                    Reuse your saved details now, then move into the shortest valid clearance path.
                  </p>
                  <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-100">
                    {lastVisitMatchesCurrentInduction
                      ? "The induction and legal versions match your last saved visit."
                      : "This site or induction changed since your last visit, so a fresh review is required."}
                  </p>
                  <button
                    type="button"
                    onClick={applyLastVisitDetails}
                    className="btn-secondary mt-3 min-h-[44px] w-full border-emerald-400/35 bg-surface-strong px-3 py-2 text-sm text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100"
                  >
                    Use Last Visit Details
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                    Speed up your next visit
                  </p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                    We can remember your non-sensitive details on this device so repeat sign-ins take less time.
                  </p>
                </>
              )}
            </div>
          </section>

          {locationAuditEnabled && (
            <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/12 p-3">
              <p className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
                Location audit
              </p>
              <p className="mt-1 text-xs text-cyan-900 dark:text-cyan-200">
                {siteHasLocationTarget
                  ? `Capture your device location to verify if you are within the site radius (${locationAudit?.siteRadiusMeters ?? 150}m).`
                  : "Capture your device location for check-in audit records."}
              </p>
              <button
                type="button"
                onClick={captureLocation}
                disabled={isCapturingLocation}
                className="btn-secondary mt-3 min-h-[44px] border-cyan-400/40 bg-surface-strong px-3 py-2 text-sm text-cyan-900 hover:bg-cyan-100 disabled:opacity-60"
              >
                {isCapturingLocation
                  ? "Capturing location..."
                  : capturedLocation
                    ? "Refresh location"
                    : "Capture location"}
              </button>
              {capturedLocation && (
                <p className="mt-2 text-xs text-cyan-900 dark:text-cyan-200">
                  Location captured at{" "}
                  {new Date(capturedLocation.capturedAt).toLocaleTimeString("en-NZ")}
                  {capturedLocation.accuracyMeters !== undefined && (
                    <> (accuracy approx. {Math.round(capturedLocation.accuracyMeters)}m)</>
                  )}
                </p>
              )}
              {locationDistanceMeters !== null && (
                <p className="mt-1 text-xs font-semibold text-cyan-900 dark:text-cyan-100">
                  {locationWithinRadius ? "Within" : "Outside"} site radius |{" "}
                  {Math.round(locationDistanceMeters)}m from target
                </p>
              )}
              {geofenceEnforcementEnabled && (
                <p className="mt-2 text-xs font-semibold text-cyan-900 dark:text-cyan-100">
                  Geofence policy:{" "}
                  {geofencePolicy?.mode === "DENY"
                    ? "hard deny outside radius"
                    : geofencePolicy?.mode === "OVERRIDE"
                      ? "supervisor override when outside radius"
                      : "audit only"}
                </p>
              )}
              {geofenceNeedsOverride && geofencePolicy?.requiresOverrideCode && (
                <div className="mt-3">
                  <label
                    htmlFor="geofenceOverrideCode"
                    className="block text-xs font-medium text-cyan-950 dark:text-cyan-100"
                  >
                    Supervisor geofence override code
                  </label>
                  <input
                    id="geofenceOverrideCode"
                    type="text"
                    value={geofenceOverrideCode}
                    onChange={(event) => {
                      setGeofenceOverrideCode(event.target.value);
                      if (fieldErrors.geofenceOverrideCode) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          geofenceOverrideCode: [],
                        }));
                      }
                    }}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.geofenceOverrideCode?.length ? "border-red-400" : "border-cyan-300/40"} bg-surface-strong text-[color:var(--text-primary)]`}
                    placeholder="Enter supervisor code"
                  />
                  {fieldErrors.geofenceOverrideCode?.[0] && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                      {fieldErrors.geofenceOverrideCode[0]}
                    </p>
                  )}
                </div>
              )}
              {locationError && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-200">{locationError}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="visitorName" className="label mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorName"
              name="visitorName"
              type="text"
              value={details.visitorName}
              autoComplete={isKiosk ? "off" : "name"}
              onChange={(e) => updateDetails({ visitorName: e.target.value })}
              className={`input text-base ${fieldErrors.visitorName ? "border-red-500" : ""}`}
              placeholder="Enter your full name"
            />
            {fieldErrors.visitorName && (
              <p className="mt-1 text-sm text-red-700 dark:text-red-200">
                {fieldErrors.visitorName[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="visitorPhone" className="label mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorPhone"
              name="visitorPhone"
              type="tel"
              value={details.visitorPhone}
              autoComplete={isKiosk ? "off" : "tel"}
              onChange={(e) => updateDetails({ visitorPhone: e.target.value })}
              className={`input text-base ${fieldErrors.visitorPhone ? "border-red-500" : ""}`}
              placeholder="021 123 4567"
            />
            {fieldErrors.visitorPhone && (
              <p className="mt-1 text-sm text-red-700 dark:text-red-200">
                {fieldErrors.visitorPhone[0]}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/12 p-3">
            <label className="flex items-start gap-3 text-sm text-indigo-950 dark:text-indigo-100">
              <input
                type="checkbox"
                checked={expressMode}
                onChange={(e) => setExpressMode(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="font-semibold">Express mode</span>
                <span className="mt-1 block text-xs text-indigo-900/80 dark:text-indigo-200">
                  Show only the essential fields for the quickest possible sign-in.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-surface-soft bg-surface-soft p-3">
            <label className="flex items-start gap-3 text-sm text-secondary">
              <input
                type="checkbox"
                checked={rememberDetails}
                onChange={(e) => setRememberDetails(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-[color:var(--border-soft)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Remember my details on this device for faster future sign-ins.
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="visitorType" className="label mb-1">
              Visitor Type <span className="text-red-500">*</span>
            </label>
            <select
              id="visitorType"
              name="visitorType"
              value={details.visitorType}
              onChange={(e) =>
                updateDetails({
                  visitorType: e.target.value as VisitorDetails["visitorType"],
                })
              }
              className="input text-base"
            >
              <option value="CONTRACTOR">Contractor</option>
              <option value="VISITOR">Visitor</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </div>

          {hostRecipients.length > 0 && (
            <div>
              <label htmlFor="hostRecipientId" className="label mb-1">
                Notify Host (optional)
              </label>
              <select
                id="hostRecipientId"
                name="hostRecipientId"
                value={details.hostRecipientId}
                onChange={(e) =>
                  updateDetails({
                    hostRecipientId: e.target.value,
                  })
                }
                className="input text-base"
              >
                <option value="">All site managers</option>
                {hostRecipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!expressMode && (
            <>
              <div>
                <label htmlFor="visitorEmail" className="label mb-1">
                  Email (optional)
                </label>
                <input
                  id="visitorEmail"
                  name="visitorEmail"
                  type="email"
                  value={details.visitorEmail}
                  autoComplete={isKiosk ? "off" : "email"}
                  onChange={(e) => updateDetails({ visitorEmail: e.target.value })}
                  className="input text-base"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="employerName" className="label mb-1">
                  Company / Employer
                </label>
                <input
                  id="employerName"
                  name="employerName"
                  type="text"
                  value={details.employerName}
                  onChange={(e) => updateDetails({ employerName: e.target.value })}
                  className="input text-base"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label htmlFor="roleOnSite" className="label mb-1">
                  Role on Site (optional)
                </label>
                <input
                  id="roleOnSite"
                  name="roleOnSite"
                  type="text"
                  value={details.roleOnSite}
                  onChange={(e) => updateDetails({ roleOnSite: e.target.value })}
                  className="input text-base"
                  placeholder="e.g., Electrician, Delivery driver"
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary min-h-[48px] w-full text-base font-semibold">
            Review Site Induction -&gt;
          </button>
        </form>
      )}

      {step === "induction" && (
        <div className="p-4">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Back to details
            </button>
          </div>

          {lastVisitSnapshot && (
            <section
              className={`mb-5 rounded-xl border p-4 ${
                lastVisitMatchesCurrentInduction
                  ? "border-emerald-400/35 bg-emerald-500/12"
                  : "border-amber-400/35 bg-amber-500/12"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-[0.1em] ${
                  lastVisitMatchesCurrentInduction
                    ? "text-emerald-950 dark:text-emerald-100"
                    : "text-amber-900 dark:text-amber-100"
                }`}
              >
                Repeat visit review
              </p>
              <p className="mt-2 text-sm text-secondary">
                {lastVisitMatchesCurrentInduction
                  ? `No induction or legal-version changes were detected since ${new Date(
                      lastVisitSnapshot.savedAt,
                    ).toLocaleString("en-NZ")}. Review only current site conditions and continue.`
                  : "Induction content or legal terms changed since your last saved visit. Review the current material in full before clearance."}
              </p>
            </section>
          )}

          <section className="mb-5 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                Review
              </p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                Read the site induction material carefully.
              </p>
              <p className="mt-1 text-xs text-secondary">
                Emergency contacts, procedures, and attached media are all part of clearance.
              </p>
            </article>
            <article className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                Confirm
              </p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                Complete every required question before continuing.
              </p>
              <p className="mt-1 text-xs text-secondary">
                We only ask for the checks needed to clear this visit.
              </p>
            </article>
            <article className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-950 dark:text-indigo-100">
                Next
              </p>
              <p className="mt-2 text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                Sign once at the end to activate your site access record.
              </p>
              <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
                This is the last step before you are visible as on site.
              </p>
            </article>
          </section>

          {(emergencyContacts.length > 0 || emergencyProcedures.length > 0) && (
            <section className="mb-5 rounded-xl border border-red-400/35 bg-gradient-to-b from-red-500/12 to-transparent p-4">
              <h3 className="text-base font-semibold text-red-950 dark:text-red-100">
                Emergency Information
              </h3>
              <p className="mt-1 text-xs text-red-900 dark:text-red-200">
                In immediate danger call <span className="font-semibold">111</span>. Use the cards below for site emergency contacts.
              </p>
              {emergencyContacts.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-red-950 dark:text-red-100">
                    Emergency Contacts
                  </p>
                  <div className="mt-2 grid gap-2">
                    {emergencyContacts.map((contact) => (
                      <article
                        key={contact.id}
                        className="rounded-lg border border-red-400/30 bg-surface-soft p-3 shadow-soft dark:bg-red-950/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                              {contact.name}
                            </p>
                            <p className="text-xs text-secondary">
                              {contact.role ?? "Emergency contact"} | {contact.phone}
                            </p>
                            {contact.notes && (
                              <p className="mt-1 text-xs text-muted">{contact.notes}</p>
                            )}
                          </div>
                          <a
                            href={toTelHref(contact.phone)}
                            className="inline-flex min-h-[40px] items-center rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Call
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {emergencyProcedures.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-red-950 dark:text-red-100">
                    Emergency Procedures
                  </p>
                  <div className="mt-2 space-y-2">
                    {emergencyProcedures.map((procedure, index) => (
                      <article
                        key={procedure.id}
                        className="rounded-lg border border-red-300/35 bg-surface-soft p-3 dark:bg-red-950/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                              {procedure.title}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-secondary">
                              {procedure.instructions}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {languageSelectionEnabled && (
            <section className="mb-5 rounded-xl border border-cyan-400/35 bg-cyan-500/12 p-4">
              <h3 className="text-base font-semibold text-cyan-950 dark:text-cyan-100">
                Language
              </h3>
              <p className="mt-1 text-xs text-cyan-900 dark:text-cyan-200">
                Choose your preferred language for induction content.
              </p>
              <label className="mt-3 block text-sm text-cyan-950 dark:text-cyan-100">
                Induction language
                <select
                  value={selectedLanguageCode}
                  onChange={(event) => setSelectedLanguageCode(event.target.value)}
                  className="input mt-1 text-base"
                >
                  {languageChoices.map((choice) => (
                    <option key={choice.code} value={choice.code}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <section className="mb-5 rounded-xl border border-surface-soft bg-surface-soft p-4">
            <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
              {localizedTemplateName}
            </h3>
            {localizedTemplateDescription && (
              <p className="mt-1 text-sm text-secondary">
                {localizedTemplateDescription}
              </p>
            )}
          </section>

          {mediaConfig.enabled && mediaConfig.blocks.length > 0 && (
            <section className="mt-6 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
              <h3 className="text-base font-semibold text-indigo-950 dark:text-indigo-100">
                Induction Material
              </h3>
              <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
                Review the content below before confirming your induction.
              </p>

              <div className="mt-3 space-y-3">
                {mediaConfig.blocks.map((block) => (
                  <article
                    key={block.id}
                    className="rounded-lg border border-indigo-300/35 bg-surface-strong p-3 shadow-soft"
                  >
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {block.title}
                    </p>

                    {block.type === "TEXT" && block.body && (
                      <p className="mt-2 text-sm leading-relaxed text-secondary">
                        {block.body}
                      </p>
                    )}

                    {block.type === "PDF" && block.url && (
                      <div className="mt-2 space-y-2">
                        <iframe
                          src={block.url}
                          title={block.title}
                          className="h-64 w-full rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]"
                        />
                        <a
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Open PDF in new tab
                        </a>
                      </div>
                    )}

                    {block.type === "IMAGE" && block.url && (
                      <div className="mt-2 space-y-2">
                        <img
                          src={block.url}
                          alt={block.title}
                          className="max-h-80 w-full rounded-md border border-[color:var(--border-soft)] object-contain bg-[color:var(--bg-surface)]"
                          loading="lazy"
                        />
                        <a
                          href={block.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[40px] items-center rounded-md border border-indigo-300 bg-[color:var(--bg-surface)] px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
                        >
                          Open image
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {mediaAcknowledgementRequired && (
                <div className="mt-4 rounded-lg border border-indigo-300/35 bg-surface-soft p-3">
                  <label className="flex items-start gap-2 text-sm text-indigo-950">
                    <input
                      type="checkbox"
                      checked={mediaAcknowledged}
                      onChange={(event) => {
                        setMediaAcknowledged(event.target.checked);
                        if (fieldErrors.mediaAcknowledged) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            mediaAcknowledged: [],
                          }));
                        }
                      }}
                      className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{mediaAcknowledgementLabel}</span>
                  </label>
                  {fieldErrors.mediaAcknowledged?.[0] && (
                    <p className="mt-1 text-xs text-red-700">
                      {fieldErrors.mediaAcknowledged[0]}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          <InductionQuestions
            template={visibleTemplateForInduction}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            fieldErrors={fieldErrors}
            missingRequiredQuestionIds={missingRequiredQuestionIds}
            localizedOptionLabels={localizedOptionLabels}
          />

          <button
            type="button"
            onClick={handleInductionSubmit}
            className="btn-primary mt-6 min-h-[48px] w-full text-base font-semibold"
          >
            Proceed to Final Clearance -&gt;
          </button>
        </div>
      )}

      {step === "signature" && (
        <div className="space-y-4 p-4">
          <div className="kinetic-hover">
            <h2 className="kinetic-title text-xl font-black">Sign Off</h2>
            <p className="text-sm text-secondary">
              You are one signature away from being cleared and visible on site.
            </p>
            {lastVisitSnapshot && lastVisitMatchesCurrentInduction && (
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                Repeat visit fast pass: your last accepted induction still matches the current site version.
              </p>
            )}
            {site.legal && (
              <p className="mt-1 text-xs text-muted">
                Consent record: Terms v{site.legal.termsVersion}, Privacy v
                {site.legal.privacyVersion}
              </p>
            )}
          </div>

          <section className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-950 dark:text-emerald-100">
              Final clearance check
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-400/25 bg-[color:var(--bg-surface)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Identity
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                  Details confirmed
                </p>
              </div>
              <div className="rounded-lg border border-emerald-400/25 bg-[color:var(--bg-surface)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Induction
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                  Review complete
                </p>
              </div>
              <div className="rounded-lg border border-indigo-400/25 bg-[color:var(--bg-surface)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Remaining action
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                  Capture your signature
                </p>
              </div>
            </div>
          </section>

          {lastVisitSnapshot?.signatureData && (
            <label className="flex min-h-[48px] items-start gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/12 p-3 text-sm text-indigo-950 dark:text-indigo-100">
              <input
                type="checkbox"
                checked={reuseSavedSignature}
                onChange={(e) => setReuseSavedSignature(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Use my previously saved signature for this visit.</span>
            </label>
          )}

          <div className="rounded-lg border-2 border-surface-soft bg-surface-soft">
            {SignatureCanvasComponent ? (
              <SignatureCanvasComponent
                ref={sigCanvas}
                penColor="black"
                onBegin={() => {
                  setError(null);
                }}
                canvasProps={{
                  id: "signature-canvas",
                  className: `sigCanvas h-40 w-full touch-none rounded-lg ${
                    reuseSavedSignature ? "opacity-40" : ""
                  }`,
                }}
              />
            ) : (
              <div className="h-40 w-full animate-pulse rounded-lg bg-surface-strong" />
            )}
          </div>

          <label className="flex min-h-[48px] items-start gap-2 rounded-lg border border-surface-soft bg-surface-soft p-3 text-sm text-secondary">
            <input
              type="checkbox"
              checked={rememberSignature}
              onChange={(e) => setRememberSignature(e.target.checked)}
              disabled={Boolean(isKiosk)}
              className="mt-0.5 h-5 w-5 rounded border-[color:var(--border-soft)] text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              Save my signature on this device for faster repeat sign-ins.
              <span className="mt-1 block text-xs text-amber-700">
                Shared device? Leave this off to protect your signature.
              </span>
            </span>
          </label>

          {isKiosk && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Kiosk mode detected: signature saving is disabled for shared-device safety.
            </div>
          )}

          {identityEvidenceEnabled && (
            <section className="rounded-lg border border-indigo-300/35 bg-indigo-500/10 p-3">
              <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                Visitor Identity Evidence
              </h3>
              <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
                Uploads are encrypted and only visible to authorized site management.
              </p>
              {identityOcrRequired && (
                <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
                  OCR verification is enabled ({identityEvidence.ocrDecisionMode} mode).
                </p>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-indigo-950 dark:text-indigo-100">
                  Visitor photo {identityPhotoRequired ? "*" : "(optional)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="environment"
                    onChange={(event) => {
                      void handleIdentityImageSelect("photo", event.target.files);
                    }}
                    className="mt-1 block w-full rounded-md border border-indigo-200 bg-[color:var(--bg-surface)] px-2 py-2 text-xs"
                  />
                  {fieldErrors.visitorPhotoDataUrl?.[0] && (
                    <p className="mt-1 text-xs text-red-700">
                      {fieldErrors.visitorPhotoDataUrl[0]}
                    </p>
                  )}
                </label>

                <label className="text-sm text-indigo-950 dark:text-indigo-100">
                  Visitor ID image {identityIdRequired ? "*" : "(optional)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="environment"
                    onChange={(event) => {
                      void handleIdentityImageSelect("id", event.target.files);
                    }}
                    className="mt-1 block w-full rounded-md border border-indigo-200 bg-[color:var(--bg-surface)] px-2 py-2 text-xs"
                  />
                  {fieldErrors.visitorIdDataUrl?.[0] && (
                    <p className="mt-1 text-xs text-red-700">
                      {fieldErrors.visitorIdDataUrl[0]}
                    </p>
                  )}
                </label>
              </div>

              {visitorIdDataUrl && (
                <label className="mt-3 block text-sm text-indigo-950 dark:text-indigo-100">
                  ID type
                  <select
                    value={visitorIdType}
                    onChange={(event) => setVisitorIdType(event.target.value)}
                    className="input mt-1 text-sm"
                  >
                    <option value="Driver Licence">Driver Licence</option>
                    <option value="Passport">Passport</option>
                    <option value="Company ID">Company ID</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              )}
              {identityOcrRequired &&
                identityEvidence.allowedDocumentTypes.length > 0 && (
                  <p className="mt-2 text-xs text-indigo-900 dark:text-indigo-200">
                    Allowed document types:{" "}
                    {identityEvidence.allowedDocumentTypes.join(", ")}
                  </p>
                )}

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {visitorPhotoDataUrl && (
                  <div className="rounded-md border border-indigo-200 bg-[color:var(--bg-surface)] p-2">
                    <p className="text-xs font-semibold text-indigo-900">Photo preview</p>
                    <img
                      src={visitorPhotoDataUrl}
                      alt="Visitor photo preview"
                      className="mt-1 max-h-36 w-full rounded object-cover"
                    />
                  </div>
                )}
                {visitorIdDataUrl && (
                  <div className="rounded-md border border-indigo-200 bg-[color:var(--bg-surface)] p-2">
                    <p className="text-xs font-semibold text-indigo-900">ID preview</p>
                    <img
                      src={visitorIdDataUrl}
                      alt="Visitor ID preview"
                      className="mt-1 max-h-36 w-full rounded object-cover"
                    />
                  </div>
                )}
              </div>

              <label className="mt-3 flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-100">
                <input
                  type="checkbox"
                  checked={identityConsentAccepted}
                  onChange={(event) => {
                    setIdentityConsentAccepted(event.target.checked);
                    if (fieldErrors.identityConsentAccepted) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        identityConsentAccepted: [],
                      }));
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600"
                />
                <span>
                  I consent to identity image processing for site access validation and compliance audit.
                </span>
              </label>
              {fieldErrors.identityConsentAccepted?.[0] && (
                <p className="mt-1 text-xs text-red-700">
                  {fieldErrors.identityConsentAccepted[0]}
                </p>
              )}
            </section>
          )}

          <div>
            <label className="flex items-start gap-2 text-sm text-secondary">
              <input
                id="hasAcceptedTerms"
                type="checkbox"
                checked={details.hasAcceptedTerms}
                onChange={(e) =>
                  updateDetails({
                    hasAcceptedTerms: e.target.checked,
                  })
                }
                className="mt-0.5 h-5 w-5 rounded border-[color:var(--border-soft)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                {legalConsentStatement}{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  Privacy
                </a>
                .
                <span className="text-red-500"> *</span>
              </span>
            </label>
            {fieldErrors.hasAcceptedTerms && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.hasAcceptedTerms[0]}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                sigCanvas.current?.clear();
                setError(null);
              }}
              className="btn-secondary min-h-[44px] flex-1 text-base"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSignatureSubmit}
              disabled={isPending || !details.hasAcceptedTerms}
              className="btn-primary min-h-[44px] flex-[2] px-8 text-base font-semibold disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Confirm and Sign In"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep("induction")}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Back to questions
          </button>
        </div>
      )}
    </div>
  );
}

