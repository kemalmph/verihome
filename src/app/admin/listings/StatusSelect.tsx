"use client";

import { useTransition } from "react";
import { updatePropertyStatus } from "@/lib/actions/admin-actions";

const STATUS_COLORS: Record<string, string> = {
  live: "bg-green-100 text-green-800",
  unverified: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  archived: "bg-[#f6f3f2] text-[#3e4944]",
};

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
      className={`px-3 py-1 rounded-full text-xs font-bold border-0 cursor-pointer disabled:opacity-60 ${STATUS_COLORS[currentStatus] ?? "bg-[#f6f3f2] text-[#3e4944]"}`}
    >
      {["live", "unverified", "pending", "archived"].map((s) => (
        <option key={s} value={s} className="bg-white text-[#1b1c1c]">{s}</option>
      ))}
    </select>
  );
}
