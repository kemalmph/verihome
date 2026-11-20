"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { postOperatingExpense, postEquityDrawing } from "@/lib/ledger/events";

/**
 * Records money leaving the account for VeriHome's own purposes.
 *
 * Unlike every other money event this has no booking, viewing or consultation
 * behind it — which is exactly why it is the only thing that can push spendable
 * cash negative, and why the position statement's warning depends on it.
 */
export async function recordSpend(formData: FormData) {
  let caller;
  try { caller = await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const kind = String(formData.get("kind") ?? "operating");
  const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/\D/g, "")));
  const description = (formData.get("description") as string)?.trim();

  if (!Number.isFinite(amount) || amount <= 0) return { error: "Jumlah harus lebih dari nol." };
  if (!description) return { error: "Keterangan wajib diisi — pengeluaran tanpa keterangan tidak bisa diaudit." };

  try {
    if (kind === "drawing") {
      await postEquityDrawing({ amount, description }, { createdBy: caller.id });
    } else {
      await postOperatingExpense({ amount, description }, { createdBy: caller.id });
    }
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath("/admin/reports/position");
  revalidatePath("/admin/expenses");
  return { success: true };
}
