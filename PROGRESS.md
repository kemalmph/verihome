# Progres

Posisi terakhir pekerjaan, untuk disambung session berikutnya.
Dokumen pendamping: `AGENTS.md` (aturan), `HANDOFF.md` (catatan teknis yang
lebih dalam), `ROADMAP.md` (fitur yang belum ada).

Terakhir diperbarui: 2026-11-26 · branch kerja `claude/bold-cerf-luyq4o`
(tugas kecil pra-Fase 2: createUser fail-closed + hapus hook email; Fase 1 sudah di produksi). Posisi sebenarnya selalu dari `git log -15 --oneline` —
hash yang ditulis tangan di sini akan basi pada commit berikutnya.

---

## Ringkasan project

**Cosystem** (dulu VeriHome) — satu sistem untuk dua bisnis yang berbagi
pembukuan:

1. **Site management** (`/site`) — coworking dan ruang sewa. Site, unit,
   reservasi anti-bentrok, membership, kalender event, amenity, konsumsi.
2. **Marketplace** (`/listings`, `/admin`) — properti hunian: listing
   terkurasi, penilaian RLA independen, booking harian dan sewa jangka
   panjang, portal pemilik.

Keduanya memposting ke satu buku besar berpasangan (`ledger_entries`) yang
bersifat *append-only*: koreksi dilakukan dengan jurnal balik, bukan edit.

Stack: Next.js 16.2.9 (App Router, Turbopack) · React 19.2 · Supabase/Postgres
17 · Tailwind 4 · deploy Vercel · domain `cosystem.co`.

Situs publik dwibahasa (ID/EN) lewat cookie; admin dan portal pemilik masih
sebagian besar Indonesia.

---

## Dokumen referensi: VeriHome System Reference

<https://claude.ai/artifact/B9WY3ErwkBzWGoY7WRkmJf>

Referensi arsitektur 20 bagian — topologi, model data, identitas, intake,
booking, penjaga double-booking, buku besar, pelaporan, portal pemilik, lalu
§19 jebakan produksi dan §20 risiko terbuka. Nomor bagian yang muncul di
komentar kode dan pesan commit (§8, §12, §13, §19.7, §19.9, §20) menunjuk ke
sini. **Baca lebih dulu** kalau menyentuh subsistem yang belum dikenal.

⚠ **Read-only.** `AGENTS.md`: jangan mengubah, menerbitkan ulang, atau
mengeditnya kecuali owner memintanya **di session itu juga** — termasuk kalau
catatan handoff bilang "jaga tetap sinkron". Kalau menemukan sesuatu yang
pantas masuk, **sebutkan di chat beserta nomor bagiannya** dan biarkan
dokumennya. Owner yang memutuskan.

**Diperbarui 2026-11-23 (versi 20), atas permintaan owner.** Yang masuk:

- **Masthead** — produknya kini Cosystem di `cosystem.co`; nama lama bertahan
  di repo, project Supabase, bucket R2, dan judul dokumen ini, karena menamai
  ulang semua itu adalah migrasi tersendiri.
- **§01** — klaim ISR 60 detik dicabut: sejak root layout membaca cookie
  bahasa, semua rute dinamis dan tidak ada halaman statis.
- **§02** — sepuluh tabel sisi coworking masuk, sebagai graf paralel yang
  bertemu marketplace hanya di `owners` dan `ledger_entries`.
- **§13** — `revenue_coworking` dan `revenue_membership`, enam jenis
  peristiwa baru, dan aturan pengakuan per bulan keanggotaan lengkap dengan
  dua jebakan aritmetikanya (tanggal 31, sisa pembulatan).
- **§19.14–19.17** — empat jebakan baru: kontrol mati sebelum hidrasi;
  `REVOKE FROM PUBLIC` tidak cukup di Supabase; `<details>` tertutup tetap
  punya kotak tata letak; dan dua kebiasaan verifikasi yang tidak
  membuktikan apa pun.
- **§20.4 ditutup**, **§20.6 diverifikasi ulang** (lihat di bawah), dan dua
  risiko baru: **§20.7** bagi hasil site pihak ketiga, **§20.8** refund
  membership dan cicilan.
- **§21 Sites & coworking** dan **§22 Bilingual interface** — bagian baru.
  Dinomori 21 dan 22, bukan disisipkan di tempat yang secara tema lebih
  cocok, karena §1–§20 dirujuk lewat nomor dari komentar kode dan dari
  dokumen itu sendiri; menomori ulang akan memutus semua penunjuk itu
  diam-diam.

⚠ **Catatan ketidakcocokan yang belum dibereskan.** Beberapa komentar migrasi
menulis "§19.9" untuk aturan *CHECK diperlebar lewat DROP lalu ADD*, padahal
§19.9 di dokumen adalah "Booking expiry never worked". Nomor di komentar kode
itu kemungkinan merujuk versi dokumen yang berbeda. Belum saya ubah — mengubah
nomor rujukan di seluruh migrasi perlu pengecekan satu per satu, dan salah
menebak lebih buruk daripada ketidakcocokan yang tercatat.

---

## Selesai

- **Tugas kecil sebelum Fase 2** (26 Nov, branch `claude/bold-cerf-luyq4o`,
  PR #2 di-merge, migration diterapkan ke produksi).
  - `createAdminUser` fail-closed: peran staf hanya diberikan kalau form
    mengirim `role` secara eksplisit dan valid; tanpa field / field kosong =
    user biasa, tanpa baris `staff_roles`. Tidak ada default "superadmin" dan
    field lama `is_admin` tidak dibaca lagi. `CreateUserForm` tidak pernah
    mengirim role; `CreateAdminForm` kini wajib memilih peran (default "Choose a
    role…", bukan Superadmin).
  - Migration `20261126180000_drop_admin_email_hook.sql`: hapus
    `trg_set_admin_flag` + `set_admin_flag()`. Baris `staff_roles` yang ada tidak
    disentuh. **Diterapkan ke produksi 26 Nov atas persetujuan owner** (MCP `apply_migration`); terverifikasi: trigger dan fungsi 0, superadmin tetap 2.
  - Akibat: suite UI yang login sebagai `admin@verihome.id` tidak lagi dapat
    superadmin otomatis. Pakai `node scripts/seed-test-admin.js` (lokal saja,
    menolak URL non-lokal) setelah `db reset`.
  - `test-staff-permissions` 809 check (+ kasus fail-closed, + hook sudah
    hilang dan mendaftar sebagai `admin@verihome.id` tak memberi peran). Semua
    16 suite hijau di DB lokal bersih. `test-booking-concurrency` butuh
    `DATABASE_URL` dan user dengan UUID produksi yang di-hardcode di skrip
    (`208b897e-…`) — di DB lokal buat dulu user dengan id itu.

- **Fase 1 peran & izin staf** (26 Nov, branch `claude/beautiful-clarke-24zrhl`).
  `users.is_admin` / `is_surveyor` diganti peran berbasis izin. **Migration
  `20261126120000_staff_roles.sql` sudah diterapkan ke produksi** (26 Nov, atas
  persetujuan owner, lewat MCP `apply_migration`). Terverifikasi: 2 admin
  produksi kini superadmin, RLS aktif, anon tanpa EXECUTE. Login dengan kode
  baru belum dicek — cek `/admin` setelah deploy Vercel.
  - Tabel `staff_roles` (superadmin, admin_general, admin_listings,
    admin_finance, surveyor) dan `site_staff` (dipakai Fase 3); RLS aktif tanpa
    policy, hanya service_role. Backfill: is_admin → superadmin,
    is_surveyor → surveyor. Kolom lama **tidak dihapus** dan sekarang beku:
    tidak ada kode/policy yang membacanya, jadi mengubahnya tidak berefek.
  - Fungsi `has_staff_role`, `has_staff_permission`, `has_any_staff_permission`
    (SECURITY DEFINER, search_path tetap, EXECUTE dicabut dari PUBLIC/anon) +
    `staff_role_permissions(role)`. Enam policy RLS yang membaca `is_admin`
    dipindah ke fungsi itu dan jadi `TO authenticated` (bukan `TO public`,
    supaya anon tidak kena "permission denied" saat policy dievaluasi).
  - `set_admin_flag()` (hook email `admin@verihome.id`) kini trigger AFTER
    INSERT yang menulis `staff_roles` superadmin, bukan `is_admin`.
  - Kode: `src/lib/auth/permissions.ts` (satu peta peran → izin, 13 izin),
    `guards.ts` (`getViewer` → peran + izin; `requirePermission`,
    `requireAnyPermission`, `requirePermissionOrRedirect`; `requireAdmin` jadi
    alias superadmin-saja, tak ada pemanggil lagi). Setiap action, route, dan
    **halaman** `/admin`, `/site`, `/survey` memeriksa izinnya sendiri.
  - Aksi di user yang punya peran staf butuh `staff.manage` (bukan hanya
    `users.manage`) — kalau tidak, admin_general bisa ganti email lalu reset
    password superadmin. Tidak bisa mencabut superadmin sendiri / yang terakhir.
  - Halaman Users: dua kolom toggle diganti satu kolom chip peran
    (hanya superadmin yang bisa mengubah).
  - Tes baru `scripts/test-staff-permissions.js` (800 check): peta peran
    (spec = permissions.ts = SQL), 57 action × 6 peran, 19 route × 7 pemanggil,
    26 halaman × 6 peran, skenario eskalasi, RLS, grant. Semua suite lama
    hijau di DB lokal bersih.
  - Celah yang ditemukan dan ditutup di jalan: `listCronRuns` tanpa guard sama
    sekali (callable siapa pun yang login); halaman `/survey` terbuka untuk
    staf tanpa `surveys.input`; `PATCH /api/bookings/[id]` jalur non-admin tidak
    memeriksa kepemilikan booking; `/api/admin/reports/export?type=my_statement`
    (ekspor milik tamu) selalu 401 karena `getViewer` null untuk non-staf.

- **Sidebar desktop admin, `/site`, portal pemilik, dan dashboard penyewa
  (`/dashboard`) bisa diciutkan** (24 Nov)
  jadi rail ikon 72px. Status di cookie `cosystem_sidebar`, dibaca root layout
  ke `<html data-sidebar>`, jadi HTML pertama dari server sudah selebar yang
  dipilih. Lebar aside dan margin halaman sama-sama dari variabel CSS
  `--sidebar-w` (semua `md:ml-64` → `md:ml-(--sidebar-w)`). Tombolnya `<form>`
  + server action, jadi bekerja tanpa JavaScript; setelah hidrasi, diproses di
  browser tanpa round trip. Laci ponsel tidak ikut menciut. Tes:
  `scripts/test-sidebar-collapse.js` (53 check, `/admin` dan `/dashboard`,
  dengan & tanpa JS). `DashboardSidebar` sekalian dapat laci ponsel — dulu
  aside 288px selalu tampil dan sebagian halaman memakai `ml-72` tanpa `md:`,
  jadi di ponsel menu menutupi layar dan konten terdorong keluar. Lebarnya
  pakai variabel sendiri `--dash-sidebar-w` (18rem), bukan `--sidebar-w`.

- **VeriHome System Reference diperbarui ke versi 20** (23 Nov) atas
  permintaan owner: §21 dan §22 baru, §13 dan §19 diperluas, §20.4 ditutup,
  §20.6 diverifikasi ulang, dua risiko baru dicatat.

- **Modul site/coworking** — `sites`, `lettable_units`, `unit_reservations`
  dengan exclusion constraint + advisory lock (tidak bisa double-booking),
  cicilan, penyewa luring tanpa akun, membership + plan, kalender event,
  amenity, item konsumsi, upload dokumen kontrak ke R2 privat.
- **Register Co&co Lokalima diimpor ke produksi** — 1 site, 14 unit, 2
  reservasi, 3 cicilan. Registernya sendiri **tidak ada di repo dan tidak
  boleh dimasukkan** (repo publik, berisi data penyewa).
- **Iuran membership masuk buku besar, per bulan keanggotaan** — jadwal
  `membership_periods` berjangkar pada tanggal mulai; pembayaran jadi
  kewajiban (`unearned_revenue`), dilepas satu bulan setiap kali bulan itu
  selesai dilayani (`revenue_membership`).
- **Pengamanan fungsi uang** — 21 fungsi (`post_ledger_entries`, semua
  `settle_*`, `create_*_if_available`) dicabut dari `PUBLIC`, `anon`, dan
  `authenticated`; hanya `service_role`. Sebelumnya `anon` bisa memanggilnya
  dan hanya ditahan RLS.
- **Cutover domain `cosystem.co`** — zone Cloudflare aktif, nameserver pindah
  dari Vultr, apex 308 → `www`, TLS valid.
- **Halaman depan ditulis ulang** dan enam klaim yang belum ada dihapus,
  dicatat di `ROADMAP.md`.
- **Sakelar bahasa EN/ID benar-benar bekerja** — sebelumnya `useState` yang
  tidak terhubung ke apa pun. 15 halaman publik diterjemahkan penuh, 529
  kunci string.
- **Perbaikan sebelum hidrasi** — sakelar bahasa, menu header ponsel, dan
  laci sidebar admin/pemilik semuanya kini bekerja tanpa JavaScript. Tombol
  Masuk/Daftar jadi tautan biasa, dan labelnya cocok dengan form yang terbuka.
- **Keamanan login** — form login dulu menaruh password di query string
  sebelum hidrasi (`method="get"` default HTML). Sudah `method="post"`.
- **Akses admin produksi** untuk `kemalmph@yahoo.com`.

Tes: 13 suite, ±434 check, semua hijau di DB lokal bersih.

---

## Sedang dikerjakan

Collapse sidebar (termasuk `/dashboard`) sudah di-merge ke `main` atas
permintaan owner. Container ini tidak bisa membuka `cosystem.co` (proxy
menolak) dan repo tidak punya GitHub Actions, jadi status deploy Vercel
**belum diverifikasi dari sini** — cek di dashboard Vercel bahwa commit
terbaru Ready · Current.

Temuan yang belum dibereskan di `/dashboard`: tautan "Profile Settings" menuju
`/dashboard/settings`, yang tidak ada (404); badge "1" di Appointments dan
angka di halaman ringkasan masih data placeholder.

---

## Berikutnya

Urut prioritas:

0. **Fase 1 peran staf: pastikan deploy Vercel Ready dan `kemalmph@yahoo.com`
   bisa masuk `/admin`.** Lalu Fase 2 (dashboard per peran)
   dan Fase 3 (`site_staff`). Migration terpisah nanti: hapus kolom
   `is_admin`/`is_surveyor`.

1. **Putuskan pengembalian dana membership.** Jenis peristiwa
   `membership_refund_issued` sudah ada di daftar, fungsinya belum —
   berapa yang dikembalikan saat keanggotaan dibatalkan adalah kebijakan yang
   belum ditulis. Memblokir pembatalan yang jujur di pembukuan.
2. **Putuskan cicilan (`reservation_instalments`) masuk buku besar atau
   tidak.** Keputusan akuntansi yang sejenis dengan membership dan sekarang
   punya pola untuk diikuti.
3. **Putuskan bagi hasil site pihak ketiga.** Selama belum ada, setiap rupiah
   reservasi dan membership diakui sebagai pendapatan Cosystem sendiri — benar
   untuk site milik sendiri, **salah** untuk site yang dikelola untuk orang
   lain. Ini juga yang memblokir unit coworking tayang di marketplace.
4. **Ganti 12 harga bertanda ESTIMASI dengan harga sebenarnya**, termasuk
   ruang rapat RO12 (Rp150.000/jam) yang murni tebakan pasar.
5. **Rapikan fixture `test-coworking-admin`** supaya idempoten. Sekarang tiap
   kali gagal di tengah ia meninggalkan data yang hanya bisa dibersihkan
   dengan `supabase db reset` penuh, karena buku besarnya append-only.

---

## Keputusan penting & alasannya

- **Membership diakui per bulan keanggotaan, bukan bulan kalender.** Keduanya
  berbeda uang sungguhan di tiap akhir periode. Yang penting bukan mana yang
  benar secara umum, tapi memilih satu dan tidak pernah mencampurnya — dan
  mencampurnya persis yang terjadi kalau tidak ada apa pun di skema yang
  menyatakan mana.
- **Bahasa disimpan di cookie, bukan segmen URL.** Alternatifnya memindahkan
  seluruh rute ke `app/[lang]/`, yang memberi URL `/en` bisa dibagikan dan
  diindeks terpisah, dengan ongkos menulis ulang setiap tautan termasuk
  `/admin`, `/site`, `/dashboard` — yang tidak ada urusannya dengan bahasa
  situs publik.
- **`revenue_membership` akun sendiri, bukan ditumpuk ke `revenue_coworking`.**
  Langganan dan sewa meja beda sifat; digabung, laporan tidak bisa bilang mana
  yang tumbuh.
- **Kontrol UI pakai `<details>` / `<form>`, bukan `useState` + `onClick`.**
  Kontrol yang diam di detik pertama koneksi lambat terbaca sebagai situs
  rusak. Ditemukan tiga kali di session ini, dengan pengukuran, bukan dugaan.
- **Klaim pemasaran hanya tayang setelah fiturnya jalan dan ada tesnya.** Satu
  janji kosong membuat calon pengguna menyimpulkan sisanya juga tidak bisa
  dipercaya.
- **Entitlement membership disalin dari plan saat pembelian**, bukan dibaca
  lewat referensi — mengedit plan tidak boleh diam-diam mengubah apa yang
  sudah dibeli orang.
- **Header dirampingkan dua tahap.** Tiga item pertama ("Fitur Kelola", "Cara
  Monetisasi", "Workspace & Hunian") dilipat ke dropdown **Fitur** — ketiganya
  menjawab satu pertanyaan yang sama di kepala pengunjung. Lalu "Jelajahi
  Listing" dan "Kontak Kami" dibuang dari bilah. Keduanya **dilipat, bukan
  diputus**: masih ada di hero, banner penutup, banner halaman listing, dan
  footer. Menu yang ringkas karena tautannya dihilangkan bukan menu yang lebih
  sederhana — itu menu yang kurang.
- **Menu ponsel mencerminkan header desktop persis**, tidak ada yang
  diselundupkan masuk hanya karena panelnya tersembunyi. Satu pengecualian:
  **"Masuk" tinggal di menu**, karena di 390px bilah dengan tombol menu +
  wordmark + sakelar bahasa + dua kontrol akun meluber dan "Daftar" terpotong.
  Dicoba dulu di bilah, diukur, lalu dipindah.
- **Masuk/Daftar jadi tautan ke `/auth/login`, bukan tombol pembuka modal.**
  Modalnya selalu terbuka dalam mode masuk, jadi menekan "Daftar" memberi form
  masuk. Halaman login sudah punya kedua tab, sudah `method="post"`, sudah
  diterjemahkan, sudah menghormati `?next=`. **`LoginModal` tetap dipakai —
  hanya oleh tombol simpan di kartu listing**, di mana modal memang tepat
  (pengunjung tidak kehilangan halamannya) dan mode masuk memang yang benar.
- **Teks hukum dan uang kini satu bahasa, bukan dua bertumpuk.** Ketentuan
  deposit viewing, catatan alamat di detail listing, halaman tanpa akses, dan
  halaman undangan pemilik dulu mencetak Indonesia dan Inggris berdampingan —
  karena tidak ada sakelar untuk memilih. Sekarang ada, jadi pembaca menerima
  satu.
- **Tes yang bergantung pada label dikunci bahasanya.** `test-homepage-links`
  dipaksa ke Indonesia; frasa pemeriksa nav/footer di `test-language-switch`
  sengaja dipilih yang tidak mungkin muncul di nama atau deskripsi listing —
  teks itu datang dari kolom berbahasa Indonesia dan tampil apa adanya di
  kedua bahasa, jadi kata seperti "Penyewa" akan menggagalkan paruh "tidak
  boleh ada" karena sebab yang tidak ada hubungannya dengan bahasa.

---

## Masalah terbuka

- **Sidebar admin belum difilter per izin**: tautan yang tidak boleh diakses
  tetap tampil dan mengarah ke redirect ke `/admin`. Pekerjaan Fase 2.

- 🔴 **Service-role key produksi masih terpublikasi dan belum dirotasi
  (§20.6).** File `env copy.txt` pernah di-commit ke repo publik
  `kemalmph/verihome`. Sekarang sudah tidak terlacak dan masuk `.gitignore`,
  **tapi mencabut dari pelacakan tidak menghapusnya dari riwayat** — blob-nya
  masih bisa diambil dari commit yang menambahkannya, di repo yang masih
  publik. Diverifikasi 2026-11-23: anon key di commit itu **identik
  byte-per-byte** dengan yang proyek pakai hari ini, dibandingkan lewat hash.
  Karena keduanya ditandatangani JWT secret proyek yang sama, anon key yang
  tidak berubah berarti `service_role` juga tidak berubah. **Anggap kunci itu
  masih berlaku.**
  Yang menutupnya hanya **rotasi kunci di Supabase** — bukan menghapus file,
  bukan menulis ulang riwayat, bukan menjadikan repo privat, karena paparan
  dua bulan di repo publik tidak bisa ditarik kembali. File itu juga memuat
  `RESEND_API_KEY`, `XENDIT_SECRET_KEY`, dan `XENDIT_WEBHOOK_TOKEN`; ketiganya
  perlu diperlakukan sama.

- **Empat keputusan pemilik** di daftar "Berikutnya" (1–4) memblokir pekerjaan
  nyata, bukan sekadar kerapian.
- **Xendit ditulis dan bisa dipilih, tapi `PAYMENT_PROVIDER` tetap `manual`.**
  Semua pembayaran lewat transfer dengan verifikasi bukti. Webhook-nya belum
  idempoten dan belum memverifikasi tanda tangan — jangan dinyalakan sebelum
  keduanya ada.
- **Docker di container cloud sering tumbang.** Saat itu terjadi, Supabase
  lokal ikut mati dan halaman yang membaca database jadi 500. Hidupkan ulang:
  `pkill -9 containerd; setsid nohup dockerd &` lalu `npx supabase start`.
- **`pkill -f "next start"` tidak pernah cocok** — prosesnya bernama
  `next-server`. Beberapa jam terbuang karena server lama menyajikan build
  basi. Pakai `pkill -f "next-server"; fuser -k 3000/tcp`.
- **`curl -L` membuang header Cookie** saat redirect apex → `www` karena beda
  host. Uji produksi langsung ke `https://www.cosystem.co`.
- **Admin, dashboard, dan portal pemilik belum diterjemahkan penuh.** Satu
  sisa yang diketahui: `dashboard/unit/[bookingId]` masih menampilkan dua
  bahasa bertumpuk.
- **Isi katalog tidak ikut berganti bahasa.** Nama properti, deskripsi listing,
  dan nama area tersimpan di satu kolom berbahasa Indonesia; sakelar hanya
  mengubah antarmuka di sekelilingnya.

---

## Izin kerja yang berlaku

Diberikan owner di session sebelumnya, masih berlaku kecuali dicabut:

- **Migration dan merge ke `main` boleh tanpa bertanya lebih dulu.** Kalimat
  aslinya: *"At this stage you can always go to migration and pr to main. This
  is not live yet, ill tell you when."*
- ⚠ **Premisnya sudah berubah.** Saat itu belum live; sejak 2026-11-23
  `cosystem.co` melayani trafik sungguhan dan produksi memuat register Co&co
  beserta buku besarnya. Izinnya belum dicabut, tapi "belum live" tidak lagi
  benar — konfirmasikan ulang ke owner sebelum mengandalkan izin ini untuk
  perubahan yang berisiko.
- `AGENTS.md`: **VeriHome System Reference jangan diubah atau diterbitkan
  ulang** kecuali owner memintanya di session itu juga. Kalau ada yang pantas
  masuk ke sana, sebutkan di chat beserta nomor bagiannya dan biarkan.
- **Register Co&co tidak boleh masuk repo.** Repo ini publik; registernya
  berisi nama penyewa, nomor ponsel, dan email pribadi.

---

## Ekor kecil yang belum dikerjakan

Bukan pemblokir, tapi sayang kalau hilang:

- **Ganti password admin produksi `kemalmph@yahoo.com`.** Nilainya sempat
  diketik di percakapan session, jadi ia ada di transkrip. Sudah diberitahukan
  ke owner; belum ada konfirmasi sudah diganti.
- **Portal pemilik baru separuh dwibahasa.** `OwnerSidebar` sudah membaca
  sakelar, isi halamannya belum: 15 berkas di `src/app/owner/` memanggil `t()`
  tanpa argumen bahasa (±60 panggilan), jadi pemilik yang memilih EN melihat
  sidebar Inggris di atas halaman Indonesia. Pekerjaannya mekanis —
  `getLocale()` untuk server component, `useT()` untuk client.
- **`NEXT_PUBLIC_WHATSAPP` belum diset**, jadi tombol WhatsApp di `/contact`
  tidak dirender sama sekali. Itu memang disengaja — tombol yang membuka
  percakapan dengan nomor kosong lebih buruk daripada tidak ada tombol — tapi
  artinya satu-satunya jalur kontak di sana adalah formulir dan email.
- **Tile "Sewa terikat" di `/site/[id]/dashboard` dilaporkan teksnya
  terpotong.** Dicatat di session sebelumnya, belum diperiksa ulang setelah
  perubahan belakangan.
- **Di ponsel, `/listings` dan `/contact` tidak ada di header maupun di menu**,
  karena menu sengaja mencerminkan desktop dan keduanya baru dibuang dari
  bilah. Masih terjangkau lewat hero dan footer. Kalau terasa kurang, itu
  perubahan satu baris di `NavMobileMenu`.

---

## Status infra

**Supabase** — org `nzqxxsuurhvtygpyxdvb`, project `verihome`
(`hxktoewssuahtkrksbpx`, ap-northeast-1, Postgres 17).
Migration di `supabase/migrations/` (14 file; yang lama di
`supabase/migrations-archive/`).
Terakhir: `20261126180000_drop_admin_email_hook.sql` (produksi sudah sama).
Isi produksi saat ini: 1 site · 14 unit · 2 reservasi · 3 cicilan · 10 entri
buku besar · 7 properti (6 tayang) · 3 pemilik · 30 pengguna · 24 amenity ·
0 membership plan.

**Cloudflare** — **tidak ada Worker dan tidak ada Pages, jadi tidak ada file
wrangler.** Yang ada:
- DNS zone `cosystem.co` (aktif sejak 2026-11-23), diatur di luar repo.
- Object storage **R2** untuk dokumen privat, dipakai di `src/lib/r2/`.
  Menyimpan *key* objek, bukan URL; presigned GET dibuat saat diklik, berlaku
  15 menit.

**Vercel** — deploy dari branch `main`. `vercel.json` memuat satu cron:
`/api/cron/daily` tiap tengah malam.

**Memastikan deploy benar-benar mendarat.** Status 200 dan suite yang hijau
**bukan bukti**: keduanya akan tetap lolos di build lama. Cari penanda yang
hanya ada pada commit itu, lalu tunggu sampai ia muncul:

```
curl -s https://www.cosystem.co/ | grep -q '<penanda>'
```

Penanda yang pernah dipakai: `mode=signup`, `<details`, `name="locale"`.
Untuk commit yang hanya menyentuh admin, tidak ada penanda publik — periksa
di dashboard Vercel bahwa commit itu **Ready · Current**.

Dua hal yang sempat menjebak:

- **Selalu uji ke `https://www.cosystem.co`, bukan apex.** `curl -L` dari
  `cosystem.co` membuang header `Cookie` karena redirect ke host berbeda,
  jadi pengujian berbasis cookie diam-diam menguji hal yang salah.
- **Kegagalan build bisa sesaat.** 23 Nov, commit `1f05fd1` — isinya hanya
  dua file dokumen, nol baris kode — gagal dengan `npm run build exited with
  1`, lalu commit berikutnya membangun kode yang sama persis dan berhasil.
  Kode itu sendiri sudah dibuktikan sehat lewat empat cara: build lokal dari
  nol, clone bersih `npm ci` tanpa env, dengan env Supabase produksi, dan
  dengan env sengaja dirusak. Kalau pola ini muncul lagi: **Redeploy dengan
  "Use existing Build Cache" dimatikan** lebih dulu, sebelum mencari cacat
  di kode.

**Env var / secret — nama saja, jangan pernah tulis nilainya di repo:**

| Variabel | Untuk |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klien Supabase (publik) |
| `SUPABASE_SERVICE_ROLE_KEY` | klien admin; satu-satunya yang boleh memanggil fungsi uang |
| `NEXT_PUBLIC_SITE_URL` | URL kanonik |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | kredensial R2 |
| `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PRIVATE_BUCKET`, `CLOUDFLARE_R2_PUBLIC_URL` | bucket publik & privat |
| `CRON_SECRET` | menjaga `/api/cron/daily` |
| `PAYMENT_PROVIDER` | `manual` di produksi |
| `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` | belum aktif |
| `RESEND_API_KEY` | email |
| `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_HOLDER` | instruksi transfer |
| `VIEWING_DEPOSIT_AMOUNT` | deposit kunjungan |
| `TALLY_SIGNING_SECRET` | webhook formulir |
| `GOOGLE_AUTH_ENABLED` | tombol OAuth; `false` sampai provider dikonfigurasi |
| `TEAM_EMAIL`, `NEXT_PUBLIC_WHATSAPP` | kontak di `/contact` |

**Tes** (butuh Supabase lokal + build produksi lokal):

```
npx supabase start && npx supabase db reset
npm run build && npm run start
node scripts/test-<nama>.js
```

Jalankan `test-coworking-admin` **lebih dulu** setelah reset — ia menuntut
tabel `sites` kosong, dan suite lain meninggalkan site.
