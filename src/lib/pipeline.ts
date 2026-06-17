export const PIPELINE_STAGES = [
  { value: "new_lead",          label: "New Lead",          color: "bg-blue-100 text-blue-800" },
  { value: "owner_approved",    label: "Owner Approved",    color: "bg-cyan-100 text-cyan-800" },
  { value: "survey_scheduled",  label: "Survey Scheduled",  color: "bg-orange-100 text-orange-800" },
  { value: "survey_completed",  label: "Survey Completed",  color: "bg-purple-100 text-purple-800" },
  { value: "draft",             label: "Draft",             color: "bg-yellow-100 text-yellow-800" },
  { value: "approved",          label: "Approved",          color: "bg-indigo-100 text-indigo-800" },
  { value: "live",              label: "Live",              color: "bg-green-100 text-green-800" },
  { value: "closed",            label: "Closed",            color: "bg-red-100 text-red-700" },
  { value: "archived",          label: "Archived",          color: "bg-[#f6f3f2] text-[#3e4944]" },
] as const;

export type PipelineStatus = (typeof PIPELINE_STAGES)[number]["value"];

export function statusColor(status: string) {
  return PIPELINE_STAGES.find((s) => s.value === status)?.color ?? "bg-[#f6f3f2] text-[#3e4944]";
}

export function statusLabel(status: string) {
  return PIPELINE_STAGES.find((s) => s.value === status)?.label ?? status;
}
