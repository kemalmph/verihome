# Progres

Posisi terakhir pekerjaan, untuk disambung session berikutnya.
Dokumen pendamping: `AGENTS.md` (aturan), `HANDOFF.md` (catatan teknis yang
lebih dalam), `ROADMAP.md` (fitur yang belum ada).

Terakhir diperbarui: 2026-11-23, di akhir session · branch kerja `main-g2jjf1`
(sudah di-merge ke `main`). Posisi sebenarnya selalu dari `git log -15 --oneline` —
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

## Selesai

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

Tidak ada yang setengah jadi. Working tree bersih, `main-g2jjf1` sama dengan
`main`, semua sudah terdeploy dan diverifikasi di produksi.

---

## Berikutnya

Urut prioritas:

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
Migration di `supabase/migrations/` (12 file; yang lama di
`supabase/migrations-archive/`).
Terakhir: `20261123120000_membership_ledger.sql`.
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
