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
import type SignatureCanvas from "react-signature-canvas";
import type { SignatureCanvasProps } from "react-signature-canvas";
import { submitSignIn, type SiteInfo, type TemplateInfo } from "../actions";
import { InductionQuestions } from "./InductionQuestions";
import { SuccessScreen } from "./SuccessScreen";
import { isValidPhoneE164, formatToE164 } from "@inductlite/shared";
import {
  clearQueuedSignIn,
  hasQueuedSignIn,
  saveQueuedSignIn,
} from "@/lib/offline/signin-queue";
import { syncQueuedSignIn } from "@/lib/offline/signin-sync";

interface SignInFlowProps {
  slug: string;
  site: SiteInfo;
  template: TemplateInfo;
  isKiosk?: boolean;
}

type Step = "details" | "induction" | "signature" | "success";

interface VisitorDetails {
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string;
  employerName: string;
  visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  roleOnSite: string;
  hasAcceptedTerms: boolean;
}

interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
}

type PublicSignInPayload = Parameters<typeof submitSignIn>[0];

interface DraftState {
  step: Exclude<Step, "success">;
  details: VisitorDetails;
  answers: Record<string, unknown>;
  expressMode: boolean;
  rememberDetails: boolean;
  rememberSignature: boolean;
  reuseSavedSignature: boolean;
  updatedAt: string;
}

interface LastVisitSnapshot {
  details: Omit<VisitorDetails, "hasAcceptedTerms">;
  signatureData?: string;
  savedAt: string;
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
  template: TemplateInfo,
  answers: Record<string, unknown>,
): string[] {
  return template.questions
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

export function SignInFlow({ slug, site, template, isKiosk }: SignInFlowProps) {
  const [step, setStep] = useState<Step>("details");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [missingRequiredQuestionIds, setMissingRequiredQuestionIds] = useState<
    string[]
  >([]);
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

  const sigCanvas = useRef<SignatureCanvas>(null);
  const [SignatureCanvasComponent, setSignatureCanvasComponent] =
    useState<ComponentClass<SignatureCanvasProps> | null>(null);

  const [details, setDetails] = useState<VisitorDetails>({
    visitorName: "",
    visitorPhone: "",
    visitorEmail: "",
    employerName: "",
    visitorType: "CONTRACTOR",
    roleOnSite: "",
    hasAcceptedTerms: false,
  });

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
  const legalConsentStatement =
    site.legal?.consentStatement ??
    "I acknowledge the site safety terms and privacy notice.";

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
        if (parsed.details) setDetails(parsed.details);
        if (parsed.answers) setAnswers(parsed.answers);
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
    if (typeof window === "undefined") return;

    if (step === "success") {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }

    const draft: DraftState = {
      step: step as Exclude<Step, "success">,
      details,
      answers,
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
    rememberDetails,
    rememberSignature,
    reuseSavedSignature,
    step,
  ]);

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
        employerName: payload.employerName ?? "",
        visitorType: payload.visitorType,
        roleOnSite: payload.roleOnSite ?? "",
      },
      signatureData,
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
    });
    return true;
  };

  const queuePayloadForSync = (payload: PublicSignInPayload) => {
    saveQueuedSignIn(queueStorageKey, payload);
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

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setMissingRequiredQuestionIds([]);

    if (!details.visitorName.trim()) {
      setFieldErrors({ visitorName: ["Name is required"] });
      return;
    }

    if (!details.visitorPhone.trim()) {
      setFieldErrors({ visitorPhone: ["Phone number is required"] });
      return;
    }

    if (!isValidPhoneE164(details.visitorPhone, "NZ")) {
      setFieldErrors({
        visitorPhone: ["Please enter a valid NZ phone number"],
      });
      return;
    }

    const formatted = formatToE164(details.visitorPhone, "NZ");
    if (!formatted) {
      setFieldErrors({
        visitorPhone: ["Please enter a valid NZ phone number"],
      });
      return;
    }

    setDetails({ ...details, visitorPhone: formatted });
    setStep("induction");
  };

  const handleInductionSubmit = () => {
    const missing = getMissingRequiredQuestionIds(template, answers);
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
      hasAcceptedTerms: details.hasAcceptedTerms,
      answers: Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
      signatureData,
      idempotencyKey,
    } as unknown as PublicSignInPayload;

    setError(null);
    setFieldErrors({});
    setMissingRequiredQuestionIds([]);

    if (!isOnline) {
      queuePayloadForSync(payload);
      return;
    }

    startTransition(async () => {
      await submitPayload(payload);
    });
  };

  if (step === "success" && signInResult) {
    return <SuccessScreen result={signInResult} />;
  }

  return (
    <div
      className="surface-panel-strong overflow-hidden"
      role="region"
      aria-label="Sign-In Form"
    >
      <div className="border-b border-white/25 bg-white/45 px-4 py-3 backdrop-blur-xl">
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

        <div className="flex items-center">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${
              step === "details"
                ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white"
                : "bg-emerald-500 text-white"
            }`}
          >
            {step === "details" ? "1" : "Done"}
          </div>

          <div className="mx-2 h-1 flex-1 rounded-full bg-white/55">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all ${
                step === "induction" || step === "signature" ? "w-full" : "w-0"
              }`}
            />
          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${
              step === "induction"
                ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white"
                : step === "signature"
                  ? "bg-emerald-500 text-white"
                  : "bg-white/55 text-secondary"
            }`}
          >
            {step === "signature" ? "Done" : "2"}
          </div>

          <div className="mx-2 h-1 flex-1 rounded-full bg-white/55">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all ${
                step === "signature" ? "w-full" : "w-0"
              }`}
            />
          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${
              step === "signature"
                ? "bg-gradient-to-br from-indigo-600 to-cyan-500 text-white"
                : "bg-white/55 text-secondary"
            }`}
          >
            3
          </div>
        </div>

        <div className="mt-2 flex justify-between text-sm font-medium text-secondary">
          <span>Your Details</span>
          <span className="ml-2">Induction</span>
          <span>Sign Off</span>
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

          <div>
            <label htmlFor="visitorName" className="label mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorName"
              type="text"
              value={details.visitorName}
              autoComplete={isKiosk ? "off" : "name"}
              onChange={(e) => setDetails({ ...details, visitorName: e.target.value })}
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
              type="tel"
              value={details.visitorPhone}
              autoComplete={isKiosk ? "off" : "tel"}
              onChange={(e) => setDetails({ ...details, visitorPhone: e.target.value })}
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
              <span>Express Mode: show only essential fields for faster sign-in.</span>
            </label>
          </div>

          {lastVisitSnapshot && (
            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-3">
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                Last visit found on this device
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                Saved {new Date(lastVisitSnapshot.savedAt).toLocaleString("en-NZ")}
              </p>
              <button
                type="button"
                onClick={applyLastVisitDetails}
                className="btn-secondary mt-2 min-h-[44px] border-emerald-400/35 bg-white/80 px-3 py-2 text-sm text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100"
              >
                Use Last Visit Details
              </button>
            </div>
          )}

          <div className="rounded-xl border border-white/35 bg-white/45 p-3">
            <label className="flex items-start gap-3 text-sm text-secondary">
              <input
                type="checkbox"
                checked={rememberDetails}
                onChange={(e) => setRememberDetails(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
              value={details.visitorType}
              onChange={(e) =>
                setDetails({
                  ...details,
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

          {!expressMode && (
            <>
              <div>
                <label htmlFor="visitorEmail" className="label mb-1">
                  Email (optional)
                </label>
                <input
                  id="visitorEmail"
                  type="email"
                  value={details.visitorEmail}
                  autoComplete={isKiosk ? "off" : "email"}
                  onChange={(e) => setDetails({ ...details, visitorEmail: e.target.value })}
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
                  type="text"
                  value={details.employerName}
                  onChange={(e) => setDetails({ ...details, employerName: e.target.value })}
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
                  type="text"
                  value={details.roleOnSite}
                  onChange={(e) => setDetails({ ...details, roleOnSite: e.target.value })}
                  className="input text-base"
                  placeholder="e.g., Electrician, Delivery driver"
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary min-h-[48px] w-full text-base font-semibold">
            Continue to Induction -&gt;
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
                        className="rounded-lg border border-red-400/30 bg-white/75 p-3 shadow-soft dark:bg-red-950/30"
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
                        className="rounded-lg border border-red-300/35 bg-white/75 p-3 dark:bg-red-950/30"
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

          <InductionQuestions
            template={template}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            fieldErrors={fieldErrors}
            missingRequiredQuestionIds={missingRequiredQuestionIds}
          />

          <button
            type="button"
            onClick={handleInductionSubmit}
            className="btn-primary mt-6 min-h-[48px] w-full text-base font-semibold"
          >
            Continue to Sign Off -&gt;
          </button>
        </div>
      )}

      {step === "signature" && (
        <div className="space-y-4 p-4">
          <div className="kinetic-hover">
            <h2 className="kinetic-title text-xl font-black">Sign Off</h2>
            <p className="text-sm text-secondary">
              Please sign below to confirm your induction completion.
            </p>
            {site.legal && (
              <p className="mt-1 text-xs text-muted">
                Consent record: Terms v{site.legal.termsVersion}, Privacy v
                {site.legal.privacyVersion}
              </p>
            )}
          </div>

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

          <div className="rounded-lg border-2 border-white/35 bg-white/45">
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
              <div className="h-40 w-full animate-pulse rounded-lg bg-white/70" />
            )}
          </div>

          <label className="flex min-h-[48px] items-start gap-2 rounded-lg border border-white/35 bg-white/45 p-3 text-sm text-secondary">
            <input
              type="checkbox"
              checked={rememberSignature}
              onChange={(e) => setRememberSignature(e.target.checked)}
              disabled={Boolean(isKiosk)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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

          <div>
            <label className="flex items-start gap-2 text-sm text-secondary">
              <input
                id="hasAcceptedTerms"
                type="checkbox"
                checked={details.hasAcceptedTerms}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    hasAcceptedTerms: e.target.checked,
                  })
                }
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
