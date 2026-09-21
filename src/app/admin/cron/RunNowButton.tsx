"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runDailyJobsNow } from "@/lib/actions/cron-actions";

export function RunNowButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  async function run() {
    setMsg(""); setError(""); setRunning(true);
    const res = await runDailyJobsNow();
    setRunning(false);
    if (res?.error) { setError(res.error); return; }
    setMsg(
      res.totalFailed
        ? `Selesai — ${res.steps} langkah, ${res.totalFailed} gagal.`
        : `Selesai — ${res.steps} langkah, tanpa kegagalan.`
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={run}
        disabled={running}
        className="px-4 py-2 bg-[#1a7a5e] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {running ? "Menjalankan…" : "Jalankan sekarang"}
      </button>
      {msg && <span className="text-sm text-[#1a7a5e] font-medium">{msg}</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
