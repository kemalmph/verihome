import type { PaymentProvider, PaymentIntent, PaymentRequest } from "../types";

function randomTransferCode(): string {
  return String(Math.floor(Math.random() * 900) + 100);
}

/**
 * Bank transfer with admin confirmation. No gateway, no fees, and the payer
 * never leaves the site — they get account details and an exact amount.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",

  async createIntent({ reference, amount }: PaymentRequest): Promise<PaymentIntent> {
    const bankName      = process.env.BANK_NAME           ?? "BCA";
    const accountNumber = process.env.BANK_ACCOUNT_NUMBER ?? "";
    const accountHolder = process.env.BANK_ACCOUNT_HOLDER ?? "VeriHome";
    const transferCode  = randomTransferCode();
    const payableAmount = amount + Number(transferCode);

    const instructions =
      `Transfer Rp ${payableAmount.toLocaleString("id-ID")} ` +
      `ke ${bankName} ${accountNumber} a/n ${accountHolder}. ` +
      `Kode unik ${transferCode} sudah termasuk dalam jumlah transfer.`;

    return {
      provider: "manual",
      amount,
      reference,
      action: {
        kind: "bank_transfer",
        bankName,
        accountNumber,
        accountHolder,
        transferCode,
        payableAmount,
        instructions,
      },
    };
  },
};
