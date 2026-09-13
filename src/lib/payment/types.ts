// One payment abstraction for the whole platform.
//
// Bookings, viewing deposits and consultations all charge money, and all of them
// go through this. Which provider actually handles a charge is configuration,
// not something any individual flow decides for itself.

export type PaymentProviderName = "manual" | "xendit";

/**
 * What the payer has to do next.
 *
 * The two modes are genuinely different acts — one ends on our own screen with
 * instructions to go to a bank, the other hands the payer to a third party —
 * so this is a union rather than a single shape with half its fields unused.
 * Callers branch on `kind`, and adding a provider that redirects costs nothing.
 */
export type PaymentAction =
  | {
      kind: "bank_transfer";
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      /**
       * Three-digit suffix added to the amount so an incoming transfer can be
       * matched to its record. Indonesian transfers carry no reliable memo
       * field, so the amount itself is the identifier.
       */
      transferCode: string;
      /** amount + transferCode — the figure the payer must send exactly. */
      payableAmount: number;
      instructions: string;
    }
  | {
      kind: "redirect";
      checkoutUrl: string;
      /** Provider-side reference, e.g. a Xendit invoice id. */
      externalId: string;
      expiresAt: string | null;
    };

export interface PaymentIntent {
  provider: PaymentProviderName;
  /** What is owed, before any unique-code adjustment. */
  amount: number;
  /** Our id for the thing being paid for — booking, viewing or consultation. */
  reference: string;
  action: PaymentAction;
}

export interface PaymentRequest {
  reference: string;
  amount: number;
  /** Shown to the payer on a provider's own checkout page. */
  description: string;
  payerEmail?: string;
  /** Where a redirecting provider should return the payer on success. */
  returnUrl?: string;
  /** Where it should return them on failure or cancellation. */
  cancelUrl?: string;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  createIntent(request: PaymentRequest): Promise<PaymentIntent>;
}

/** Narrowing helper so callers do not repeat the discriminant check. */
export function isBankTransfer(
  action: PaymentAction
): action is Extract<PaymentAction, { kind: "bank_transfer" }> {
  return action.kind === "bank_transfer";
}
