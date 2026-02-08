"use client";

/**
 * Sign-In Flow Component
 *
 * Multi-step sign-in flow:
 * 1. Visitor details (name, phone, employer, type)
 * 2. Induction questions
 * 3. Success confirmation with sign-out link
 */

import { useState, useTransition, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { submitSignIn, type SiteInfo, type TemplateInfo } from "../actions";
import { InductionQuestions } from "./InductionQuestions";
import { SuccessScreen } from "./SuccessScreen";
import { isValidPhoneE164, formatToE164 } from "@inductlite/shared";

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
}

interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
}

export function SignInFlow({ slug, site, template, isKiosk }: SignInFlowProps) {
  const [step, setStep] = useState<Step>("details");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [details, setDetails] = useState<VisitorDetails>({
    visitorName: "",
    visitorPhone: "",
    visitorEmail: "",
    employerName: "",
    visitorType: "CONTRACTOR",
    roleOnSite: "",
  });

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [signInResult, setSignInResult] = useState<SignInResult | null>(null);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Basic validation
    if (!details.visitorName.trim()) {
      setFieldErrors({ visitorName: ["Name is required"] });
      return;
    }
    if (!details.visitorPhone.trim()) {
      setFieldErrors({ visitorPhone: ["Phone number is required"] });
      return;
    }

    // Validate E.164 / international phone number on the client and format (allow NZ local numbers)
    if (!isValidPhoneE164(details.visitorPhone, "NZ")) {
      setFieldErrors({
        visitorPhone: [
          "Invalid phone number. Use international format, e.g., +64 21 123 4567",
        ],
      });
      return;
    }

    const formatted = formatToE164(details.visitorPhone, "NZ");
    if (!formatted) {
      setFieldErrors({
        visitorPhone: [
          "Invalid phone number; could not format to international E.164",
        ],
      });
      return;
    }

    setDetails({ ...details, visitorPhone: formatted });
    setStep("induction");
  };

  const handleInductionSubmit = () => {
    setStep("signature");
  };

  const handleSignatureSubmit = () => {
    if (sigCanvas.current?.isEmpty()) {
      setError("Please provide a signature");
      return;
    }

    const signatureData = sigCanvas.current
      ?.getTrimmedCanvas()
      .toDataURL("image/png");

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await submitSignIn({
        slug,
        visitorName: details.visitorName,
        visitorPhone: details.visitorPhone,
        visitorEmail: details.visitorEmail || undefined,
        employerName: details.employerName || undefined,
        visitorType: details.visitorType,
        roleOnSite: details.roleOnSite || undefined,
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        signatureData,
      } as unknown as Parameters<typeof submitSignIn>[0]);

      if (!result.success) {
        if (
          result.error.code === "VALIDATION_ERROR" &&
          result.error.fieldErrors
        ) {
          setFieldErrors(result.error.fieldErrors);
        }
        setError(result.error.message || "Failed to sign in");
        return;
      }

      setSignInResult({
        signInRecordId: result.data.signInRecordId,
        signOutToken: result.data.signOutToken,
        signOutTokenExpiresAt: new Date(result.data.signOutTokenExpiresAt),
        visitorName: result.data.visitorName,
        siteName: result.data.siteName,
        signInTime: new Date(result.data.signInTime),
      });
      setStep("success");
    });
  };

  if (step === "success" && signInResult) {
    if (isKiosk) {
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }
    return <SuccessScreen result={signInResult} />;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Progress indicator */}
      <div className="bg-gray-50 px-4 py-3 border-b">
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === "details"
                ? "bg-blue-600 text-white"
                : "bg-green-500 text-white"
            }`}
          >
            {step === "details" ? "1" : "✓"}
          </div>
          <div className="flex-1 h-1 mx-2 bg-gray-200">
            <div
              className={`h-full bg-blue-600 transition-all ${
                step === "induction" ? "w-full" : "w-0"
              }`}
            />
          </div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === "induction"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            2
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>Your Details</span>
          <span>Induction</span>
          <span>Sign Off</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Step 1: Visitor Details */}
      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Welcome to {site.name}
            </h2>
            {site.address && (
              <p className="text-sm text-gray-500">{site.address}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="visitorName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorName"
              type="text"
              value={details.visitorName}
              autoComplete={isKiosk ? "off" : "name"}
              onChange={(e) =>
                setDetails({ ...details, visitorName: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.visitorName ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter your full name"
            />
            {fieldErrors.visitorName && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.visitorName[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="visitorPhone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="visitorPhone"
              type="tel"
              value={details.visitorPhone}
              autoComplete={isKiosk ? "off" : "tel"}
              onChange={(e) =>
                setDetails({ ...details, visitorPhone: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.visitorPhone ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="+64 21 xxx xxxx"
            />
            {fieldErrors.visitorPhone && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.visitorPhone[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="visitorEmail"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email (optional)
            </label>
            <input
              id="visitorEmail"
              type="email"
              value={details.visitorEmail}
              autoComplete={isKiosk ? "off" : "email"}
              onChange={(e) =>
                setDetails({ ...details, visitorEmail: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="employerName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Company / Employer
            </label>
            <input
              id="employerName"
              type="text"
              value={details.employerName}
              onChange={(e) =>
                setDetails({ ...details, employerName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your company name"
            />
          </div>

          <div>
            <label
              htmlFor="visitorType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="CONTRACTOR">Contractor</option>
              <option value="VISITOR">Visitor</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="roleOnSite"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Role on Site (optional)
            </label>
            <input
              id="roleOnSite"
              type="text"
              value={details.roleOnSite}
              onChange={(e) =>
                setDetails({ ...details, roleOnSite: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Electrician, Delivery driver"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Continue to Induction →
          </button>
        </form>
      )}

      {/* Step 2: Induction Questions */}
      {step === "induction" && (
        <div className="p-4">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="text-blue-600 text-sm hover:underline"
            >
              ← Back to details
            </button>
          </div>

          <InductionQuestions
            template={template}
            answers={answers}
            onAnswerChange={(questionId, answer) =>
              setAnswers({ ...answers, [questionId]: answer })
            }
            fieldErrors={fieldErrors}
          />

          <button
            type="button"
            onClick={handleInductionSubmit}
            className="w-full mt-6 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Continue to Sign Off →
          </button>
        </div>
      )}

      {/* Step 3: Digital Signature */}
      {step === "signature" && (
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sign Off</h2>
            <p className="text-sm text-gray-500">
              Please sign below to confirm your induction completion.
            </p>
          </div>

          <div className="border-2 border-gray-200 rounded-lg bg-gray-50">
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              canvasProps={{
                className: "w-full h-40 rounded-lg touch-none",
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => sigCanvas.current?.clear()}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSignatureSubmit}
              disabled={isPending}
              className="flex-2 py-2 px-8 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Signing in..." : "Confirm & Sign In ✓"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep("induction")}
            className="text-blue-600 text-sm hover:underline"
          >
            ← Back to questions
          </button>
        </div>
      )}
    </div>
  );
}
