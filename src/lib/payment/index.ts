import type { PaymentProvider, PaymentProviderName } from "./types";
import { manualProvider } from "./providers/manual";
import { xenditProvider } from "./providers/xendit";

const PROVIDERS: Record<PaymentProviderName, PaymentProvider> = {
  manual: manualProvider,
  xendit: xenditProvider,
};

/**
 * The single place the platform decides who handles a payment.
 *
 * Defaults to `manual` — bank transfer with admin confirmation — because the
 * Xendit account is not live yet. Every flow calls this rather than choosing a
 * provider for itself, so switching the whole platform over is one variable.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER ?? "manual") as PaymentProviderName;
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${name}". Expected one of: ${Object.keys(PROVIDERS).join(", ")}.`
    );
  }
  return provider;
}

export { isBankTransfer } from "./types";
export type {
  PaymentProvider,
  PaymentIntent,
  PaymentRequest,
  PaymentAction,
  PaymentProviderName,
} from "./types";
