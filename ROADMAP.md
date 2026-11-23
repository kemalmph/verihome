# Roadmap — fitur yang dijanjikan tapi belum ada

Catatan ini lahir dari satu permintaan: **hapus dari website klaim yang belum ada.**

Draf copy halaman depan menjanjikan enam hal yang belum dibangun. Keenamnya sudah
dihapus dari `src/app/page.tsx` dan dicatat di sini. Urutannya bukan prioritas,
melainkan dari yang paling murah ke yang paling mahal.

Aturannya sederhana dan berlaku ke depan: **klaim baru masuk ke halaman publik
setelah fiturnya jalan dan ada tesnya**, bukan sebelumnya. Satu kalimat pemasaran
yang tidak ditepati lebih merugikan daripada satu fitur yang belum ada — calon
pengguna yang mendaftar karena janji itu lalu tidak menemukannya akan
menyimpulkan sisanya juga tidak bisa dipercaya, dan mereka tidak salah.

---

## 1. Pembayaran otomatis (Virtual Account & QRIS)

**Dijanjikan:** "Penagihan sewa bulanan atau harian otomatis (VA & QRIS)"
**Kenyataannya:** semua pembayaran lewat transfer manual. Penyewa mengunggah bukti
transfer, staf memverifikasinya.

Separuh pekerjaannya sudah ada: integrasi Xendit sudah ditulis dan bisa dipilih,
tapi `PAYMENT_PROVIDER` masih `'manual'` dan belum pernah dijalankan dengan kunci
produksi.

Yang dibutuhkan untuk bisa diklaim:

- Kunci produksi Xendit dan `PAYMENT_PROVIDER='xendit'`.
- Webhook yang **idempoten**: Xendit mengirim ulang callback-nya, dan posting ganda
  ke buku besar tidak bisa dibatalkan — hanya bisa dikoreksi dengan jurnal balik.
  Pola yang sudah dipakai `settle_*` (unique index sekali-saja) harus dipakai juga
  di sini.
- Verifikasi tanda tangan callback. Tanpa itu siapa pun yang tahu URL-nya bisa
  menandai tagihan sebagai lunas.
- Rekonsiliasi: apa yang terjadi kalau Xendit bilang lunas tapi uangnya tidak
  masuk ke rekening, dan sebaliknya.

## 2. Pengingat tagihan via WhatsApp

**Dijanjikan:** "pengingat tagihan otomatis via WhatsApp dan email lengkap dengan
payment link"
**Kenyataannya:** tidak ada integrasi pengiriman pesan sama sekali. Jatuh tempo
hanya tampil di dashboard, dan hanya terlihat kalau ada yang membukanya.

Yang dibutuhkan:

- Akun WhatsApp Business API (Meta) atau penyedia perantara, plus template pesan
  yang sudah disetujui Meta — ini proses persetujuan yang butuh waktu, bukan
  pekerjaan kode.
- Alamat email pengirim dengan SPF/DKIM pada `cosystem.co`, kalau tidak pesannya
  masuk spam dan secara praktis tidak terkirim.
- Penjadwal pengiriman, dan catatan per penerima supaya satu tagihan tidak
  dikirimi pengingat lima kali karena penjadwalnya jalan lima kali.
- Payment link baru masuk akal setelah butir 1 jalan.

## 3. Kode akses & check-in otomatis

**Dijanjikan:** "Kode akses & check-in otomatis untuk penyewa harian"
**Kenyataannya:** tidak ada apa pun yang menyentuh kunci pintu.

Ini bukan fitur perangkat lunak saja — ia butuh kunci pintar yang terpasang di
lokasi, dan pilihan perangkatnya menentukan seluruh integrasinya. Sebelum ada
satu lokasi yang benar-benar memasangnya, menulis kodenya hanya menebak.

Yang perlu diputuskan lebih dulu: perangkat apa, siapa yang memasang, dan apa
yang terjadi kalau internet di lokasi mati saat penyewa berdiri di depan pintu.

## 4. Pencatatan utilitas & tiket pemeliharaan

**Dijanjikan:** "Pencatatan utilitas (listrik/air) & tiket pemeliharaan unit"
**Kenyataannya:** ada kolom `utilities_included` per unit — menandai apakah
listrik/air sudah termasuk harga — tapi tidak ada pencatatan angka meteran, tidak
ada tagihan berdasarkan pemakaian, dan tidak ada tiket pemeliharaan.

Yang dibutuhkan:

- Tabel bacaan meteran per unit per periode, dan tarif per satuan.
- Keputusan akuntansi: apakah utilitas yang ditagihkan ulang itu pendapatan atau
  pengurang biaya. Ini menentukan akun mana yang dipakai di buku besar, dan salah
  pilih berarti laporan laba-ruginya salah sejak transaksi pertama.
- Tiket pemeliharaan sebenarnya modul sendiri: pelapor, penerima, status, biaya,
  dan kaitannya ke unit. Lebih dekat ke helpdesk daripada ke pencatatan.

## 5. Halaman reservasi pribadi (`cosystem.co/p/nama-properti`)

**Dijanjikan:** tautan pemesanan khusus untuk dipasang di bio Instagram atau Google
Maps, tempat calon penyewa bisa cek ketersediaan dan membayar sendiri.
**Kenyataannya:** tidak ada rute `/p/[slug]`. Properti tayang di `/listings`
bersama yang lain, tanpa halaman bermerek sendiri.

Yang dibutuhkan:

- Rute `/p/[slug]` dengan slug yang dipilih pemilik dan dijamin unik.
- Pembayaran mandiri — jadi butuh butir 1. Tanpa itu "membayar sendiri" tetap
  berarti transfer manual lalu menunggu verifikasi, yang bukan yang dijanjikan
  tautan semacam ini.
- Tampilan ketersediaan yang jujur: kalender yang menunjukkan tanggal terpakai
  tanpa membocorkan siapa yang memakainya.

## 6. Unit workspace tayang di marketplace

**Dijanjikan (tersirat):** etalase publik berisi "ruang kerja siap pakai dan
hunian".
**Kenyataannya:** `/listings` hanya membaca tabel properti. Unit coworking hidup
di `lettable_units` dan tidak pernah sampai ke halaman publik — jadi etalasenya
selama ini hanya hunian, meski teksnya menyebut keduanya.

Ini yang paling dekat untuk dikerjakan, dan pekerjaannya bukan tampilan melainkan
pemodelan: dua jenis sewa yang berbeda harus bisa ditampilkan di satu halaman.

Yang perlu diputuskan:

- Unit disewa per jam, per hari, dan per bulan; properti per bulan atau per hari.
  Satu kartu listing harus bisa menampilkan keduanya tanpa membuat harganya
  menyesatkan.
- Gerbang publikasi untuk unit — properti punya checklist kelengkapan sebelum
  boleh tayang; unit belum punya padanannya.
- Bagi hasil untuk site milik pihak ketiga belum diputuskan. Selama itu belum
  jelas, menayangkan unit milik orang lain berarti menerima booking yang
  pembagian uangnya belum disepakati.

---

## Keputusan yang masih menggantung

Bukan fitur, tapi menghalangi beberapa butir di atas:

- **Iuran membership belum masuk buku besar.** Menunggu keputusan pemilik:
  diakui per bulan kalender, atau per bulan keanggotaan.
- **Cicilan (`reservation_instalments`) juga belum posting ke buku besar** —
  keputusan akuntansi yang sama.
- **Bagi hasil site pihak ketiga** belum ada aturannya.
- **Harga ruang rapat RO12 (Rp150.000/jam) masih tebakan pasar**, dan 11 harga
  lain masih bertanda ESTIMASI.
