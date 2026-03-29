"use client";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";

export type SignInFlowStep = "details" | "induction" | "signature";

export const SIGN_IN_STEPS: SignInFlowStep[] = [
  "details",
  "induction",
  "signature",
];

export const STEP_META: Record<
  SignInFlowStep,
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

interface SignInFlowHeaderProps {
  currentStep: SignInFlowStep;
  isOnline: boolean;
  pendingQueueMessage: string | null;
  onSyncQueuedSubmission: () => void;
  statusPills: string[];
}

interface VisitSnapshot {
  savedAt: string;
}

interface DetailsWelcomePanelsProps {
  siteName: string;
  siteAddress?: string | null;
  prefillInviteLoaded: boolean;
  lastVisitSnapshot: VisitSnapshot | null;
  lastVisitMatchesCurrentInduction: boolean;
  onApplyLastVisitDetails: () => void;
}

interface InductionOverviewPanelsProps {
  lastVisitSnapshot: VisitSnapshot | null;
  lastVisitMatchesCurrentInduction: boolean;
}

interface EmergencyContact {
  id: string;
  name: string;
  role?: string | null;
  phone: string;
  notes?: string | null;
}

interface EmergencyProcedure {
  id: string;
  title: string;
  instructions: string;
}

interface EmergencyInformationPanelProps {
  emergencyContacts: EmergencyContact[];
  emergencyProcedures: EmergencyProcedure[];
  toTelHref: (phone: string) => string;
}

interface SignatureOverviewPanelsProps {
  lastVisitSnapshot: VisitSnapshot | null;
  lastVisitMatchesCurrentInduction: boolean;
  legal?: {
    termsVersion: number;
    privacyVersion: number;
  } | null;
}

export function SignInFlowHeader({
  currentStep,
  isOnline,
  pendingQueueMessage,
  onSyncQueuedSubmission,
  statusPills,
}: SignInFlowHeaderProps) {
  const currentStepMeta = STEP_META[currentStep];
  const currentStepIndex = SIGN_IN_STEPS.indexOf(currentStep);

  return (
    <div className="border-b border-surface-soft bg-surface-soft px-4 py-3 backdrop-blur-xl">
      <div className="space-y-3">
        {!isOnline ? (
          <Alert variant="warning" title="Offline ready" className="rounded-lg px-3 py-2">
            We can save this sign-in now and sync it when your connection returns.
          </Alert>
        ) : null}

        {pendingQueueMessage ? (
          <Alert
            variant="info"
            title="Queued sign-in"
            className="rounded-lg px-3 py-2"
            action={
              isOnline ? (
                <button
                  type="button"
                  onClick={onSyncQueuedSubmission}
                  className="text-sm font-semibold text-cyan-900 underline hover:text-cyan-700 dark:text-cyan-100"
                >
                  Sync now
                </button>
              ) : null
            }
          >
            {pendingQueueMessage}
          </Alert>
        ) : null}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
            Site clearance | Step {currentStepMeta.index} of 3 | {currentStepMeta.label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-[color:var(--text-primary)]">
              {currentStepMeta.title}
            </h2>
            <StatusBadge tone="accent">{currentStepMeta.eta}</StatusBadge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-secondary">
            {currentStepMeta.description}
          </p>
          {statusPills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {statusPills.map((pill) => (
                <StatusBadge key={pill} tone="neutral">
                  {pill}
                </StatusBadge>
              ))}
            </div>
          ) : null}
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
                    <p className="text-xs text-secondary">
                      {STEP_META[stepName].label}
                    </p>
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
            {index < SIGN_IN_STEPS.length - 1 ? (
              <div className="h-2 w-4 rounded-full bg-transparent" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailsWelcomePanels({
  siteName,
  siteAddress,
  prefillInviteLoaded,
  lastVisitSnapshot,
  lastVisitMatchesCurrentInduction,
  onApplyLastVisitDetails,
}: DetailsWelcomePanelsProps) {
  return (
    <>
      <div className="kinetic-hover">
        <h2 className="kinetic-title mb-1 text-xl font-black">Welcome to {siteName}</h2>
        {siteAddress ? <p className="text-sm text-secondary">{siteAddress}</p> : null}
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
          {prefillInviteLoaded ? (
            <div className="mt-3 rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-3 py-2">
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                Pre-registration loaded
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                We already loaded invite details for this visit. Review and continue.
              </p>
            </div>
          ) : null}
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
                Reuse your saved details now, then move into the shortest valid
                clearance path.
              </p>
              <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-100">
                {lastVisitMatchesCurrentInduction
                  ? "The induction and legal versions match your last saved visit."
                  : "This site or induction changed since your last visit, so a fresh review is required."}
              </p>
              <button
                type="button"
                onClick={onApplyLastVisitDetails}
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
                We can remember your non-sensitive details on this device so
                repeat sign-ins take less time.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}

export function InductionOverviewPanels({
  lastVisitSnapshot,
  lastVisitMatchesCurrentInduction,
}: InductionOverviewPanelsProps) {
  return (
    <>
      {lastVisitSnapshot ? (
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
      ) : null}

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
    </>
  );
}

export function EmergencyInformationPanel({
  emergencyContacts,
  emergencyProcedures,
  toTelHref,
}: EmergencyInformationPanelProps) {
  if (emergencyContacts.length === 0 && emergencyProcedures.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-red-400/35 bg-gradient-to-b from-red-500/12 to-transparent p-4">
      <h3 className="text-base font-semibold text-red-950 dark:text-red-100">
        Emergency Information
      </h3>
      <p className="mt-1 text-xs text-red-900 dark:text-red-200">
        In immediate danger call <span className="font-semibold">111</span>. Use
        the cards below for site emergency contacts.
      </p>
      {emergencyContacts.length > 0 ? (
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
                    {contact.notes ? (
                      <p className="mt-1 text-xs text-muted">{contact.notes}</p>
                    ) : null}
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
      ) : null}
      {emergencyProcedures.length > 0 ? (
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
      ) : null}
    </section>
  );
}

export function SignatureOverviewPanels({
  lastVisitSnapshot,
  lastVisitMatchesCurrentInduction,
  legal,
}: SignatureOverviewPanelsProps) {
  return (
    <>
      <div className="kinetic-hover">
        <h2 className="kinetic-title text-xl font-black">Sign Off</h2>
        <p className="text-sm text-secondary">
          You are one signature away from being cleared and visible on site.
        </p>
        {lastVisitSnapshot && lastVisitMatchesCurrentInduction ? (
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
            Repeat visit fast pass: your last accepted induction still matches the
            current site version.
          </p>
        ) : null}
        {legal ? (
          <p className="mt-1 text-xs text-muted">
            Consent record: Terms v{legal.termsVersion}, Privacy v{legal.privacyVersion}
          </p>
        ) : null}
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
    </>
  );
}
