# Cosystem Design System (V7)

Panduan visual untuk semua halaman Cosystem. Diturunkan dari prototype V7
owner (homepage "Run Your Space.", mockup dashboard laptop + ponsel) dan dari
halaman yang sudah dibangun mengikutinya. Versi visualnya (token, komponen
dengan pratinjau, logo, foto): **Cosystem Design System** —
<https://claude.ai/artifact/52wLDrjHLDbbgfiCYg2qyN>.

Kalau aturan berubah, ubah kode lebih dulu, lalu dokumen ini, lalu
artifact-nya. Ketiganya harus berkata sama.

**Aturan utama:** jangan menulis warna sebagai hex di kelas
(`bg-[#f36b21]`). Pakai token. Seluruh aplikasi pernah ditulis dengan literal
hex di 124 file, dan rebrand butuh codemod; dengan token, rebrand cukup
mengubah satu blok.

Sumber kebenaran ada di kode, bukan di dokumen ini. Kalau keduanya berbeda,
kode yang benar dan dokumen ini yang perlu diperbarui:

| File | Isi |
|---|---|
| `src/app/globals.css` (`@theme`) | Token warna, bayangan, font |
| `src/lib/design-tokens.ts` | Salinan token untuk SVG, canvas, style inline |
| `src/components/brand/styles.ts` | Resep tombol pil dan `kicker` |
| `src/components/brand/Logo.tsx` | Logo (varian `dark` / `light`) |
| `src/components/checkout/` | Kartu, field, indikator langkah untuk alur multi-langkah |

---

## 1. Warna

### Merek

| Token | Hex | Dipakai untuk |
|---|---|---|
| `brand` | `#F36B21` | Tombol utama, item nav aktif, ikon, isian progress |
| `brand-strong` | `#DF5814` | Hover / pressed dari isian `brand` |
| `brand-ink` | `#C2410C` | **Teks** oranye di atas latar terang |
| `brand-soft` | `#FFF0E4` | Tile ikon, chip lembut, sorotan jumlah |
| `brand-light` | `#FFC9A6` | Garis/ring di sekitar `brand-soft`, aksen di latar gelap |

> **Teks oranye selalu `text-brand-ink`, bukan `text-brand`.** `#F36B21` di
> atas putih hanya ~3:1, di bawah WCAG AA untuk teks biasa. `brand-ink`
> menjaga rona yang sama dan mencapai ~5:1. Tombol tetap `bg-brand` dengan
> teks putih, mengikuti prototype.

### Netral

| Token | Hex | Dipakai untuk |
|---|---|---|
| `ink` | `#171717` | Judul, angka utama, teks penting |
| `ink-2` | `#3F3F46` | Teks isi |
| `ink-3` | `#62636A` | Teks sekunder, label, keterangan |
| `line` | `#EEE8E1` | Garis tipis, border kartu |
| `line-strong` | `#DDD6CF` | Border field input |
| `cream` | `#FFF7EF` | Latar kartu model ruang, chip fasilitas |
| `cream-2` | `#FFFAF5` | Latar section hangat (showcase, header halaman, alur checkout) |
| `canvas` | `#F6F5F3` | Latar halaman dashboard, segmented control |
| `panel` / `panel-2` | `#1C1C1E` / `#2A2A2D` | Sidebar gelap dashboard |

### Status

`success` `#15803D`, `success-ink` `#166534`, `success-soft` `#E7F6EC`,
`success-line` `#B7E0C3` — **hanya untuk status** (Confirmed, Lunas, Aktif).
Hijau berarti "selesai", bukan merek. Peringatan tenggat memakai amber
Tailwind (`amber-50/200/600/900`), error memakai `red-50/200/700`.

Warna semantik yang sengaja tidak memakai token: bar skor RLA (hijau/biru/
amber/merah menurut nilai) dan warna aliran pendapatan di laporan.

---

## 2. Tipografi

Font: **Inter** (variabel, `next/font`), satu-satunya keluarga. Ikon memakai
Material Symbols Outlined.

| Peran | Kelas | Contoh |
|---|---|---|
| Hero | `text-[61px] md:text-[clamp(54px,7vw,86px)] leading-[0.96] font-black tracking-[-0.055em]` | "Run Your Space." |
| Judul halaman | `text-[36px] md:text-[48px] leading-[1.02] font-extrabold tracking-[-0.045em]` | "Semua Listing" |
| Judul section | `text-[32px] md:text-[clamp(32px,4vw,44px)] leading-[1.08] font-extrabold tracking-[-0.04em]` | "Designed for Different Space Models" |
| Judul kartu besar | `text-xl font-extrabold tracking-[-0.03em]` | "Penilaian RLA", judul langkah checkout |
| Judul kartu kecil | `text-[17px] font-bold tracking-[-0.02em]` | Nama listing di kartu |
| Kicker | `kicker` dari `brand/styles.ts` (12px, extrabold, uppercase, `tracking-[0.12em]`, `brand-ink`) | "MARKETPLACE" |
| Isi | `text-base leading-[1.65] text-ink-3` (paragraf lepas) / `text-sm text-ink-2` (di kartu) | |
| Label field | `text-xs font-semibold text-ink-2` | |
| Angka uang utama | `font-extrabold tracking-[-0.03em] tabular-nums` | "IDR 1.520.963" |

Judul besar selalu dengan tracking negatif; makin besar, makin rapat.
Angka uang dan jam memakai `tabular-nums` dan `whitespace-nowrap` agar
"IDR" tidak terpisah dari nominal di ponsel.

---

## 3. Bentuk, bayangan, jarak

### Radius

| Elemen | Radius |
|---|---|
| Tombol, chip, tab, slot jam | `rounded-full` (pil) |
| Field input | `rounded-xl`, tinggi `h-12` |
| Kartu kecil / baris / sub-panel | `rounded-2xl` |
| Kartu utama, panel CTA, kartu langkah checkout, kotak filter | `rounded-3xl` |
| Kartu listing dan kartu model ruang | `rounded-[19px]` |
| Tile ikon fitur | `w-[54px] h-[54px] rounded-[17px] bg-brand-soft` |

### Bayangan

| Token | Untuk |
|---|---|
| `shadow-card` | Kartu diam (dashboard, kartu listing) |
| `shadow-lift` | Kartu yang menonjol (filter mengambang, kotak booking, dropdown) dan hover kartu |
| `shadow-brand` | Tombol `brand` dan item aktif |

Kartu standar: `bg-white rounded-2xl border border-line shadow-card`.
Kartu yang bisa diklik naik saat hover: `hover:-translate-y-1 hover:shadow-lift`.

### Tata letak

- Halaman publik: kontainer `max-w-[1160px] mx-auto px-4 md:px-6`.
- Halaman checkout: `max-w-2xl`, latar `bg-cream-2`.
- Dashboard: latar `bg-canvas`, konten `p-6 md:p-12` di samping sidebar
  (`md:ml-(--sidebar-w)`).
- Section publik: `py-14 md:py-20` kira-kira; prototype memakai angka
  spesifik per section — ikuti angka itu kalau ada prototype-nya.

---

## 4. Komponen

### Tombol (`pill` di `brand/styles.ts`)

| Resep | Tampilan | Kapan |
|---|---|---|
| `pill.primary` | Oranye, teks putih, `shadow-brand`, naik 1px saat hover | Satu aksi utama per tampilan |
| `pill.secondary` | Putih, garis tipis | Aksi kedua di samping primary, "Kembali" |
| `pill.primarySm` | Primary kecil | Header, toolbar |

Tombol bisa berupa `<Link>`, karena resepnya kelas, bukan komponen. Tombol
dua baris (judul + subjudul) tambahkan `flex-col gap-0.5 text-center`.

### Field

`w-full h-12 rounded-xl border border-line-strong bg-white px-3.5 text-sm
focus:border-brand focus:ring-2 focus:ring-brand/20` — tersedia sebagai
`flow.field` di `checkout/styles.ts`. Label di atas field, bukan placeholder
sebagai label.

### Chip

- Spesifikasi/fasilitas: `rounded-full bg-cream border border-[#f3e9df] px-3.5 py-1.5`.
- Status lembut: `rounded-full bg-brand-soft text-brand-ink` atau `success-soft`.
- Label di atas foto: `rounded-full bg-white/95 shadow-sm`, ikon `text-brand`.

### Segmented control / tab

Wadah `rounded-full bg-canvas p-1`; item aktif `bg-white text-ink shadow-card`,
item lain `text-ink-3`. Tab kategori galeri: aktif `bg-ink text-white`.

### Indikator langkah (`checkout/FlowSteps`)

Pil per langkah: aktif oranye dengan nama, selesai `brand-soft` dengan ✓,
belum `canvas`. Di ponsel hanya langkah aktif yang menampilkan nama.

### Daftar centang

Lingkaran `w-[22px] h-[22px] rounded-full bg-brand text-white` berisi ✓.
Untuk kekurangan: lingkaran `bg-line-strong` berisi ✕.

### Panel CTA

`rounded-3xl bg-[#fff2e7] border border-[#ffead9]`, teks kiri, `pill.primary`
kanan; di ponsel tombol jadi lebar penuh.

### Sidebar dashboard

`bg-panel`, logo varian `light`. Item: `rounded-xl px-4 py-2.5`, aktif
`bg-brand text-white font-semibold shadow-brand`, lain `text-white/75
hover:bg-white/[.06]`. Rail ciut menampilkan "c" + titik oranye.

### Ikon

Material Symbols Outlined, berat 400. Di tile fitur homepage dipakai SVG
garis 24×24, stroke 1.8, `currentColor` (lihat `src/app/page.tsx`).

---

## 5. Logo

`<Logo variant="dark" | "light" height={…} />`. Tinggi lazim: 24 (navbar),
22 (footer), 26 (sidebar), 20 (bar ponsel). Jangan menulis "Cosystem" sebagai
teks berwarna untuk menggantikan logo.

---

## 6. Bahasa dan teks

Semua teks antarmuka lewat `t()` / `useT()` dari `src/lib/i18n/strings.ts`,
ID dan EN berdampingan. "Run Your Space." tetap Inggris di kedua bahasa.
Jangan menanam teks langsung di komponen ("Continue", "Watch Video" pernah
lolos begini).

---

## 7. Navigasi publik

Navbar: Product / Solutions / Pricing / Resources, dari satu sumber
(`src/components/layout/nav-items.ts`) untuk desktop dan ponsel. Di kanan
bar: tombol bahasa (mulai 640px) dan **satu** tombol akun, `pill.primarySm`
"Masuk" → `/auth/login`, di semua lebar (keputusan owner, 28 Nov 2026).
"Coba Gratis" tidak di bar; ia aksi utama di hero dan CTA penutup.
**Marketplace adalah produk sekunder** (keputusan owner, 28 Nov 2026): ia
tinggal di Resources, bukan di menu utama, homepage, atau footer. Halaman
marketplace sendiri (`/listings`) tetap memakai gaya V7 penuh.

## 8. Halaman tanpa prototype

Sebagian besar halaman belum punya prototype. Urutan acuan:

1. Prototype owner, kalau ada.
2. Halaman V7 yang sudah ada dengan pola serupa: daftar → `/listings`,
   detail → `/listings/[slug]`, form multi-langkah → `/listings/[slug]/book`,
   dashboard → `/admin`.
3. Dokumen ini.

Status per 28 Nov 2026: sudah V7 — homepage, navbar/footer publik, kedua
sidebar dashboard, kartu dashboard, `/listings`, `/listings/[slug]`, alur
`/book` dan `/viewing`. Halaman lain baru ikut berganti **warna** lewat token;
tata letaknya masih gaya lama (tombol `rounded-lg`, bukan pil).
