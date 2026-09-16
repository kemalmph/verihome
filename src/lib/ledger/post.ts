import { createAdminClient } from "@/lib/supabase/admin";
import type { LedgerEntry, AccountBalance } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

function sum(entries: LedgerEntry[], direction: "debit" | "credit"): number {
  return entries
    .filter((e) => e.direction === direction)
    .reduce((total, e) => total + Math.round(e.amount), 0);
}

/**
 * Collapses entries that hit the same account on the same side of one event.
 *
 * A booking whose cleaning fee belongs to the owner credits owner_payable
 * twice — once for cleaning, once for their share of rent. Two rows saying the
 * same thing is not wrong, but one entry per account per event is a stronger
 * invariant: it is what lets the database reject a replayed event outright,
 * since a duplicate then repeats an (event_type, record, account, direction)
 * that already exists. Totals are unchanged, so balance is preserved.
 */
function mergeByAccount(entries: LedgerEntry[]): LedgerEntry[] {
  const merged = new Map<string, LedgerEntry>();

  for (const e of entries) {
    const key = [
      e.event_type, e.account, e.direction,
      e.booking_id ?? "", e.viewing_id ?? "", e.consultation_id ?? "",
      e.property_id ?? "", e.user_id ?? "", e.owner_id ?? "",
    ].join("|");

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...e, amount: Math.round(e.amount) });
      continue;
    }
    existing.amount += Math.round(e.amount);
    if (e.description && existing.description !== e.description) {
      existing.description = `${existing.description}; ${e.description}`;
    }
  }

  return [...merged.values()];
}

/**
 * The only way anything is written to ledger_entries.
 *
 * Balance is checked here for a readable error at the call site, and checked
 * again inside post_ledger_entries, which is where the guarantee actually
 * lives — a plpgsql body is one transaction, so either every entry of an event
 * lands or none does. A half-posted event would be worse than an unposted one:
 * it would silently unbalance the whole ledger.
 */
export async function postLedgerEntries(
  entries: LedgerEntry[],
  client?: AdminClient
): Promise<void> {
  if (entries.length < 2) {
    throw new LedgerError(
      `A financial event needs at least two entries; got ${entries.length}. Every event has a source and a destination.`
    );
  }

  for (const e of entries) {
    if (!Number.isFinite(e.amount) || e.amount < 0) {
      throw new LedgerError(
        `Invalid amount ${e.amount} on ${e.event_type}/${e.account}. Amounts are non-negative; direction carries the sign.`
      );
    }
  }

  const debits = sum(entries, "debit");
  const credits = sum(entries, "credit");

  if (debits !== credits) {
    throw new LedgerError(
      `Unbalanced entry set for ${entries[0].event_type}: debits ${debits} ≠ credits ${credits} (difference ${debits - credits}). Not posted.`
    );
  }
  if (debits === 0) {
    throw new LedgerError(
      `Zero-value event ${entries[0].event_type} was not posted — an event that moves no money does not belong in the ledger.`
    );
  }

  const admin = client ?? createAdminClient();
  const { error } = await admin.rpc("post_ledger_entries", {
    p_entries: mergeByAccount(entries),
  });

  if (error) {
    // A unique violation here means this event is already on the books —
    // a retried request or a second admin clicking the same button. The
    // ledger is correct as it stands, so this is reported, not repaired.
    if (error.code === "23505" || /duplicate key|already posted/i.test(error.message)) {
      throw new LedgerError(
        `${entries[0].event_type} is already posted for this record — not posted again. If the figures are wrong, correct them with a reversing entry.`
      );
    }
    throw new LedgerError(`Ledger post failed for ${entries[0].event_type}: ${error.message}`);
  }
}

/** Account balances, optionally bounded to a period. [from, to) */
export async function getLedgerBalances(
  opts: { from?: Date | string | null; to?: Date | string | null; client?: AdminClient } = {}
): Promise<AccountBalance[]> {
  const admin = opts.client ?? createAdminClient();
  const iso = (v: Date | string | null | undefined) =>
    v == null ? null : v instanceof Date ? v.toISOString() : v;

  const { data, error } = await admin.rpc("ledger_balances", {
    p_from: iso(opts.from),
    p_to: iso(opts.to),
  });

  if (error) throw new LedgerError(`Could not read ledger balances: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    account: r.account as AccountBalance["account"],
    kind: r.kind as AccountBalance["kind"],
    debits: Number(r.debits),
    credits: Number(r.credits),
    balance: Number(r.balance),
  }));
}

/** Convenience: balance of one account, 0 when it has no entries yet. */
export function balanceOf(balances: AccountBalance[], account: AccountBalance["account"]): number {
  return balances.find((b) => b.account === account)?.balance ?? 0;
}
