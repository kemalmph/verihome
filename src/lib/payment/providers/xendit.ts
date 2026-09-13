import Xendit from "xendit-node";
import type { PaymentProvider, PaymentIntent, PaymentRequest } from "../types";

/**
 * Xendit hosted invoice. Not active — `getPaymentProvider` returns `manual`
 * unless PAYMENT_PROVIDER says otherwise, and switching it over is a config
 * change rather than a code change.
 *
 * Before enabling, see the checklist in the platform reference: the webhook at
 * /api/xendit/webhook only understands consultations today, and nothing writes
 * a provider reference back onto bookings or viewings, so a paid invoice
 * against either would not be matched to its record.
 */
export const xenditProvider: PaymentProvider = {
  name: "xendit",

  async createIntent(request: PaymentRequest): Promise<PaymentIntent> {
    const secretKey = process.env.XENDIT_SECRET_KEY;
    if (!secretKey) {
      throw new Error("XENDIT_SECRET_KEY is not set — cannot create a Xendit invoice.");
    }

    const xendit = new Xendit({ secretKey });
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const invoice = await xendit.Invoice.createInvoice({
      data: {
        externalId:          request.reference,
        amount:              request.amount,
        description:         request.description,
        payerEmail:          request.payerEmail,
        currency:            "IDR",
        successRedirectUrl:  request.returnUrl ?? `${origin}/dashboard`,
        failureRedirectUrl:  request.cancelUrl ?? `${origin}/dashboard`,
        invoiceDuration:     86400, // 24h
      },
    });

    return {
      provider: "xendit",
      amount:   request.amount,
      reference: request.reference,
      action: {
        kind:        "redirect",
        checkoutUrl: invoice.invoiceUrl,
        externalId:  invoice.id ?? request.reference,
        expiresAt:   invoice.expiryDate ? new Date(invoice.expiryDate).toISOString() : null,
      },
    };
  },
};
