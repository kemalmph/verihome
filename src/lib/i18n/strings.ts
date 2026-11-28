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
  "owner.portal":          { id: "Portal Pemilik",       en: "Owner Portal" },
  "owner.short":           { id: "Pemilik",              en: "Owner" },
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
  "owner.invite.reissue": { id: "Tautan undangan ini dibuat dengan cara lama dan tidak bisa dipakai lagi. Minta tautan baru kepada tim Cosystem.", en: "This invite link was issued the old way and can no longer be used. Ask the Cosystem team for a new one." },
  "owner.invite.emailMismatch": { id: "Undangan ini untuk email lain. Masuk dengan email yang terdaftar sebagai pemilik.", en: "This invite is for a different email. Sign in with the email registered for the owner." },
  "owner.invite.emailUnconfirmed": { id: "Email akun Anda belum dikonfirmasi. Buka tautan konfirmasi di email Anda, lalu buka undangan ini lagi.", en: "Your account's email is not confirmed yet. Open the confirmation link in your email, then open this invite again." },
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

  // ── Navigation (homepage V7) ──────────────────────────────────────────────
  "nav.menu":            { id: "Menu",             en: "Menu" },
  "nav.sidebarCollapse": { id: "Ciutkan sidebar",  en: "Collapse sidebar" },
  "nav.sidebarExpand":   { id: "Lebarkan sidebar", en: "Expand sidebar" },
  "nav.contact":         { id: "Kontak Kami",      en: "Contact Us" },
  "nav.signIn":          { id: "Masuk",            en: "Sign In" },
  "nav.signUp":          { id: "Daftar",           en: "Sign Up" },
  "nav.account":       { id: "Akun Saya",        en: "My Account" },
  "nav.saved":           { id: "Unit Tersimpan",   en: "Saved Listings" },
  "nav.appointments":    { id: "Jadwal Kunjungan", en: "Appointments" },
  "nav.signOut":         { id: "Keluar",           en: "Sign Out" },
  "nav.product":         { id: "Produk",           en: "Product" },
  "nav.solutions":       { id: "Solusi",           en: "Solutions" },
  "nav.pricing":         { id: "Harga",            en: "Pricing" },
  "nav.resources":       { id: "Sumber Daya",      en: "Resources" },
  "nav.startTrial":      { id: "Coba Gratis",      en: "Start Free Trial" },
  "nav.p.features":      { id: "Fitur",            en: "Features" },
  "nav.p.featuresBlurb": { id: "Booking, member, event, pembayaran, dan lainnya", en: "Bookings, members, events, payments and more" },
  "nav.p.platform":      { id: "Platform",         en: "Platform" },
  "nav.p.platformBlurb": { id: "Dashboard operator dan aplikasi member", en: "The operator dashboard and the member app" },
  "nav.r.marketplace":   { id: "Marketplace",      en: "Marketplace" },
  "nav.r.marketplaceBlurb": { id: "Cari ruang kerja dan hunian yang tersedia", en: "Find available workspaces and homes" },
  "nav.r.listBlurb":     { id: "Tawarkan ruang Anda lewat Cosystem", en: "Offer your space through Cosystem" },
  "nav.r.contactBlurb":  { id: "Bicara dengan tim kami", en: "Talk to our team" },

  // ── Footer ────────────────────────────────────────────────────────────────
  "footer.listProperty": { id: "Daftarkan Properti", en: "List Your Property" },
  "footer.terms":        { id: "Syarat & Ketentuan", en: "Terms & Conditions" },
  "footer.privacy":      { id: "Kebijakan Privasi", en: "Privacy Policy" },
  "footer.rights":       { id: "Hak cipta dilindungi undang-undang.", en: "All rights reserved." },
  "footer.tagline":      { id: "Run Your Space.",  en: "Run Your Space." },
  "footer.product":      { id: "Produk",           en: "Product" },
  "footer.solutions":    { id: "Solusi",           en: "Solutions" },
  "footer.contact":      { id: "Kontak",           en: "Contact" },

  // ── Homepage (prototype V7) ───────────────────────────────────────────────
  // English is the owner's copy (COSYSTEM_COPYWRITING_V7). The Indonesian is
  // a translation of it; the tagline "Run Your Space." is a brand line and
  // stays English in both.
  "home.hero.eyebrow":   { id: "Dibuat untuk ruang modern", en: "Built for modern spaces" },
  "home.hero.title":     { id: "Run Your Space.",  en: "Run Your Space." },
  "home.hero.sub":       { id: "Platform all-in-one untuk mengelola workspace, member, booking, fasilitas, dan bisnis Anda.", en: "The all-in-one platform to manage your workspace, members, bookings, facilities, and business." },
  "home.hero.demo":      { id: "Lihat Demo",       en: "Watch Demo" },

  "home.feat.book.t":    { id: "Booking & Reservasi", en: "Bookings & Reservations" },
  "home.feat.book.d":    { id: "Kelola ruang rapat, meja, dan fasilitas dalam satu platform.", en: "Manage rooms, desks, and facilities in one platform." },
  "home.feat.member.t":  { id: "Manajemen Member", en: "Member Management" },
  "home.feat.member.d":  { id: "Data member, paket, dan akses tertata rapi.", en: "Keep member data, plans, and access well organized." },
  "home.feat.event.t":   { id: "Event & Komunitas", en: "Events & Community" },
  "home.feat.event.d":   { id: "Buat, kelola, dan promosikan event untuk komunitas Anda.", en: "Create, manage, and promote events for your community." },
  "home.feat.pay.t":     { id: "Pembayaran & Tagihan", en: "Payments & Billing" },
  "home.feat.pay.d":     { id: "Otomatiskan pembayaran, invoice, dan langganan berulang.", en: "Automate payments, invoicing, and recurring subscriptions." },
  "home.feat.space.t":   { id: "Ruang & Fasilitas", en: "Space & Facilities" },
  "home.feat.space.d":   { id: "Kelola ruang, amenitas, dan sumber daya secara efisien.", en: "Manage spaces, amenities, and resources efficiently." },
  "home.feat.store.t":   { id: "Etalase Ruang",    en: "Space Storefront" },
  "home.feat.store.d":   { id: "Buat halaman publik untuk menampilkan ruang, paket, dan menerima booking.", en: "Create your public page to showcase spaces, packages, and accept bookings." },

  "home.show.kicker":    { id: "Satu platform. Operasional lebih rapi.", en: "One platform. Better operations." },
  "home.show.title":     { id: "Kelola dan Kembangkan Workspace Anda dengan Mudah.", en: "Run and Grow Your Workspace with Ease." },
  "home.show.sub":       { id: "Dari manajemen member dan booking ruang hingga pembayaran dan event—Cosystem membantu Anda beroperasi lebih efisien, tetap tertata, dan tumbuh dengan percaya diri.", en: "From member management and space booking to payments and events—Cosystem helps you operate more efficiently, stay organized, and scale with confidence." },
  "home.show.c1":        { id: "Operasional harian lebih ringkas", en: "Streamline daily operations" },
  "home.show.c2":        { id: "Pengalaman member yang lebih baik", en: "Deliver a better member experience" },
  "home.show.c3":        { id: "Siap tumbuh bersama bisnis Anda", en: "Built to grow with your business" },
  "home.show.alt":       { id: "Dashboard Cosystem di laptop, di samping aplikasi member Cosystem di ponsel", en: "Cosystem workspace dashboard displayed on a laptop beside the Cosystem mobile app on a smartphone" },

  "home.models.kicker":  { id: "Fleksibel sejak awal", en: "Flexible by design" },
  "home.models.title":   { id: "Dirancang untuk Beragam Model Ruang", en: "Designed for Different Space Models" },
  "home.models.sub":     { id: "Platform fleksibel untuk operator ruang modern, dari coworking hingga serviced office, dengan dukungan untuk hunian seperti hostel dan co-living.", en: "A flexible platform for modern space operators, from coworking to serviced offices, with support for residential spaces such as hostels and co-living." },
  "home.models.tagWork": { id: "Workspace",        en: "Workspace" },
  "home.models.tagMixed":{ id: "Ruang serbaguna",  en: "Mixed-use spaces" },
  "home.models.tagLive": { id: "Hunian",           en: "Residential spaces" },
  "home.models.cowork.t":{ id: "Coworking Space",  en: "Coworking Space" },
  "home.models.cowork.d":{ id: "Meja fleksibel dan ruang kerja komunitas.", en: "Flexible desks and community workspaces." },
  "home.models.cowork.a":{ id: "Coworking space dengan orang-orang yang sedang berkolaborasi", en: "Coworking space with people collaborating" },
  "home.models.office.t":{ id: "Serviced Office",  en: "Serviced Office" },
  "home.models.office.d":{ id: "Kantor privat yang dikelola, dengan fasilitas siap pakai.", en: "Private and managed offices with ready-to-use facilities." },
  "home.models.office.a":{ id: "Deretan kantor privat kecil bersekat kaca", en: "Small private serviced offices with glass partitions" },
  "home.models.hub.t":   { id: "Creative Hub",     en: "Creative Hubs" },
  "home.models.hub.d":   { id: "Gabungan ruang kerja, event, dan ritel.", en: "Mixed workspace, event & retail spaces." },
  "home.models.hub.a":   { id: "Gedung creative hub dua lantai dengan workshop dan kegiatan komunitas", en: "A modest creative hub building with workshops and community activities" },
  "home.models.live.t":  { id: "Hostel & Co-living", en: "Hostel & Co-living" },
  "home.models.live.d":  { id: "Hunian terkelola untuk tinggal lebih lama dan fleksibel.", en: "Managed stays for longer and flexible living." },
  "home.models.live.a":  { id: "Kamar bersama hostel dan co-living yang hangat", en: "Warm hostel and co-living shared room" },
  "home.models.note":    { id: "Fokus utama kami adalah operator workspace. Hunian juga didukung.", en: "Workspace operators are our primary focus. Residential spaces are also supported." },

  "home.cta.title":      { id: "Mulai dengan Cosystem Hari Ini.", en: "Get Started with Cosystem Today." },
  "home.cta.sub":        { id: "Kelola ruang Anda lebih efisien dan kembangkan komunitas bersama Cosystem.", en: "Manage your space more efficiently and grow your community with Cosystem." },
  "home.cta.button":     { id: "Hubungi Kami",     en: "Let's Talk" },

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

  // ── Login modal (navbar) ──────────────────────────────────────────────────
  "modal.title":          { id: "Masuk untuk melanjutkan", en: "Sign in to continue" },
  "modal.sub":            { id: "Akses listing tersimpan dan konsultasi Anda.", en: "Access saved listings and consultations." },
  "modal.close":          { id: "Tutup",            en: "Close" },
  "modal.loading":        { id: "Memuat…",          en: "Loading…" },
  "modal.noAccount":      { id: "Belum punya akun?", en: "Don't have an account?" },
  "modal.hasAccount":     { id: "Sudah punya akun?", en: "Already have an account?" },

  // ── Listing card ──────────────────────────────────────────────────────────
  "card.curated":         { id: "Terkurasi",        en: "Curated" },
  "card.shortStay":       { id: "SEWA HARIAN",      en: "SHORT STAY" },
  "card.shortLong":       { id: "HARIAN + BULANAN", en: "SHORT + LONG" },
  "card.perMonth":        { id: "/ bulan",          en: "/ month" },
  "card.seeDetails":      { id: "Lihat Detail",     en: "See Details" },
  "card.save":            { id: "Simpan listing",   en: "Save listing" },
  "card.unsave":          { id: "Hapus dari tersimpan", en: "Unsave listing" },

  // ── Listing detail ────────────────────────────────────────────────────────
  "detail.home":          { id: "Beranda",          en: "Home" },
  "detail.listings":      { id: "Listing",          en: "Listings" },
  "detail.addressNote":   { id: "Alamat lengkap diberikan setelah pemesanan dikonfirmasi.", en: "The full address is shared once your booking is confirmed." },
  "detail.perMonth":      { id: "per bulan",        en: "per month" },
  "detail.beds":          { id: "Kamar tidur",      en: "Beds" },
  "detail.baths":         { id: "Kamar mandi",      en: "Baths" },
  "detail.minMonths":     { id: "Min",              en: "Min" },
  "detail.months":        { id: "bulan",            en: "months" },
  "detail.pros":          { id: "Kelebihan",        en: "Pros" },
  "detail.cons":          { id: "Kekurangan",       en: "Cons" },
  "detail.facilities":    { id: "Fasilitas & Aturan Rumah", en: "Facilities & House Rules" },
  "detail.included":      { id: "Termasuk",         en: "Included" },
  "detail.houseRules":    { id: "Aturan Rumah",     en: "House Rules" },
  "detail.areaOverview":  { id: "Gambaran Area",    en: "Area Overview" },
  "detail.minWalk":       { id: "menit jalan kaki", en: "min walk" },
  "detail.neighborhood":  { id: "lingkungan",       en: "neighborhood" },
  "detail.min":           { id: "menit",            en: "min" },
  "detail.expatFriendly": { id: "Ramah ekspatriat", en: "Expat-friendly" },
  "detail.propertyType":  { id: "Jenis properti",   en: "Property type" },
  "detail.size":          { id: "Luas",             en: "Size" },
  "detail.furnished":     { id: "Berperabot",       en: "Furnished" },
  "detail.yes":           { id: "Ya",               en: "Yes" },
  "detail.no":            { id: "Tidak",            en: "No" },
  "detail.guarantee":     { id: "Jaminan Cosystem", en: "Cosystem Guarantee" },
  "detail.guaranteeBody": { id: "Kami mengaudit setiap listing secara independen. Jika properti tidak sesuai penilaian RLA kami saat Anda tiba, deposit dikembalikan penuh.", en: "We independently audit every listing. If the property doesn't match our RLA assessment upon arrival, we offer a full deposit refund." },

  // ── RLA assessment ────────────────────────────────────────────────────────
  "rla.title":            { id: "Penilaian RLA",    en: "RLA Assessment" },
  "rla.tooltip":          { id: "Rental Lifestyle Audit — sistem penilaian independen kami", en: "Rental Lifestyle Audit — our independent scoring system" },
  "rla.team":             { id: "— Tim Penilai Cosystem", en: "— Cosystem Assessment Team" },
  "rla.building":         { id: "Kondisi Bangunan", en: "Building Condition" },
  "rla.lighting":         { id: "Pencahayaan Alami", en: "Natural Lighting" },
  "rla.ventilation":      { id: "Sirkulasi Udara",  en: "Ventilation" },
  "rla.noise":            { id: "Tingkat Kebisingan", en: "Noise Level" },
  "rla.cleanliness":      { id: "Kebersihan",       en: "Cleanliness" },
  "rla.security":         { id: "Keamanan",         en: "Security" },
  "rla.bathroom":         { id: "Kamar Mandi",      en: "Bathroom" },
  "rla.furniture":        { id: "Kualitas Perabot", en: "Furniture Quality" },

  // ── Booking options panel ─────────────────────────────────────────────────
  "book.longTerm":        { id: "Jangka Panjang",   en: "Long-term" },
  "book.shortStay":       { id: "Harian",           en: "Short Stay" },
  "book.startingFrom":    { id: "Mulai dari",       en: "Starting from" },
  "book.perMonthPlus":    { id: "per bulan + utilitas", en: "per month + utilities" },
  "book.minStay":         { id: "Sewa minimum",     en: "Min stay" },
  "book.month":           { id: "bulan",            en: "month" },
  "book.monthPlural":     { id: "bulan",            en: "months" },
  "book.consult":         { id: "Pesan Konsultasi", en: "Book a Consultation" },
  "book.consultSub":      { id: "Dapatkan saran independen sebelum memutuskan", en: "Get independent advice before you commit" },
  "book.viewing":         { id: "Minta Kunjungan",  en: "Request a Viewing" },
  "book.viewingSub":      { id: "Jadwalkan kunjungan langsung", en: "Schedule a physical visit" },
  "book.nightlyRate":     { id: "Tarif per malam",  en: "Nightly rate" },
  "book.weekend":         { id: "Akhir pekan",      en: "Weekend" },
  "book.cleaningFee":     { id: "biaya kebersihan", en: "cleaning fee" },
  "book.minNights":       { id: "Malam minimum",    en: "Min nights" },
  "book.maxNights":       { id: "Malam maksimum",   en: "Max nights" },
  "book.instantAvail":    { id: "Pemesanan instan tersedia", en: "Instant booking available" },
  "book.bookNow":         { id: "Pesan Sekarang",   en: "Book Now" },
  "book.instantConfirm":  { id: "Konfirmasi instan", en: "Instant confirmation" },
  "book.adminConfirm":    { id: "Permintaan — admin mengonfirmasi dalam 24 jam", en: "Request — admin confirms within 24h" },
  "book.noRates":         { id: "Tarif harian belum diatur untuk properti ini.", en: "Short-stay rates not yet configured for this property." },

  // ── Photo gallery ─────────────────────────────────────────────────────────
  "gallery.exterior":     { id: "Eksterior",        en: "Exterior" },
  "gallery.commonArea":   { id: "Area Bersama",     en: "Common Area" },
  "gallery.unit":         { id: "Unit",             en: "Unit" },
  "gallery.bathroom":     { id: "Kamar Mandi",      en: "Bathroom" },
  "gallery.all":          { id: "Semua",            en: "All" },
  "gallery.close":        { id: "Tutup",            en: "Close" },
  "gallery.previous":     { id: "Sebelumnya",       en: "Previous" },
  "gallery.next":         { id: "Berikutnya",       en: "Next" },
  "flow.continue":        { id: "Lanjut",           en: "Continue" },
  "flow.weeks":           { id: "minggu",           en: "weeks" },
  "flow.backToListing":   { id: "Kembali ke listing", en: "Back to listing" },
  "gallery.video":        { id: "Tonton Video",     en: "Watch Video" },

  // ── Viewing request flow ──────────────────────────────────────────────────
  "view.stepSchedule":    { id: "Jadwal",           en: "Schedule" },
  "view.stepConfirm":     { id: "Konfirmasi",       en: "Confirm" },
  "view.stepPayment":     { id: "Pembayaran",       en: "Payment" },
  "view.s1title":         { id: "1. Pilih tanggal & waktu", en: "1. Choose a date & time" },
  "view.prefDate":        { id: "Tanggal yang diinginkan", en: "Preferred date" },
  "view.prefTime":        { id: "Waktu yang diinginkan", en: "Preferred time" },
  "view.notes":           { id: "Catatan (opsional)", en: "Notes (optional)" },
  "view.notesPh":         { id: "Ada pertanyaan khusus atau kebutuhan aksesibilitas?", en: "Any specific questions or accessibility needs?" },
  "view.depositRequired": { id: "Deposit yang diperlukan:", en: "Deposit required:" },
  "view.depositNote":     { id: "Jika hadir, deposit menjadi kredit Cosystem — bukan uang kembali. Ketentuan lengkap di langkah berikutnya.", en: "If you attend, the deposit becomes Cosystem credit — not a cash refund. Full terms on the next step." },
  "view.s2title":         { id: "2. Konfirmasi permintaan kunjungan", en: "2. Confirm viewing request" },
  "view.date":            { id: "Tanggal",          en: "Date" },
  "view.time":            { id: "Waktu",            en: "Time" },
  "view.deposit":         { id: "Deposit",          en: "Deposit" },
  "view.notesShort":      { id: "Catatan",          en: "Notes" },
  "view.ack":             { id: "Saya mengerti deposit menjadi kredit jika saya hadir, dan menyetujui ketentuan di atas.", en: "I understand the deposit becomes credit if I attend, and I accept the terms above." },
  "view.back":            { id: "Kembali",          en: "Back" },
  "view.submitting":      { id: "Mengirim…",        en: "Submitting…" },
  "view.submit":          { id: "Kirim & dapatkan detail pembayaran", en: "Submit & get payment details" },
  "view.requested":       { id: "Kunjungan diminta!", en: "Viewing requested!" },
  "view.requestedSub":    { id: "Kami akan mengonfirmasi slot Anda dalam 24 jam.", en: "We'll confirm your slot within 24 hours." },
  "view.payNow":          { id: "Bayar deposit Anda sekarang:", en: "Pay your deposit now:" },
  "view.bank":            { id: "Bank",             en: "Bank" },
  "view.account":         { id: "Rekening",         en: "Account" },
  "view.accountName":     { id: "Atas nama",        en: "Name" },
  "view.transferExactly": { id: "Transfer tepat",   en: "Transfer exactly" },
  "view.myViewings":      { id: "Lihat kunjungan saya", en: "View my viewings" },
  "common.error":         { id: "Terjadi kesalahan. Silakan coba lagi.", en: "Something went wrong. Please try again." },

  // ── Viewing deposit policy ────────────────────────────────────────────────
  "policy.title":         { id: "Ketentuan deposit viewing", en: "Viewing deposit terms" },
  "policy.credit":        { id: "kredit",           en: "credit" },
  "policy.cash":          { id: "uang",             en: "cash" },
  "policy.partial":       { id: "50%",              en: "50%" },
  "policy.forfeit":       { id: "hangus",           en: "forfeited" },

  "view.introA":          { id: "Minta kunjungan langsung. Deposit sebesar", en: "Request a physical viewing. A deposit of" },
  "view.introB":          { id: "mengunci slot Anda. Jika Anda hadir, deposit menjadi kredit Cosystem, bukan uang kembali — ketentuan lengkapnya ditampilkan sebelum Anda membayar.", en: "confirms your slot. If you attend it becomes Cosystem credit rather than a cash refund — the full terms are shown before you pay." },

  // ── Short-stay booking flow ───────────────────────────────────────────────
  "bf.stepDates":         { id: "Pilih tanggal",    en: "Select dates" },
  "bf.stepConfirm":       { id: "Konfirmasi",       en: "Confirm" },
  "bf.stepPayment":       { id: "Pembayaran",       en: "Payment" },
  "bf.s1title":           { id: "1. Pilih tanggal menginap", en: "1. Select your dates" },
  "bf.checkIn":           { id: "Check-in",         en: "Check-in" },
  "bf.checkOut":          { id: "Check-out",        en: "Check-out" },
  "bf.guests":            { id: "Jumlah tamu",      en: "Guests" },
  "bf.min":               { id: "Min",              en: "Min" },
  "bf.max":               { id: "Maks",             en: "Max" },
  "bf.night":             { id: "malam",            en: "night" },
  "bf.nights":            { id: "malam",            en: "nights" },
  "bf.calculating":       { id: "Menghitung…",      en: "Calculating…" },
  "bf.checkPrice":        { id: "Cek ketersediaan & harga", en: "Check availability & price" },
  "bf.quoteError":        { id: "Tidak bisa mengambil harga. Silakan coba lagi.", en: "Could not fetch price. Please try again." },
  "bf.months":            { id: "bulan",            en: "months" },
  "bf.cleaningFee":       { id: "Biaya kebersihan", en: "Cleaning fee" },
  "bf.securityDeposit":   { id: "Jaminan",          en: "Security deposit" },
  "bf.refundable":        { id: "(dapat dikembalikan)", en: "(refundable)" },
  "bf.totalToPay":        { id: "Total dibayar",    en: "Total to pay" },
  "bf.s2title":           { id: "2. Konfirmasi pemesanan Anda", en: "2. Confirm your booking" },
  "bf.nightsLabel":       { id: "Malam",            en: "Nights" },
  "bf.subtotal":          { id: "Subtotal",         en: "Subtotal" },
  "bf.depositRefundable": { id: "Jaminan (dapat dikembalikan)", en: "Security deposit (refundable)" },
  "bf.totalTransfer":     { id: "Total ditransfer", en: "Total to transfer" },
  "bf.agree":             { id: "Dengan mengonfirmasi, Anda setuju membayar lewat transfer bank. Detailnya ditampilkan di layar berikutnya.", en: "By confirming, you agree to pay via bank transfer. Details will be shown on the next screen." },
  "bf.back":              { id: "Kembali",          en: "Back" },
  "bf.creating":          { id: "Membuat pemesanan…", en: "Creating booking…" },
  "bf.confirmGet":        { id: "Konfirmasi & dapatkan detail pembayaran", en: "Confirm & get payment details" },
  "bf.requested":         { id: "Pemesanan diminta!", en: "Booking requested!" },
  "bf.code":              { id: "Kode:",            en: "Code:" },
  "bf.completePayment":   { id: "Selesaikan pembayaran Anda:", en: "Complete your payment:" },
  "bf.transferBefore":    { id: "Transfer sebelum", en: "Transfer before" },
  "bf.expiryNote":        { id: "Lewat batas waktu ini, pemesanan otomatis dibatalkan dan tanggalnya dilepas untuk tamu lain.", en: "After this time the booking is cancelled automatically and the dates are released to other guests." },
  "bf.afterTransfer":     { id: "Setelah transfer, unggah bukti pembayaran Anda di", en: "After transferring, upload your payment proof in" },
  "bf.afterTransfer2":    { id: "Kami konfirmasi dalam 24 jam.", en: "We'll confirm within 24 hours." },
  "bf.myBookings":        { id: "Pemesanan Saya",   en: "My Bookings" },
  "bf.viewBookings":      { id: "Lihat pemesanan saya", en: "View my bookings" },

  // ── Consultation booking form ─────────────────────────────────────────────
  "cf.paidWithCredit":    { id: "Lunas dengan kredit", en: "Paid in full with credit" },
  "cf.paidWithCreditSub": { id: "Tidak ada yang perlu ditransfer.", en: "Nothing left to transfer." },
  "cf.creditUsed":        { id: "Kredit terpakai:",   en: "Credit applied:" },
  "cf.contact24":         { id: "Tim kami menghubungi Anda dalam 24 jam untuk menjadwalkan sesi.", en: "Our team contacts you within 24 hours to schedule the session." },
  "cf.reserved":          { id: "Konsultasi dipesan", en: "Consultation reserved" },
  "cf.reservedSub":       { id: "Selesaikan transfer untuk mengonfirmasi sesi Anda.", en: "Complete the transfer to confirm your session." },
  "cf.confirmNote":       { id: "Tim kami mengonfirmasi transfer dan menghubungi Anda dalam 24 jam untuk menjadwalkan sesi.", en: "Our team confirms the transfer and contacts you within 24 hours to schedule the session." },
  "cf.package":           { id: "Paket",              en: "Package" },
  "cf.session":           { id: "sesi",               en: "session" },
  "cf.propertyToDiscuss": { id: "Properti yang ingin dibahas", en: "Property to discuss" },
  "cf.optional":          { id: "(opsional)",         en: "(optional)" },
  "cf.generalConsult":    { id: "Konsultasi umum (tanpa properti tertentu)", en: "General consultation (no specific property)" },
  "cf.questions":         { id: "Pertanyaan atau catatan", en: "Questions or notes" },
  "cf.questionsPh":       { id: "misalnya: Saya pindah dari Singapura bulan Agustus, mencari tempat dekat SCBD…", en: "e.g. I'm relocating from Singapore in August, looking for a place near SCBD..." },
  "cf.useCredit":         { id: "Pakai kredit Cosystem saya —", en: "Use my Cosystem credit —" },
  "cf.available":         { id: "tersedia",           en: "available" },
  "cf.creditOrder":       { id: "Kredit yang paling dekat kedaluwarsa dipakai lebih dulu.", en: "Credit closest to expiring is used first." },
  "cf.orderSummary":      { id: "Ringkasan Pesanan",  en: "Order Summary" },
  "cf.consultation":      { id: "Konsultasi",         en: "Consultation" },
  "cf.cosystemCredit":    { id: "Kredit Cosystem",    en: "Cosystem credit" },
  "cf.total":             { id: "Total",              en: "Total" },
  "cf.recomputed":        { id: "Jumlah akhir dihitung ulang oleh server saat konfirmasi.", en: "The final amount is recomputed by the server on confirmation." },
  "cf.creating":          { id: "Membuat pembayaran…", en: "Creating payment…" },
  "cf.payConfirm":        { id: "Bayar & Konfirmasi Pemesanan", en: "Pay & Confirm Booking" },
  "cf.footnote":          { id: "Detail pembayaran muncul di langkah berikutnya · Penasihat Anda menghubungi dalam 24 jam setelah pembayaran.", en: "Payment details appear on the next step · Your advisor will contact you within 24 hours after payment." },
  "cf.viewAppointments":  { id: "Lihat jadwal saya",  en: "View my appointments" },

  // ── List-your-property form ───────────────────────────────────────────────
  "lp.received":          { id: "Pengajuan diterima!", en: "Submission received!" },
  "lp.receivedBody":      { id: "Kami sudah mengirim konfirmasi ke email Anda. Tim kami akan menghubungi dalam 2 hari kerja untuk menjadwalkan inspeksi RLA.", en: "We've sent a confirmation to your email. Our team will reach out within 2 business days to schedule your RLA inspection." },
  "lp.another":           { id: "Daftarkan properti lain", en: "Submit another property" },
  "lp.propertyName":      { id: "Nama Properti *",    en: "Property Name *" },
  "lp.propertyNamePh":    { id: "misalnya: 2BR Modern di Senayan", en: "e.g. Modern 2BR in Senayan" },
  "lp.city":              { id: "Kota *",             en: "City *" },
  "lp.selectCity":        { id: "Pilih kota",         en: "Select city" },
  "lp.neighborhood":      { id: "Area *",             en: "Neighborhood *" },
  "lp.selectNeighborhood":{ id: "Pilih area",         en: "Select neighborhood" },
  "lp.address":           { id: "Alamat *",           en: "Address *" },
  "lp.addressPh":         { id: "misalnya: Jl. Kemang Raya No. 12, Jakarta Selatan", en: "e.g. Jl. Kemang Raya No. 12, Jakarta Selatan" },
  "lp.mapsUrl":           { id: "Tautan Lokasi Google Maps", en: "Google Maps Location URL" },
  "lp.propertyType":      { id: "Jenis Properti *",   en: "Property Type *" },
  "lp.selectType":        { id: "Pilih jenis",        en: "Select type" },
  "lp.apartment":         { id: "Apartemen",          en: "Apartment" },
  "lp.kost":              { id: "Kos",                en: "Kost" },
  "lp.house":             { id: "Rumah",              en: "House" },
  "lp.bedrooms":          { id: "Kamar Tidur *",      en: "Bedrooms *" },
  "lp.studio":            { id: "Studio",             en: "Studio" },
  "lp.bathrooms":         { id: "Kamar Mandi *",      en: "Bathrooms *" },
  "lp.monthlyRent":       { id: "Sewa Bulanan (IDR) *", en: "Monthly Rent (IDR) *" },
  "lp.size":              { id: "Luas (m²)",          en: "Size (m²)" },
  "lp.description":       { id: "Deskripsi",          en: "Description" },
  "lp.descriptionPh":     { id: "Ceritakan tentang properti Anda — apa yang membuatnya istimewa?", en: "Tell us about your property — what makes it special?" },
  "lp.ownerDetails":      { id: "Data Pemilik",       en: "Owner Details" },
  "lp.fullName":          { id: "Nama Lengkap *",     en: "Full Name *" },
  "lp.fullNamePh":        { id: "Nama lengkap Anda",  en: "Your full name" },
  "lp.emailLabel":        { id: "Email *",            en: "Email *" },
  "lp.whatsapp":          { id: "Nomor WhatsApp *",   en: "WhatsApp Number *" },
  "lp.submitting":        { id: "Mengirim…",          en: "Submitting…" },
  "lp.submit":            { id: "Daftarkan Properti", en: "Submit Property" },
  "lp.footnote":          { id: "Tim kami meninjau pengajuan Anda dan menghubungi dalam 2 hari kerja.", en: "Our team will review your submission and contact you within 2 business days." },
  "lp.rentPh":            { id: "mis. 6500000",     en: "e.g. 6500000" },
  "lp.sizePh":            { id: "mis. 45",          en: "e.g. 45" },
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
