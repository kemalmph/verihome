export type PaymentProviderName = "manual";

export interface PaymentIntent {
  provider: PaymentProviderName;
  /** Human-readable instructions shown to the user */
  instructions: string;
  /** e.g. "BCA" */
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  /**
   * 3-digit unique suffix the user must append to the transfer amount so
   * admin can identify the payment. e.g. amount=500000, code="042" → transfer 500042
   */
  transferCode: string;
  totalAmount: number;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  /** Create a payment intent for a given total */
  createIntent(totalAmount: number): Promise<PaymentIntent>;
}
