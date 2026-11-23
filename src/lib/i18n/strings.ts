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
  "owner.overview.subtitle":     { id: "Properti dan pendapatan Anda bersama Cosystem", en: "Your properties and earnings with Cosystem" },
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
  "owner.balance.fromLedger":  { id: "Angka diambil langsung dari buku besar Cosystem.", en: "Figures are read directly from Cosystem's ledger." },

  // ── Property detail ───────────────────────────────────────────────────────
  "owner.property.status":         { id: "Status listing",        en: "Listing status" },
  "owner.property.notLive":        { id: "Belum tayang",          en: "Not yet live" },
  "owner.property.missingItems":   { id: "Yang masih kurang",     en: "Still missing" },
  "owner.property.assessment":     { id: "Penilaian Cosystem",    en: "Cosystem assessment" },
  "owner.property.assessmentNote": {
    id: "Penilaian ini dibuat surveyor Cosystem dan tidak dapat diubah. Independensinya yang membuat listing Anda dipercaya calon penyewa.",
    en: "This assessment is made by a Cosystem surveyor and cannot be edited. Its independence is what makes your listing credible to renters.",
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
    id: "Cosystem tidak menampilkan nama lengkap, dokumen identitas, atau bukti pembayaran tamu kepada pemilik.",
    en: "Cosystem never shows a guest's full surname, identity documents or payment proofs to owners.",
  },
  "owner.bookings.none": { id: "Belum ada pemesanan.", en: "No bookings yet." },

  // ── Viewings ──────────────────────────────────────────────────────────────
  "owner.viewings.title": { id: "Kunjungan calon penyewa", en: "Prospect viewings" },
  "owner.viewings.none":  { id: "Belum ada kunjungan terjadwal.", en: "No viewings scheduled." },
  "owner.viewings.prospect": { id: "Calon penyewa",        en: "Prospect" },

  // ── Earnings ──────────────────────────────────────────────────────────────
  "owner.earnings.title":      { id: "Pendapatan",          en: "Earnings" },
  "owner.earnings.gross":      { id: "Nilai sewa",          en: "Gross rent" },
  "owner.earnings.commission": { id: "Komisi Cosystem",     en: "Cosystem commission" },
  "owner.earnings.cleaning":   { id: "Biaya kebersihan",    en: "Cleaning fee" },
  "owner.earnings.net":        { id: "Bersih untuk Anda",   en: "Net to you" },
  "owner.earnings.payouts":    { id: "Riwayat pembayaran",  en: "Payout history" },
  "owner.earnings.statement":  { id: "Unduh laporan",       en: "Download statement" },
  "owner.earnings.none":       { id: "Belum ada pendapatan tercatat.", en: "No earnings recorded yet." },

  // ── Placements ────────────────────────────────────────────────────────────
  "owner.placements.title":  { id: "Penyewa jangka panjang", en: "Long-term tenants" },
  "owner.placements.report": { id: "Laporkan penyewa baru",  en: "Report a new tenant" },
  "owner.placements.reportNote": {
    id: "Laporkan sendiri jika Anda menyewakan properti ini ke penyewa jangka panjang. Tim Cosystem akan mengonfirmasi.",
    en: "Report it yourself if you let this property to a long-term tenant. The Cosystem team will confirm.",
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
    id: "Perubahan rekening menunggu verifikasi. Pembayaran tetap ke rekening lama sampai tim Cosystem mengonfirmasi lewat telepon.",
    en: "A change to this account is awaiting verification. Payouts continue to the previous account until the Cosystem team confirms by phone.",
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
  "owner.invite.intro":   { id: "Tautan ini menghubungkan akun Anda dengan data properti di Cosystem.", en: "This link connects your account to your property records at Cosystem." },
  "owner.invite.accept":  { id: "Hubungkan akun saya",   en: "Link my account" },
  "owner.invite.invalid": { id: "Tautan undangan tidak berlaku.", en: "This invite link is not valid." },
  "owner.invite.used":    { id: "Tautan undangan ini sudah dipakai.", en: "This invite link has already been used." },
  "owner.invite.expired": { id: "Tautan undangan sudah kedaluwarsa. Minta tautan baru kepada tim Cosystem.", en: "This invite link has expired. Ask the Cosystem team for a new one." },
  "owner.access.denied":  { id: "Akun Anda tidak memiliki akses portal pemilik.", en: "Your account does not have owner portal access." },
  "owner.access.revoked": { id: "Akses portal Anda telah dinonaktifkan. Hubungi tim Cosystem.", en: "Your portal access has been switched off. Please contact the Cosystem team." },

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
  "unit.assessment":     { id: "Penilaian Cosystem",   en: "Cosystem assessment" },
  "unit.contact":        { id: "Bantuan",              en: "Help" },
  "unit.contactSupport": { id: "Dukungan Cosystem",    en: "Cosystem support" },
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

  // ══════════════════════════════════════════════════════════════════════════
  // Public site
  //
  // Until the EN/ID switch was wired up, each public page existed in exactly
  // one language — the marketing pages Indonesian, the booking and login
  // pages English — so whichever way a visitor set the switch, half the site
  // contradicted it. The missing halves are written out here.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Navigation ────────────────────────────────────────────────────────────
  "nav.features":        { id: "Fitur",            en: "Features" },
  "nav.feat.manage":     { id: "Fitur Kelola",     en: "Management Features" },
  "nav.feat.manageBlurb":{ id: "Jadwal, kontrak, dan tagihan dalam satu dashboard", en: "Schedules, contracts and invoices in one dashboard" },
  "nav.feat.monetise":   { id: "Cara Monetisasi",  en: "How to Monetise" },
  "nav.feat.monetiseBlurb":{ id: "Dari unit kosong ke listing yang menghasilkan", en: "From an empty unit to a listing that earns" },
  "nav.feat.assets":     { id: "Workspace & Hunian", en: "Workspace & Living" },
  "nav.feat.assetsBlurb":{ id: "Satu sistem untuk dua jenis aset", en: "One system for two kinds of asset" },
  "nav.pricing":         { id: "Harga",            en: "Pricing" },
  "nav.browse":          { id: "Jelajahi Listing", en: "Browse Listings" },
  "nav.contact":         { id: "Kontak Kami",      en: "Contact Us" },
  "nav.signIn":          { id: "Masuk",            en: "Sign In" },
  "nav.signUp":          { id: "Daftar",           en: "Sign Up" },
  "nav.dashboard":       { id: "Dashboard",        en: "Dashboard" },
  "nav.saved":           { id: "Unit Tersimpan",   en: "Saved Listings" },
  "nav.appointments":    { id: "Jadwal Kunjungan", en: "Appointments" },
  "nav.signOut":         { id: "Keluar",           en: "Sign Out" },

  // ── Footer ────────────────────────────────────────────────────────────────
  "footer.tagline":      { id: "Platform terpadu untuk mengelola operasional dan memonetisasi ruang kerja serta hunian dalam satu ekosistem.", en: "One platform to run and monetise workspaces and homes in a single ecosystem." },
  "footer.product":      { id: "Produk",           en: "Product" },
  "footer.manageWork":   { id: "Manajemen Workspace", en: "Workspace Management" },
  "footer.manageLiving": { id: "Manajemen Hunian", en: "Property Management" },
  "footer.marketplace":  { id: "Listing Marketplace", en: "Marketplace Listings" },
  "footer.tenants":      { id: "Penyewa",          en: "Renters" },
  "footer.findCoworking":{ id: "Cari Coworking & Ruang Rapat", en: "Find Coworking & Meeting Rooms" },
  "footer.findLiving":   { id: "Cari Kos & Hunian", en: "Find Rooms & Homes" },
  "footer.howToBook":    { id: "Cara Booking",     en: "How to Book" },
  "footer.company":      { id: "Perusahaan",       en: "Company" },
  "footer.listProperty": { id: "Daftarkan Properti", en: "List Your Property" },
  "footer.terms":        { id: "Syarat & Ketentuan", en: "Terms & Conditions" },
  "footer.privacy":      { id: "Kebijakan Privasi", en: "Privacy Policy" },
  "footer.rights":       { id: "Hak cipta dilindungi undang-undang.", en: "All rights reserved." },

  // ── Homepage: hero ────────────────────────────────────────────────────────
  "home.hero.badge":     { id: "Satu Platform untuk Ruang Kerja & Hunian", en: "One Platform for Workspaces & Homes" },
  "home.hero.title":     { id: "Kelola Operasional dan Monetisasi Properti Anda dalam Satu Sistem.", en: "Run and Monetise Your Property in One System." },
  "home.hero.sub":       { id: "Dari coworking space, ruang rapat, dan studio kerja hingga rumah tinggal, kos, dan vila. Rapikan jadwal dan tagihan penyewa, lalu pasarkan properti kosong Anda di Marketplace Cosystem.", en: "From coworking spaces, meeting rooms and studios to houses, rooms and villas. Put tenant schedules and invoices in order, then list your empty properties on the Cosystem Marketplace." },
  "home.hero.note":      { id: "Konsultasi kebutuhan properti  •  Setup dibantu tim kami  •  Terintegrasi penuh", en: "A consultation about your needs  •  Setup help from our team  •  Fully integrated" },
  "home.hero.browse":    { id: "Lihat Listing Tersedia", en: "See Available Listings" },

  // ── Homepage: two asset types ─────────────────────────────────────────────
  "home.assets.eyebrow": { id: "Fleksibel untuk Berbagai Aset", en: "Flexible Across Asset Types" },
  "home.assets.title":   { id: "Dirancang untuk Mengelola Workspace maupun Hunian", en: "Built to Manage Workspaces and Homes Alike" },
  "home.assets.sub":     { id: "Satu dashboard terpusat yang otomatis menyesuaikan fitur dengan jenis properti dan skema sewa Anda—baik hitungan jam, harian, maupun bulanan.", en: "One dashboard that adapts to your property type and rental model — by the hour, by the day or by the month." },
  "home.assets.work.title": { id: "Ruang Kerja & Workspace", en: "Workspaces & Offices" },
  "home.assets.work.desc":  { id: "Kelola coworking space, private office, meeting room, hingga studio kreatif dengan sistem reservasi dan kuota yang presisi.", en: "Run coworking spaces, private offices, meeting rooms and creative studios with precise reservations and quotas." },
  "home.assets.work.p1":    { id: "Kalender booking per jam atau per sesi anti-bentrok", en: "Hourly or per-session booking calendar that cannot double-book" },
  "home.assets.work.p2":    { id: "Manajemen paket membership & kredit jam penggunaan", en: "Membership plans and usage-hour credits" },
  "home.assets.work.p3":    { id: "Pencatatan konsumsi dan margin per booking", en: "Consumables and margin recorded per booking" },
  "home.assets.live.title": { id: "Hunian & Rumah Tinggal", en: "Homes & Residential" },
  "home.assets.live.desc":  { id: "Permudah operasional kos eksklusif, rumah kontrakan, apartemen, vila, hingga guesthouse tanpa pencatatan manual.", en: "Simplify the running of boarding houses, rentals, apartments, villas and guesthouses without manual bookkeeping." },
  "home.assets.live.p1":    { id: "Pencatatan tagihan dan verifikasi bukti transfer", en: "Invoices recorded and transfer receipts verified" },
  "home.assets.live.p2":    { id: "Pengelolaan kontrak sewa, deposit, dan data penghuni", en: "Leases, deposits and occupant records in one place" },
  "home.assets.live.p3":    { id: "Kalender ketersediaan dan blokir tanggal oleh pemilik", en: "Availability calendar with owner date blocking" },

  // ── Homepage: operations ──────────────────────────────────────────────────
  "home.ops.eyebrow":    { id: "Operasional & Pertumbuhan", en: "Operations & Growth" },
  "home.ops.title":      { id: "Rapikan Manajemen Harian, Maksimalkan Okupansi Unit", en: "Tidy Up Daily Management, Maximise Occupancy" },
  "home.ops.b1.title":   { id: "Satu Catatan untuk Jadwal & Tagihan Sewa", en: "One Record for Schedules & Rent Invoices" },
  "home.ops.b1.desc":    { id: "Hentikan rekap manual di spreadsheet. Jadwal, kontrak, tagihan, dan jatuh temponya tercatat di satu dashboard — dan setiap pelunasan yang dikonfirmasi langsung masuk ke pembukuan properti Anda pada transaksi yang sama.", en: "Stop recapping by hand in spreadsheets. Schedules, contracts, invoices and their due dates live in one dashboard — and every confirmed payment reaches your property's books in the same transaction." },
  "home.ops.b1.h1":      { id: "0% risiko double booking", en: "Zero double-booking risk" },
  "home.ops.b1.h2":      { id: "Pembukuan tercatat saat pembayaran dikonfirmasi", en: "Books updated the moment a payment is confirmed" },
  "home.ops.b2.title":   { id: "Ubah Slot Kosong Menjadi Pendapatan", en: "Turn Empty Slots Into Income" },
  "home.ops.b2.desc":    { id: "Properti yang datanya sudah lengkap bisa ditayangkan ke halaman listing publik dari dashboard yang sama. Foto, deskripsi, dan tarif terbit apa adanya tanpa input ulang, dan tanggal yang Anda blokir tidak bisa dipesan.", en: "A property whose details are complete can be published to the public listing page from the same dashboard. Photos, descriptions and rates go out as they are, with no re-entry, and dates you block cannot be booked." },
  "home.ops.b2.h1":      { id: "Tanpa input data dua kali", en: "No entering the same data twice" },
  "home.ops.b2.h2":      { id: "Tanpa kelola dua aplikasi", en: "No juggling two applications" },
  "home.ops.b2.link":    { id: "Lihat halaman listing", en: "See the listing page" },
  "home.ops.b3.title":   { id: "Lihat Angkanya, Bukan Tebakannya", en: "See the Numbers, Not the Guesswork" },
  "home.ops.b3.desc":    { id: "Okupansi per unit, sewa yang sudah terikat, tagihan yang jatuh tempo, dan margin tiap booking setelah dikurangi biaya — dihitung dari transaksi yang tercatat, bukan dari rekap yang diketik ulang.", en: "Occupancy per unit, rent already committed, invoices falling due and the margin on each booking after costs — computed from recorded transactions, not from a recap typed out again." },
  "home.ops.b3.h1":      { id: "Laporan okupansi & arus kas", en: "Occupancy and cash-flow reports" },
  "home.ops.b3.h2":      { id: "Pembukuan berpasangan yang tidak bisa diubah diam-diam", en: "Double-entry books that cannot be altered quietly" },

  // ── Homepage: how it works ────────────────────────────────────────────────
  "home.how.eyebrow":    { id: "Cara Kerja",       en: "How It Works" },
  "home.how.title":      { id: "Mulai Kelola & Monetisasi dalam 3 Langkah", en: "Start Managing & Monetising in 3 Steps" },
  "home.how.s1t":        { id: "Konsultasi & Daftarkan Properti Anda", en: "Talk to Us & Register Your Property" },
  "home.how.s1d":        { id: "Hubungi tim kami untuk menyesuaikan konfigurasi sistem dengan jumlah unit dan jenis aset workspace maupun hunian Anda.", en: "Contact our team so the system is configured for the number of units and the kinds of workspace or residential assets you hold." },
  "home.how.s2t":        { id: "Atur Jadwal & Tayangkan di Listing", en: "Set Up Schedules & Go Live" },
  "home.how.s2d":        { id: "Kelola penyewa yang sudah ada dari satu dashboard, lalu nyalakan visibilitas listing publik untuk menjaring penyewa baru.", en: "Manage your existing tenants from one dashboard, then switch on public listing visibility to reach new ones." },
  "home.how.s3t":        { id: "Terima Pembayaran & Pantau Laporan", en: "Take Payments & Watch the Reports" },
  "home.how.s3d":        { id: "Dana sewa masuk secara terstruktur lengkap dengan laporan okupansi, riwayat transaksi, dan performa tiap unit.", en: "Rent arrives in an orderly way, with occupancy reports, transaction history and the performance of each unit alongside it." },

  // ── Homepage: showcase ────────────────────────────────────────────────────
  "home.show.eyebrow":   { id: "Ekosistem Aktif",  en: "The Live Ecosystem" },
  "home.show.title":     { id: "Workspace & Hunian yang Dikelola Melalui Cosystem", en: "Workspaces & Homes Managed Through Cosystem" },
  "home.show.sub":       { id: "Jelajahi hunian yang jadwalnya terhubung langsung dengan sistem pengelola. Unit ruang kerja menyusul tayang di marketplace.", en: "Browse homes whose calendars run on the manager's own system. Workspace units will follow onto the marketplace." },
  "home.show.empty":     { id: "Belum ada unit yang tayang saat ini.", en: "No units are listed at the moment." },
  "home.show.all":       { id: "Lihat Semua Listing", en: "See All Listings" },

  // ── Homepage: pricing ─────────────────────────────────────────────────────
  "home.price.eyebrow":  { id: "Skema Kerja Sama", en: "Partnership Model" },
  "home.price.title":    { id: "Solusi Fleksibel Sesuai Skala Properti Anda", en: "A Flexible Fit for the Scale of Your Portfolio" },
  "home.price.sub":      { id: "Setiap properti memiliki kebutuhan operasional dan target okupansi yang berbeda. Konsultasikan kebutuhan Anda dengan tim kami untuk mendapatkan penawaran terbaik.", en: "Every property has its own operational needs and occupancy targets. Talk your requirements through with our team to get the right offer." },
  "home.price.badge":    { id: "Paket Kemitraan Pengelola", en: "Manager Partnership Package" },
  "home.price.headline": { id: "Penawaran Khusus — Kontak Kami", en: "Tailored Offer — Contact Us" },
  "home.price.desc":     { id: "Akses penuh sistem manajemen properti terintegrasi dengan katalog marketplace Cosystem untuk meningkatkan efisiensi dan tingkat hunian unit Anda.", en: "Full access to an integrated property management system alongside the Cosystem marketplace catalogue, to lift both efficiency and occupancy." },
  "home.price.f1":       { id: "Sistem manajemen ruang kerja & hunian terpadu", en: "A single management system for workspaces and homes" },
  "home.price.f2":       { id: "Kalender okupansi, pencatatan tagihan, dan laporan keuangan", en: "Occupancy calendar, invoice records and financial reports" },
  "home.price.f3":       { id: "Tayang di halaman Listing Marketplace Cosystem", en: "Published on the Cosystem Marketplace listing page" },
  "home.price.f4":       { id: "Pendampingan onboarding dan migrasi data awal oleh tim Cosystem", en: "Onboarding support and initial data migration by the Cosystem team" },
  "home.price.cta":      { id: "Kontak Kami untuk Penawaran", en: "Contact Us for an Offer" },

  // ── Homepage: closing banner ──────────────────────────────────────────────
  "home.cta.title":      { id: "Siap Mengelola dan Memonetisasi Properti Anda Lebih Efisien?", en: "Ready to Run and Monetise Your Property More Efficiently?" },
  "home.cta.sub":        { id: "Diskusikan kebutuhan pengelolaan workspace atau hunian Anda bersama tim Cosystem hari ini.", en: "Talk through what your workspace or property needs with the Cosystem team today." },
  "home.cta.secondary":  { id: "Cari Ruang Kerja & Hunian", en: "Find Workspaces & Homes" },

  // ── Listings index ────────────────────────────────────────────────────────
  "listings.ownerBanner": { id: "Punya ruang kerja atau hunian kosong? Kelola jadwal, tagihan, dan pasarkan unit Anda dalam satu platform bersama Cosystem.", en: "Have an empty workspace or home? Manage schedules and invoices and market your units on one platform with Cosystem." },
  "listings.title":       { id: "Semua Listing",   en: "All Listings" },
  "listings.sub":         { id: "Hanya properti terkurasi dan terverifikasi.", en: "Only verified, curated properties." },
  "listings.area":        { id: "Area",            en: "Area" },
  "listings.allAreas":    { id: "Semua Area",      en: "All Areas" },
  "listings.type":        { id: "Jenis Properti",  en: "Property Type" },
  "listings.allTypes":    { id: "Semua Jenis",     en: "All Types" },
  "listings.typeKost":    { id: "Kos",             en: "Kost" },
  "listings.typeApartment": { id: "Apartemen",     en: "Apartment" },
  "listings.typeHouse":   { id: "Rumah",           en: "House" },
  "listings.typeVilla":   { id: "Vila",            en: "Villa" },
  "listings.minPrice":    { id: "Harga Minimum (IDR)", en: "Min Price (IDR)" },
  "listings.maxPrice":    { id: "Harga Maksimum (IDR)", en: "Max Price (IDR)" },
  "listings.apply":       { id: "Terapkan Filter", en: "Apply Filters" },
  "listings.emptyTitle":  { id: "Tidak ada listing yang cocok", en: "No listings found" },
  "listings.emptyBody":   { id: "Coba longgarkan filter Anda untuk melihat lebih banyak hasil.", en: "Try adjusting your filters to see more results." },

  // ── Contact ───────────────────────────────────────────────────────────────
  "contact.metaTitle":    { id: "Kontak Kami — Cosystem", en: "Contact Us — Cosystem" },
  "contact.metaDesc":     { id: "Diskusikan kebutuhan pengelolaan ruang kerja atau hunian Anda bersama tim Cosystem.", en: "Talk through your workspace or property management needs with the Cosystem team." },
  "contact.title":        { id: "Diskusikan Kebutuhan Properti Anda", en: "Let's Talk About Your Property" },
  "contact.sub":          { id: "Ceritakan jenis aset dan jumlah unit Anda — ruang kerja, kos, rumah kontrakan, atau kombinasinya. Tim kami menyesuaikan konfigurasi sistemnya, termasuk membantu memindahkan data yang sudah ada.", en: "Tell us what you hold and how many units — workspaces, rooms, rental houses, or a mix. Our team configures the system to match, and helps move across the records you already keep." },
  "contact.registerTitle":{ id: "Daftarkan Properti Anda", en: "Register Your Property" },
  "contact.registerBody": { id: "Isi detail properti Anda dan tim kami menghubungi balik untuk membahas konfigurasi serta langkah onboarding.", en: "Fill in your property details and our team will come back to you about configuration and the onboarding steps." },
  "contact.registerCta":  { id: "Mulai Pendaftaran", en: "Start Registration" },
  "contact.talkTitle":    { id: "Bicara Langsung",  en: "Talk to Us Directly" },
  "contact.talkBody":     { id: "Punya pertanyaan sebelum mendaftar? Hubungi kami langsung.", en: "Questions before you register? Get in touch." },
  "contact.noChannels":   { id: "Silakan gunakan formulir pendaftaran properti di samping — tim kami akan menghubungi Anda balik.", en: "Please use the property registration form alongside — our team will come back to you." },
  "contact.renterTitle":  { id: "Mencari ruang kerja atau hunian untuk disewa?", en: "Looking for a workspace or a home to rent?" },
  "contact.renterBody":   { id: "Halaman ini untuk pemilik dan pengelola properti. Kalau Anda sedang mencari tempat, jelajahi unit yang tersedia.", en: "This page is for owners and managers. If you are looking for a place, browse what is available." },
  "contact.renterCta":    { id: "Lihat Listing Tersedia", en: "See Available Listings" },

  // ── Terms and privacy ─────────────────────────────────────────────────────
  "legal.terms.title":    { id: "Syarat & Ketentuan", en: "Terms & Conditions" },
  "legal.privacy.title":  { id: "Kebijakan Privasi", en: "Privacy Policy" },
  "legal.pending":        { id: "Dokumen ini sedang disiapkan dan akan diterbitkan di halaman ini.", en: "This document is being prepared and will be published on this page." },
  "legal.meanwhile":      { id: "Sementara itu, untuk pertanyaan mengenai ketentuan layanan atau penanganan data, silakan hubungi tim kami.", en: "In the meantime, please contact our team with any question about the terms of service or how data is handled." },

  // ── Consultation ──────────────────────────────────────────────────────────
  "consult.step":         { id: "Langkah 1 dari 3", en: "Step 1 of 3" },
  "consult.stepName":     { id: "Pilih Paket Konsultasi", en: "Consultation Selection" },
  "consult.title":        { id: "Pilih paket konsultasi Anda", en: "Choose your consultation package" },
  "consult.sub":          { id: "Kedua paket mencakup kunjungan virtual langsung bersama penasihat independen Cosystem. Dapatkan panduan ahli dari rumah Anda.", en: "Both packages include a live virtual walkthrough with an independent Cosystem advisor. Get expert guidance from the comfort of your home." },
  "consult.popular":      { id: "Paling Populer",  en: "Most Popular" },
  "consult.choose":       { id: "Pilih",           en: "Choose" },
  "consult.basic.f1":     { id: "Sesi konsultasi 30 menit", en: "30min consultation session" },
  "consult.basic.f2":     { id: "Kunjungan virtual langsung", en: "Live virtual walkthrough" },
  "consult.basic.f3":     { id: "Sesi tanya jawab langsung", en: "Direct Q&A session" },
  "consult.basic.f4":     { id: "Gambaran dasar area sekitar", en: "Basic area insights" },
  "consult.prem.f1":      { id: "Sesi menyeluruh 60 menit", en: "60min comprehensive session" },
  "consult.prem.f2":      { id: "Kunjungan virtual langsung", en: "Live virtual walkthrough" },
  "consult.prem.f3":      { id: "Laporan penilaian kecocokan", en: "Suitability assessment report" },
  "consult.prem.f4":      { id: "Gambaran mendalam lingkungan sekitar", en: "In-depth neighborhood insights" },
  "consult.prem.f5":      { id: "Saran properti alternatif", en: "Alternative property suggestions" },
  "consult.selectLabel":  { id: "Pilih properti yang ingin dikonsultasikan:", en: "Select a property to consult about:" },
  "consult.selectSaved":  { id: "Pilih dari listing tersimpan Anda", en: "Select from your saved listings" },
  "consult.browse":       { id: "Jelajahi listing", en: "Browse listings" },

  // ── Consultation: success ─────────────────────────────────────────────────
  "consultOk.title":      { id: "Pemesanan dikonfirmasi!", en: "Booking confirmed!" },
  "consultOk.lead":       { id: "Pembayaran diterima. Konsultasi Anda sudah terjadwal.", en: "Payment received. Your consultation is booked." },
  "consultOk.body":       { id: "Penasihat Cosystem akan menghubungi Anda dalam 24 jam untuk menjadwalkan sesi. Periksa email Anda untuk konfirmasinya.", en: "A Cosystem advisor will contact you within 24 hours to schedule your session. Check your email for the confirmation." },
  "consultOk.i1":         { id: "Penasihat menghubungi dalam 24 jam", en: "Advisor will reach out within 24 hours" },
  "consultOk.i2":         { id: "Sesi lewat Google Meet atau Zoom", en: "Session via Google Meet or Zoom" },
  "consultOk.i3":         { id: "Laporan dikirim lewat email setelah sesi (khusus Premium)", en: "Report emailed after session (Premium only)" },
  "consultOk.viewAppt":   { id: "Lihat Jadwal",    en: "View Appointment" },
  "consultOk.browseMore": { id: "Jelajahi Listing Lain", en: "Browse More Listings" },

  // ── Sign in ───────────────────────────────────────────────────────────────
  "login.title":          { id: "Selamat datang di Cosystem", en: "Welcome to Cosystem" },
  "login.sub":            { id: "Masuk untuk memesan, meminta kunjungan, dan memantau keduanya di satu tempat.", en: "Sign in to book a stay, request a viewing, and track both in one place." },
  "login.reasonBook":     { id: "Masuk untuk menyelesaikan pemesanan. Tanggal Anda masih tersedia.", en: "Sign in to finish booking. Your dates are still available." },
  "login.reasonViewing":  { id: "Masuk untuk meminta kunjungan.", en: "Sign in to request a viewing." },
  "login.listInstead":    { id: "Ingin mendaftarkan properti?", en: "Listing a property instead?" },
  "login.submitHere":     { id: "Daftarkan di sini", en: "Submit it here" },
  "login.tabSignIn":      { id: "Masuk",            en: "Sign in" },
  "login.tabSignUp":      { id: "Buat akun",        en: "Create account" },
  "login.fullName":       { id: "Nama lengkap",     en: "Full name" },
  "login.fullNamePh":     { id: "Nama Anda",        en: "Your name" },
  "login.email":          { id: "Email",            en: "Email" },
  "login.password":       { id: "Kata sandi",       en: "Password" },
  "login.passwordPh":     { id: "Minimal 8 karakter", en: "At least 8 characters" },
  "login.signingIn":      { id: "Sedang masuk…",    en: "Signing in…" },
  "login.creating":       { id: "Membuat akun…",    en: "Creating account…" },
  "login.or":             { id: "atau",             en: "or" },
  "login.google":         { id: "Lanjutkan dengan Google", en: "Continue with Google" },

  // ── List your property ────────────────────────────────────────────────────
  "listProp.title":       { id: "Daftarkan properti Anda", en: "List your property" },
  "listProp.sub":         { id: "Bergabunglah dengan marketplace terkurasi kami. Setiap listing kami verifikasi demi kualitas terbaik untuk penyewa — dan hasil terbaik untuk pemilik.", en: "Join our curated marketplace. We verify every listing to ensure the highest quality for tenants — and best outcomes for owners." },

  // ── Owner: no access ──────────────────────────────────────────────────────
  "owner.access.noInvite": { id: "Jika Anda pemilik properti dan belum menerima tautan undangan, hubungi tim Cosystem.", en: "If you own a property here and have not received an invite link, please contact the Cosystem team." },
  "owner.access.home":     { id: "Kembali ke beranda", en: "Back to home" },
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
