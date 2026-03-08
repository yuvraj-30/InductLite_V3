import type { Prisma, SafetyFormType } from "@prisma/client";

export interface DefaultSafetyFormTemplate {
  formType: SafetyFormType;
  name: string;
  description: string;
  fieldSchema: Prisma.InputJsonValue;
}

export const DEFAULT_SAFETY_FORM_TEMPLATES: DefaultSafetyFormTemplate[] = [
  {
    formType: "SWMS",
    name: "SWMS - Safe Work Method Statement",
    description:
      "Capture high-risk task method statements, hazards, controls, and sign-off.",
    fieldSchema: {
      version: 1,
      fields: [
        { key: "taskScope", label: "Task scope", type: "textarea", required: true },
        { key: "location", label: "Work location", type: "text", required: true },
        { key: "hazards", label: "Hazards identified", type: "textarea", required: true },
        { key: "controls", label: "Control measures", type: "textarea", required: true },
        { key: "ppe", label: "Required PPE", type: "text", required: true },
        { key: "approvedBy", label: "Supervisor approval", type: "text", required: true },
      ],
    },
  },
  {
    formType: "JSA",
    name: "JSA - Job Safety Analysis",
    description:
      "Break task steps into risks and controls before work starts.",
    fieldSchema: {
      version: 1,
      fields: [
        { key: "jobStep", label: "Job steps", type: "textarea", required: true },
        {
          key: "stepRiskAssessment",
          label: "Risk per step",
          type: "textarea",
          required: true,
        },
        {
          key: "controlActions",
          label: "Control actions",
          type: "textarea",
          required: true,
        },
        {
          key: "environmentalFactors",
          label: "Environmental factors",
          type: "textarea",
          required: false,
        },
      ],
    },
  },
  {
    formType: "RAMS",
    name: "RAMS - Risk Assessment Method Statement",
    description:
      "Capture method statement plus residual risk and permit dependencies.",
    fieldSchema: {
      version: 1,
      fields: [
        {
          key: "activityDescription",
          label: "Activity description",
          type: "textarea",
          required: true,
        },
        {
          key: "initialRisk",
          label: "Initial risk rating",
          type: "select",
          options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          required: true,
        },
        {
          key: "residualRisk",
          label: "Residual risk rating",
          type: "select",
          options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          required: true,
        },
        {
          key: "permitDependencies",
          label: "Linked permits",
          type: "text",
          required: false,
        },
      ],
    },
  },
  {
    formType: "TOOLBOX_TALK",
    name: "Toolbox Talk Record",
    description:
      "Record daily/weekly toolbox briefings, attendees, and action items.",
    fieldSchema: {
      version: 1,
      fields: [
        { key: "topic", label: "Talk topic", type: "text", required: true },
        { key: "facilitator", label: "Facilitator", type: "text", required: true },
        { key: "attendees", label: "Attendees", type: "textarea", required: true },
        {
          key: "actionItems",
          label: "Action items",
          type: "textarea",
          required: false,
        },
      ],
    },
  },
  {
    formType: "FATIGUE_DECLARATION",
    name: "Fatigue Declaration",
    description:
      "Capture fatigue self-assessment before worker site entry.",
    fieldSchema: {
      version: 1,
      fields: [
        { key: "hoursWorked24", label: "Hours worked (24h)", type: "number", required: true },
        { key: "sleepHours", label: "Sleep in last 24h", type: "number", required: true },
        {
          key: "fitForDuty",
          label: "Fit for duty",
          type: "select",
          options: ["YES", "NO"],
          required: true,
        },
        {
          key: "comments",
          label: "Fatigue comments",
          type: "textarea",
          required: false,
        },
      ],
    },
  },
];

export function resolveDefaultSafetyTemplate(
  formType: SafetyFormType,
): DefaultSafetyFormTemplate | null {
  return DEFAULT_SAFETY_FORM_TEMPLATES.find(
    (template) => template.formType === formType,
  ) ?? null;
}
