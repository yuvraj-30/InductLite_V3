"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import {
  createEmergencyBroadcastAction,
  type CommunicationActionResult,
} from "./actions";

interface EmergencyBroadcastComposerProps {
  sites: Array<{
    id: string;
    name: string;
  }>;
  defaultSeverity?: "INFO" | "WARNING" | "CRITICAL";
  defaultChannels?: string;
  includeExpiresAt?: boolean;
  submitLabel?: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-danger">
      {pending ? "Sending..." : label}
    </button>
  );
}

export function EmergencyBroadcastComposer({
  sites,
  defaultSeverity = "WARNING",
  defaultChannels = "EMAIL,SMS",
  includeExpiresAt = false,
  submitLabel = "Send Broadcast",
}: EmergencyBroadcastComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<CommunicationActionResult | null, FormData>(
    createEmergencyBroadcastAction,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 grid gap-3 md:grid-cols-3">
      {state ? (
        <div className="md:col-span-3">
          <Alert variant={state.success ? "success" : "error"}>
            {state.success ? state.message : state.error}
          </Alert>
        </div>
      ) : null}

      <label className="text-sm text-secondary">
        Site Scope
        <select name="siteId" className="input mt-1">
          <option value="">All active attendees</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-secondary">
        Severity
        <select name="severity" className="input mt-1" defaultValue={defaultSeverity}>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </label>

      {includeExpiresAt ? (
        <label className="text-sm text-secondary">
          Expires At (optional)
          <input
            name="expiresAt"
            type="datetime-local"
            autoComplete="off"
            className="input mt-1"
          />
        </label>
      ) : (
        <label className="text-sm text-secondary">
          Channels
          <input
            name="channels"
            className="input mt-1"
            defaultValue={defaultChannels}
            placeholder="EMAIL,SMS,WEB_PUSH,TEAMS,SLACK"
            autoComplete="off"
          />
        </label>
      )}

      <label className="md:col-span-3 text-sm text-secondary">
        Message
        <textarea
          name="message"
          rows={3}
          className="input mt-1"
          placeholder="Emergency instruction for on-site workforce"
          autoComplete="off"
          required
        />
      </label>

      {includeExpiresAt ? (
        <label className="md:col-span-3 text-sm text-secondary">
          Channels (comma-separated)
          <input
            name="channels"
            className="input mt-1"
            defaultValue={defaultChannels}
            placeholder="EMAIL,SMS,WEB_PUSH,TEAMS,SLACK"
            autoComplete="off"
          />
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-secondary">
        <input
          name="requireAck"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-[color:var(--border-soft)]"
        />
        Require acknowledgement
      </label>

      <div className="md:col-span-3">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
