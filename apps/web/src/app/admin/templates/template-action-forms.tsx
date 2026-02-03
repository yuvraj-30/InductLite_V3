// Server Components for template actions
import {
  publishTemplateAction,
  archiveTemplateAction,
  deleteTemplateAction,
  createNewVersionAction,
} from "./actions";
import { ConfirmActionButton } from "./ConfirmActionButton";
import SubmitButton from "./SubmitButton.client";

export function PublishTemplateForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <ConfirmActionButton
      templateName={templateName}
      confirmMessage={
        "Are you sure you want to publish '{name}'? This will make it the active version."
      }
    >
      <form
        action={async (formData) => {
          "use server";
          await publishTemplateAction(formData.get("templateId") as string);
        }}
      >
        <input type="hidden" name="templateId" value={templateId} />
        <SubmitButton label="Publish" loadingLabel="Publishing..." />
      </form>
    </ConfirmActionButton>
  );
}

export function ArchiveTemplateForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <ConfirmActionButton
      templateName={templateName}
      confirmMessage={
        "Are you sure you want to archive '{name}'? This will unpublish it and make it read-only."
      }
    >
      <form
        action={async (formData) => {
          "use server";
          await archiveTemplateAction(formData.get("templateId") as string);
        }}
      >
        <input type="hidden" name="templateId" value={templateId} />
        <SubmitButton label="Archive" loadingLabel="Archiving..." />
      </form>
    </ConfirmActionButton>
  );
}

export function DeleteTemplateForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <ConfirmActionButton
      templateName={templateName}
      confirmMessage={
        "Are you sure you want to delete '{name}'? This cannot be undone."
      }
    >
      <form
        action={async (formData) => {
          "use server";
          await deleteTemplateAction(formData.get("templateId") as string);
        }}
      >
        <input type="hidden" name="templateId" value={templateId} />
        <SubmitButton label="Delete" loadingLabel="Deleting..." />
      </form>
    </ConfirmActionButton>
  );
}

export function CreateVersionForm({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <ConfirmActionButton
      templateName={templateName}
      confirmMessage={
        "Create a new draft version of '{name}'? You can edit and publish it as a new version."
      }
    >
      <form
        action={async (formData) => {
          "use server";
          await createNewVersionAction(formData.get("templateId") as string);
        }}
      >
        <input type="hidden" name="templateId" value={templateId} />
        <SubmitButton label="New Version" loadingLabel="Creating..." />
      </form>
    </ConfirmActionButton>
  );
}
