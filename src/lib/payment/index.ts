import type { PaymentProvider } from "./types";
import { manualProvider } from "./providers/manual";

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "manual";
  if (name === "manual") return manualProvider;
  throw new Error(`Unknown payment provider: ${name}`);
}

export type { PaymentProvider, PaymentIntent, PaymentProviderName } from "./types";
