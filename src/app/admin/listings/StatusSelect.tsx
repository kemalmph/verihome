"use client";

import { useTransition } from "react";
import { updatePropertyStatus } from "@/lib/actions/admin-actions";
import { PIPELINE_STAGES, statusColor, statusLabel } from "@/lib/pipeline";

export { PIPELINE_STAGES, statusColor, statusLabel };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function StatusSelect({ propertyId, currentStatus }: { propertyId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending}
      onChange={(e) => {
        const newStatus = e.target.value;
        startTransition(async () => { await updatePropertyStatus(propertyId, newStatus); });
      }}
      className={`px-3 py-1 rounded-full text-xs font-bold border-0 cursor-pointer disabled:opacity-60 ${statusColor(currentStatus)}`}
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s.value} value={s.value} className="bg-white text-[#1b1c1c]">{s.label}</option>
      ))}
    </select>
  );
}
