import type { PaymentProvider, PaymentIntent } from "../types";

function randomTransferCode(): string {
  return String(Math.floor(Math.random() * 900) + 100);
}

export const manualProvider: PaymentProvider = {
  name: "manual",

  async createIntent(totalAmount: number): Promise<PaymentIntent> {
    const bankName      = process.env.BANK_NAME          ?? "BCA";
    const accountNumber = process.env.BANK_ACCOUNT_NUMBER ?? "";
    const accountHolder = process.env.BANK_ACCOUNT_HOLDER ?? "VeriHome";
    const transferCode  = randomTransferCode();

    const instructions =
      `Transfer Rp ${(totalAmount + Number(transferCode)).toLocaleString("id-ID")} ` +
      `ke ${bankName} ${accountNumber} a/n ${accountHolder}. ` +
      `Kode unik ${transferCode} sudah termasuk dalam jumlah transfer.`;

    return {
      provider: "manual",
      instructions,
      bankName,
      accountNumber,
      accountHolder,
      transferCode,
      totalAmount,
    };
  },
};
