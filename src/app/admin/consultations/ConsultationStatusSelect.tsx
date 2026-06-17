"use client";

import { useTransition } from "react";
import { updateConsultationStatus } from "@/lib/actions/admin-actions";

interface Props {
  consultationId: string;
  currentStatus: string;
  statusColors: Record<string, string>;
}

export function ConsultationStatusSelect({ consultationId, currentStatus, statusColors }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending}
      onChange={(e) => {
        const val = e.target.value;
        startTransition(async () => { await updateConsultationStatus(consultationId, val); });
      }}
      className={`px-3 py-1 rounded-full text-xs font-bold border-0 cursor-pointer disabled:opacity-60 ${statusColors[currentStatus] ?? "bg-[#f6f3f2] text-[#3e4944]"}`}
    >
      {["pending_payment", "paid", "scheduled", "completed", "cancelled"].map((s) => (
        <option key={s} value={s} className="bg-white text-[#1b1c1c]">{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}
