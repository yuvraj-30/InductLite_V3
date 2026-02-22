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
      className="overflow-hidden rounded-lg bg-white shadow-lg"
      role="region"
      aria-label="Sign-In Form"
    >
      <div className="border-b bg-gray-50 px-4 py-3">
        {!isOnline && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You are offline. We can save this sign-in and sync when connection returns.
          </div>
        )}

        {pendingQueueMessage && (
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {pendingQueueMessage}
            {isOnline && (
              <button
                type="button"
                onClick={syncQueuedSubmission}
                className="ml-2 font-semibold text-blue-700 underline"
              >
                Sync now
              </button>
            )}
          </div>
        )}

        <div className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === "details" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
            }`}
          >
            {step === "details" ? "1" : "Done"}
          </div>

          <div className="mx-2 h-1 flex-1 bg-gray-200">
            <div
              className={`h-full bg-blue-600 transition-all ${
                step === "induction" || step === "signature" ? "w-full" : "w-0"
              }`}
            />
          </div>

          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === "induction"
                ? "bg-blue-600 text-white"
                : step === "signature"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
            }`}
          >
            {step === "signature" ? "Done" : "2"}
          </div>

          <div className="mx-2 h-1 flex-1 bg-gray-200">
            <div
              className={`h-full bg-blue-600 transition-all ${
                step === "signature" ? "w-full" : "w-0"
              }`}
            />
          </div>

          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              step === "signature" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            3
          </div>
        </div>

        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Your Details</span>
          <span className="ml-2">Induction</span>
          <span>Sign Off</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-900">{error}</p>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="space-y-4 p-4">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Welcome to {site.name}</h2>
            {site.address && <p className="text-sm text-gray-600">{site.address}</p>}
          </div>

          <div>
            <label htmlFor="visitorName" className="mb-1 block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorName"
              type="text"
              value={details.visitorName}
              autoComplete={isKiosk ? "off" : "name"}
              onChange={(e) => setDetails({ ...details, visitorName: e.target.value })}
              className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.visitorName ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter your full name"
            />
            {fieldErrors.visitorName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.visitorName[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="visitorPhone" className="mb-1 block text-sm font-medium text-gray-700">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorPhone"
              type="tel"
              value={details.visitorPhone}
              autoComplete={isKiosk ? "off" : "tel"}
              onChange={(e) => setDetails({ ...details, visitorPhone: e.target.value })}
              className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.visitorPhone ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="021 123 4567"
            />
            {fieldErrors.visitorPhone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.visitorPhone[0]}</p>
            )}
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <label className="flex items-start gap-3 text-sm text-blue-900">
              <input
                type="checkbox"
                checked={expressMode}
                onChange={(e) => setExpressMode(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Express Mode: show only essential fields for faster sign-in.</span>
            </label>
          </div>

          {lastVisitSnapshot && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">
                Last visit found on this device
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Saved {new Date(lastVisitSnapshot.savedAt).toLocaleString("en-NZ")}
              </p>
              <button
                type="button"
                onClick={applyLastVisitDetails}
                className="mt-2 min-h-[44px] rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Use Last Visit Details
              </button>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberDetails}
                onChange={(e) => setRememberDetails(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Remember my details on this device for faster future sign-ins.
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="visitorType" className="mb-1 block text-sm font-medium text-gray-700">
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
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
                <label
                  htmlFor="visitorEmail"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email (optional)
                </label>
                <input
                  id="visitorEmail"
                  type="email"
                  value={details.visitorEmail}
                  autoComplete={isKiosk ? "off" : "email"}
                  onChange={(e) => setDetails({ ...details, visitorEmail: e.target.value })}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="employerName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Company / Employer
                </label>
                <input
                  id="employerName"
                  type="text"
                  value={details.employerName}
                  onChange={(e) => setDetails({ ...details, employerName: e.target.value })}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label htmlFor="roleOnSite" className="mb-1 block text-sm font-medium text-gray-700">
                  Role on Site (optional)
                </label>
                <input
                  id="roleOnSite"
                  type="text"
                  value={details.roleOnSite}
                  onChange={(e) => setDetails({ ...details, roleOnSite: e.target.value })}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Electrician, Delivery driver"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="min-h-[48px] w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
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
              className="text-sm text-blue-600 hover:underline"
            >
              Back to details
            </button>
          </div>

          {(emergencyContacts.length > 0 || emergencyProcedures.length > 0) && (
            <section className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-base font-semibold text-red-900">
                Emergency Information
              </h3>
              {emergencyContacts.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-900">Emergency Contacts</p>
                  <ul className="mt-1 space-y-1 text-sm text-red-800">
                    {emergencyContacts.map((contact) => (
                      <li key={contact.id} className="rounded bg-white/70 px-2 py-1">
                        <span className="font-medium">{contact.name}</span>
                        {contact.role ? ` (${contact.role})` : ""}: {contact.phone}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {emergencyProcedures.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-900">Emergency Procedures</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-red-800">
                    {emergencyProcedures.map((procedure) => (
                      <li key={procedure.id}>
                        <span className="font-medium">{procedure.title}:</span>{" "}
                        {procedure.instructions}
                      </li>
                    ))}
                  </ol>
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
            className="mt-6 min-h-[48px] w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700"
          >
            Continue to Sign Off -&gt;
          </button>
        </div>
      )}

      {step === "signature" && (
        <div className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sign Off</h2>
            <p className="text-sm text-gray-600">
              Please sign below to confirm your induction completion.
            </p>
            {site.legal && (
              <p className="mt-1 text-xs text-gray-600">
                Consent record: Terms v{site.legal.termsVersion}, Privacy v
                {site.legal.privacyVersion}
              </p>
            )}
          </div>

          {lastVisitSnapshot?.signatureData && (
            <label className="flex min-h-[48px] items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
              <input
                type="checkbox"
                checked={reuseSavedSignature}
                onChange={(e) => setReuseSavedSignature(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Use my previously saved signature for this visit.</span>
            </label>
          )}

          <div className="rounded-lg border-2 border-gray-200 bg-gray-50">
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
              <div className="h-40 w-full animate-pulse rounded-lg bg-gray-100" />
            )}
          </div>

          <label className="flex min-h-[48px] items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={rememberSignature}
              onChange={(e) => setRememberSignature(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Save my signature on this device for faster repeat sign-ins.</span>
          </label>

          <div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
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
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                {legalConsentStatement}{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 hover:underline"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 hover:underline"
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
              className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSignatureSubmit}
              disabled={isPending || !details.hasAcceptedTerms}
              className="min-h-[44px] flex-[2] rounded-lg bg-green-600 px-8 py-2 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Confirm and Sign In"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep("induction")}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to questions
          </button>
        </div>
      )}
    </div>
  );
}
