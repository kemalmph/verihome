"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProperty } from "@/lib/actions/admin-actions";

export function DeleteButton({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm(`Delete "${propertyName}" permanently? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteProperty(propertyId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-40 transition-colors"
      title="Delete property"
    >
      {isPending ? (
        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
      ) : (
        <span className="material-symbols-outlined text-base">delete</span>
      )}
    </button>
  );
}
