/**
 * Every new user-facing string, keyed by id, Indonesian first with English
 * alongside.
 *
 * The point is that translation later becomes wiring rather than a rewrite: the
 * copy already exists in both languages and in one place, so adding a language
 * switch means changing `t()` and nothing else. The viewing policy in
 * lib/viewings/policy.ts proved the opposite case — the same sentence lived in
 * five components and was wrong in all five at once.
 */

export type Lang = "id" | "en";

export interface Str { id: string; en: string }

export const STRINGS = {
  // ── Owner portal: navigation ──────────────────────────────────────────────
  "owner.nav.overview":    { id: "Ringkasan",            en: "Overview" },
  "owner.nav.properties":  { id: "Properti Saya",        en: "My Properties" },
  "owner.nav.bookings":    { id: "Menginap",             en: "Stays" },
  "owner.nav.viewings":    { id: "Kunjungan",            en: "Viewings" },
  "owner.nav.earnings":    { id: "Pendapatan",           en: "Earnings" },
  "owner.nav.placements":  { id: "Penyewa Jangka Panjang", en: "Long-term Tenants" },
  "owner.nav.profile":     { id: "Profil",               en: "Profile" },

  // ── Owner portal: overview ────────────────────────────────────────────────
  "owner.overview.title":        { id: "Ringkasan",                  en: "Overview" },
  "owner.overview.subtitle":     { id: "Properti dan pendapatan Anda bersama VeriHome", en: "Your properties and earnings with VeriHome" },
  "owner.overview.thisMonth":    { id: "Bulan ini",                  en: "This month" },
  "owner.overview.nightsBooked": { id: "Malam terisi",               en: "Nights booked" },
  "owner.overview.occupancy":    { id: "Tingkat hunian",             en: "Occupancy" },
  "owner.overview.earnings":     { id: "Pendapatan Anda",            en: "Your earnings" },
  "owner.overview.upcoming":     { id: "Check-in & check-out 14 hari ke depan", en: "Check-ins and check-outs, next 14 days" },
  "owner.overview.noUpcoming":   { id: "Tidak ada jadwal dalam 14 hari ke depan.", en: "Nothing scheduled in the next 14 days." },
  "owner.overview.needsAction":  { id: "Perlu tindakan Anda",        en: "Needs your action" },
  "owner.overview.allClear":     { id: "Tidak ada yang perlu Anda lakukan sekarang.", en: "Nothing needs your attention right now." },
  "owner.overview.noProperties": { id: "Belum ada properti yang terhubung ke akun Anda.", en: "No properties are linked to your account yet." },

  // ── Balance ───────────────────────────────────────────────────────────────
  "owner.balance.title":       { id: "Saldo",              en: "Balance" },
  "owner.balance.earned":      { id: "Total diperoleh",    en: "Total earned" },
  "owner.balance.paid":        { id: "Sudah dibayarkan",   en: "Paid out" },
  "owner.balance.outstanding": { id: "Belum dibayarkan",   en: "Outstanding" },
  "owner.balance.fromLedger":  { id: "Angka diambil langsung dari buku besar VeriHome.", en: "Figures are read directly from VeriHome's ledger." },

  // ── Property detail ───────────────────────────────────────────────────────
  "owner.property.status":         { id: "Status listing",        en: "Listing status" },
  "owner.property.notLive":        { id: "Belum tayang",          en: "Not yet live" },
  "owner.property.missingItems":   { id: "Yang masih kurang",     en: "Still missing" },
  "owner.property.assessment":     { id: "Penilaian VeriHome",    en: "VeriHome assessment" },
  "owner.property.assessmentNote": {
    id: "Penilaian ini dibuat surveyor VeriHome dan tidak dapat diubah. Independensinya yang membuat listing Anda dipercaya calon penyewa.",
    en: "This assessment is made by a VeriHome surveyor and cannot be edited. Its independence is what makes your listing credible to renters.",
  },
  "owner.property.pros":        { id: "Kelebihan",             en: "Strengths" },
  "owner.property.cons":        { id: "Kekurangan",            en: "Weaknesses" },
  "owner.property.media":       { id: "Foto & video",          en: "Photos and video" },
  "owner.property.rates":       { id: "Tarif & pembagian",     en: "Rates and split" },
  "owner.property.perNight":    { id: "Contoh per malam",      en: "Per-night example" },
  "owner.property.youReceive":  { id: "Anda menerima",         en: "You receive" },
  "owner.property.viewPublic":  { id: "Lihat listing publik",  en: "View public listing" },
  "owner.property.proposeRate": { id: "Ajukan perubahan tarif", en: "Propose a rate change" },

  // ── Calendar ──────────────────────────────────────────────────────────────
  "owner.calendar.title":     { id: "Ketersediaan",        en: "Availability" },
  "owner.calendar.available": { id: "Tersedia",            en: "Available" },
  "owner.calendar.booked":    { id: "Terpesan",            en: "Booked" },
  "owner.calendar.blocked":   { id: "Diblokir",            en: "Blocked" },
  "owner.calendar.buffer":    { id: "Jeda bersih-bersih",  en: "Cleaning buffer" },
  "owner.calendar.blockDates":{ id: "Blokir tanggal",      en: "Block dates" },
  "owner.calendar.blockNote": {
    id: "Untuk pemakaian pribadi. Tanggal yang sudah terpesan tidak bisa diblokir.",
    en: "For your own use. Dates that are already booked cannot be blocked.",
  },
  "owner.calendar.removeBlock": { id: "Hapus blokir",      en: "Remove block" },
  "owner.calendar.onlyOwnBlocks": {
    id: "Anda hanya dapat menghapus blokir yang Anda buat sendiri.",
    en: "You can only remove blocks you created yourself.",
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  "owner.bookings.title":     { id: "Menginap di properti Anda", en: "Stays at your properties" },
  "owner.bookings.guest":     { id: "Tamu",                 en: "Guest" },
  "owner.bookings.nights":    { id: "Malam",                en: "Nights" },
  "owner.bookings.toYou":     { id: "Untuk Anda",           en: "To you" },
  "owner.bookings.contactWindow": {
    id: "Kontak tamu tampil mulai 48 jam sebelum check-in sampai check-out.",
    en: "Guest contact appears from 48 hours before check-in until checkout.",
  },
  "owner.bookings.privacyNote": {
    id: "VeriHome tidak menampilkan nama lengkap, dokumen identitas, atau bukti pembayaran tamu kepada pemilik.",
    en: "VeriHome never shows a guest's full surname, identity documents or payment proofs to owners.",
  },
  "owner.bookings.none": { id: "Belum ada pemesanan.", en: "No bookings yet." },

  // ── Viewings ──────────────────────────────────────────────────────────────
  "owner.viewings.title": { id: "Kunjungan calon penyewa", en: "Prospect viewings" },
  "owner.viewings.none":  { id: "Belum ada kunjungan terjadwal.", en: "No viewings scheduled." },
  "owner.viewings.prospect": { id: "Calon penyewa",        en: "Prospect" },

  // ── Earnings ──────────────────────────────────────────────────────────────
  "owner.earnings.title":      { id: "Pendapatan",          en: "Earnings" },
  "owner.earnings.gross":      { id: "Nilai sewa",          en: "Gross rent" },
  "owner.earnings.commission": { id: "Komisi VeriHome",     en: "VeriHome commission" },
  "owner.earnings.cleaning":   { id: "Biaya kebersihan",    en: "Cleaning fee" },
  "owner.earnings.net":        { id: "Bersih untuk Anda",   en: "Net to you" },
  "owner.earnings.payouts":    { id: "Riwayat pembayaran",  en: "Payout history" },
  "owner.earnings.statement":  { id: "Unduh laporan",       en: "Download statement" },
  "owner.earnings.none":       { id: "Belum ada pendapatan tercatat.", en: "No earnings recorded yet." },

  // ── Placements ────────────────────────────────────────────────────────────
  "owner.placements.title":  { id: "Penyewa jangka panjang", en: "Long-term tenants" },
  "owner.placements.report": { id: "Laporkan penyewa baru",  en: "Report a new tenant" },
  "owner.placements.reportNote": {
    id: "Laporkan sendiri jika Anda menyewakan properti ini ke penyewa jangka panjang. Tim VeriHome akan mengonfirmasi.",
    en: "Report it yourself if you let this property to a long-term tenant. The VeriHome team will confirm.",
  },
  "owner.placements.tenantFirstName": { id: "Nama depan penyewa", en: "Tenant first name" },
  "owner.placements.monthlyRent":     { id: "Sewa per bulan",     en: "Monthly rent" },
  "owner.placements.leaseStart":      { id: "Mulai sewa",         en: "Lease start" },
  "owner.placements.none":            { id: "Belum ada penempatan tercatat.", en: "No placements recorded yet." },

  // ── Profile ───────────────────────────────────────────────────────────────
  "owner.profile.title":         { id: "Profil",               en: "Profile" },
  "owner.profile.contact":       { id: "Kontak",               en: "Contact" },
  "owner.profile.payout":        { id: "Rekening pembayaran",  en: "Payout account" },
  "owner.profile.bank":          { id: "Bank",                 en: "Bank" },
  "owner.profile.accountNumber": { id: "Nomor rekening",       en: "Account number" },
  "owner.profile.accountHolder": { id: "Atas nama",            en: "Account holder" },
  "owner.profile.payoutPending": {
    id: "Perubahan rekening menunggu verifikasi. Pembayaran tetap ke rekening lama sampai tim VeriHome mengonfirmasi lewat telepon.",
    en: "A change to this account is awaiting verification. Payouts continue to the previous account until the VeriHome team confirms by phone.",
  },
  "owner.profile.documents":     { id: "Dokumen",              en: "Documents" },
  "owner.profile.docRightToLet": { id: "Bukti hak menyewakan", en: "Proof of right to let" },
  "owner.profile.docAgreement":  { id: "Perjanjian kerja sama", en: "Cooperation agreement" },
  "owner.profile.upload":        { id: "Unggah",               en: "Upload" },

  // ── Change requests ───────────────────────────────────────────────────────
  "owner.request.pending":  { id: "Menunggu persetujuan", en: "Awaiting approval" },
  "owner.request.approved": { id: "Disetujui",            en: "Approved" },
  "owner.request.rejected": { id: "Ditolak",              en: "Rejected" },
  "owner.request.rateNote": {
    id: "Tarif baru berlaku untuk pemesanan berikutnya. Pemesanan yang sudah terjadi tetap memakai tarif saat itu.",
    en: "New rates apply to future bookings. Bookings already made keep the terms agreed at the time.",
  },
  "owner.request.submitted": { id: "Permintaan terkirim.", en: "Request submitted." },

  // ── Owner invite / access ─────────────────────────────────────────────────
  "owner.invite.title":   { id: "Aktifkan akses portal", en: "Activate portal access" },
  "owner.invite.intro":   { id: "Tautan ini menghubungkan akun Anda dengan data properti di VeriHome.", en: "This link connects your account to your property records at VeriHome." },
  "owner.invite.accept":  { id: "Hubungkan akun saya",   en: "Link my account" },
  "owner.invite.invalid": { id: "Tautan undangan tidak berlaku.", en: "This invite link is not valid." },
  "owner.invite.used":    { id: "Tautan undangan ini sudah dipakai.", en: "This invite link has already been used." },
  "owner.invite.expired": { id: "Tautan undangan sudah kedaluwarsa. Minta tautan baru kepada tim VeriHome.", en: "This invite link has expired. Ask the VeriHome team for a new one." },
  "owner.access.denied":  { id: "Akun Anda tidak memiliki akses portal pemilik.", en: "Your account does not have owner portal access." },
  "owner.access.revoked": { id: "Akses portal Anda telah dinonaktifkan. Hubungi tim VeriHome.", en: "Your portal access has been switched off. Please contact the VeriHome team." },

  // ── Admin: invites and requests ───────────────────────────────────────────
  "admin.owner.invite":        { id: "Undang ke portal",     en: "Invite to portal" },
  "admin.owner.inviteCreated": { id: "Undangan dibuat. Kirim tautan ini lewat WhatsApp.", en: "Invite created. Send this link by WhatsApp." },
  "admin.owner.revoke":        { id: "Cabut akses",          en: "Revoke access" },
  "admin.owner.reinvite":      { id: "Undang ulang",         en: "Re-invite" },
  "admin.requests.title":      { id: "Permintaan pemilik",   en: "Owner requests" },
  "admin.requests.approve":    { id: "Setujui",              en: "Approve" },
  "admin.requests.reject":     { id: "Tolak",                en: "Reject" },
  "admin.requests.none":       { id: "Tidak ada permintaan menunggu.", en: "No pending requests." },
  "admin.requests.payoutWarn": {
    id: "Konfirmasi lewat telepon dengan pemilik sebelum menyetujui. Perubahan rekening adalah jalur penipuan yang umum.",
    en: "Confirm by phone with the owner before approving. Redirecting a payout account is a common fraud route.",
  },

  // ── Guest unit pages ──────────────────────────────────────────────────────
  "unit.title":          { id: "Unit Saya",            en: "My Unit" },
  "unit.current":        { id: "Menginap saat ini",    en: "Current stay" },
  "unit.next":           { id: "Menginap berikutnya",  en: "Next stay" },
  "unit.past":           { id: "Menginap terakhir",    en: "Most recent stay" },
  "unit.none":           { id: "Belum ada menginap. Unit tersimpan Anda ada di bawah.", en: "No stays yet. Your saved units are below." },
  "unit.addressLocked":  { id: "Alamat lengkap tampil setelah pemesanan dikonfirmasi.", en: "The full address appears once your booking is confirmed." },
  "unit.directions":     { id: "Petunjuk arah",        en: "Directions" },
  "unit.checkIn":        { id: "Check-in",             en: "Check-in" },
  "unit.checkOut":       { id: "Check-out",            en: "Check-out" },
  "unit.rules":          { id: "Aturan rumah",         en: "House rules" },
  "unit.facilities":     { id: "Fasilitas",            en: "Facilities" },
  "unit.included":       { id: "Termasuk dalam harga", en: "Included in the price" },
  "unit.notIncluded":    { id: "Tidak termasuk",       en: "Not included" },
  "unit.area":           { id: "Sekitar lokasi",       en: "The area" },
  "unit.assessment":     { id: "Penilaian VeriHome",   en: "VeriHome assessment" },
  "unit.contact":        { id: "Bantuan",              en: "Help" },
  "unit.contactSupport": { id: "Dukungan VeriHome",    en: "VeriHome support" },
  "unit.contactOwner":   { id: "Kontak pemilik",       en: "Owner contact" },
  "unit.contactOwnerWindow": {
    id: "Kontak pemilik tampil mulai 48 jam sebelum check-in sampai check-out.",
    en: "Owner contact appears from 48 hours before check-in until checkout.",
  },
  "unit.money":          { id: "Pembayaran",           en: "Payment" },
  "unit.paid":           { id: "Sudah dibayar",        en: "Paid" },
  "unit.creditApplied":  { id: "Kredit dipakai",       en: "Credit applied" },
  "unit.deposit":        { id: "Jaminan ditahan",      en: "Deposit held" },
  "unit.receipt":        { id: "Lihat kuitansi",       en: "View receipt" },
  "unit.cancellation":   { id: "Pembatalan",           en: "Cancellation" },
  "unit.refundNow":      { id: "Jika dibatalkan sekarang", en: "If you cancel now" },
  "unit.refundChanges":  { id: "Berubah pada",         en: "Changes on" },

  // ── Saved units ───────────────────────────────────────────────────────────
  "saved.title":        { id: "Unit Tersimpan",   en: "Saved Units" },
  "saved.priceNow":     { id: "Harga sekarang",   en: "Price now" },
  "saved.priceSaved":   { id: "Saat disimpan",    en: "When saved" },
  "saved.priceUp":      { id: "naik",             en: "up" },
  "saved.priceDown":    { id: "turun",            en: "down" },
  "saved.noLongerLive": { id: "Tidak lagi tayang", en: "No longer listed" },
  "saved.nextAvailable":{ id: "Tersedia mulai",   en: "Next available" },
  "saved.book":         { id: "Pesan",            en: "Book" },
  "saved.requestViewing":{ id: "Minta kunjungan", en: "Request a viewing" },
  "saved.remove":       { id: "Hapus",            en: "Remove" },
  "saved.none":         { id: "Belum ada unit tersimpan.", en: "No saved units yet." },

  // ── Long-term tenancy (guest side) ────────────────────────────────────────
  "tenancy.title":      { id: "Sewa jangka panjang saya", en: "My long-term tenancy" },
  "tenancy.leaseStart": { id: "Mulai sewa",               en: "Lease start" },
  "tenancy.monthlyRent":{ id: "Sewa per bulan",           en: "Monthly rent" },

  // ── Shared ────────────────────────────────────────────────────────────────
  "common.notFound":  { id: "Tidak ditemukan.",  en: "Not found." },
  "common.save":      { id: "Simpan",            en: "Save" },
  "common.cancel":    { id: "Batal",             en: "Cancel" },
  "common.submit":    { id: "Kirim",             en: "Submit" },
  "common.loading":   { id: "Memuat…",           en: "Loading…" },
} as const satisfies Record<string, Str>;

export type StringKey = keyof typeof STRINGS;

/**
 * Indonesian is the default because the audience is Jakarta. English is
 * returned alongside rather than instead, so a component can show both without
 * a second lookup — which is how the pages are laid out today.
 */
export function t(key: StringKey, lang: Lang = "id"): string {
  return STRINGS[key][lang];
}

export function tBoth(key: StringKey): Str {
  return STRINGS[key];
}
