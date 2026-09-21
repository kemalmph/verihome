/**
 * The viewing deposit policy — one definition, used by every surface.
 *
 * This exists as a module rather than as copy in a component because the old
 * wording ("refundable", "dikembalikan penuh") had drifted across five files
 * and no longer described what the system does: an attended viewing converts
 * the deposit to credit, it does not return cash. Copy that lives in one place
 * cannot disagree with itself.
 *
 * VERSION is recorded on the viewing row alongside the acknowledgement
 * timestamp. If the terms change, bump it — otherwise there is no way to say
 * which terms a given guest actually agreed to.
 */

export const VIEWING_POLICY_VERSION = "2026-09-21";

/** Credit validity, and the window for exchanging unused credit back to cash. */
export const CREDIT_VALID_MONTHS = 6;
export const CREDIT_CASHBACK_DAYS = 14;

export interface PolicyLine {
  /** The trigger, e.g. "Hadir viewing". */
  id: string;
  en: string;
  outcome: "credit" | "cash" | "partial" | "forfeit";
  /** Indonesian description of what happens. */
  idOutcome: string;
  enOutcome: string;
}

export function viewingPolicyLines(deposit: number): PolicyLine[] {
  const rp = new Intl.NumberFormat("id-ID").format(deposit);
  const half = new Intl.NumberFormat("id-ID").format(Math.round(deposit / 2));

  return [
    {
      id: "Hadir viewing",
      en: "You attend the viewing",
      outcome: "credit",
      idOutcome:
        `Deposit menjadi kredit VeriHome senilai Rp ${rp}, berlaku ${CREDIT_VALID_MONTHS} bulan, ` +
        `dapat dipakai untuk konsultasi atau booking. Kredit yang belum terpakai dapat ditukar ` +
        `kembali menjadi uang dalam ${CREDIT_CASHBACK_DAYS} hari.`,
      enOutcome:
        `Your deposit becomes VeriHome credit worth Rp ${rp}, valid ${CREDIT_VALID_MONTHS} months, ` +
        `usable for a consultation or a booking. Unused credit can be exchanged back for cash ` +
        `within ${CREDIT_CASHBACK_DAYS} days.`,
    },
    {
      id: "Batal ≥24 jam sebelumnya",
      en: "You cancel 24 hours or more ahead",
      outcome: "cash",
      idOutcome: "Dikembalikan penuh sebagai uang.",
      enOutcome: "Refunded in full, as cash.",
    },
    {
      id: "Batal <24 jam",
      en: "You cancel less than 24 hours ahead",
      outcome: "partial",
      idOutcome: `Dikembalikan 50% — Rp ${half}.`,
      enOutcome: `50% refunded — Rp ${half}.`,
    },
    {
      id: "Tidak hadir tanpa kabar",
      en: "You do not attend and do not tell us",
      outcome: "forfeit",
      idOutcome: "Deposit hangus.",
      enOutcome: "The deposit is forfeited.",
    },
    {
      id: "Dibatalkan VeriHome/pemilik",
      en: "VeriHome or the owner cancels",
      outcome: "cash",
      idOutcome: "Dikembalikan penuh sebagai uang.",
      enOutcome: "Refunded in full, as cash.",
    },
  ];
}
