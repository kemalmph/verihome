@AGENTS.md

## Workflow session

- Di awal session: baca `PROGRESS.md` dan `git log -15 --oneline` sebelum
  mengerjakan apa pun, lalu ringkas posisi terakhir.
- Di akhir session: update `PROGRESS.md`, lalu commit & push.
- Skema Supabase hanya diubah lewat file migration di `supabase/migrations/`.
  Jangan edit manual di dashboard. Jangan pernah menjalankan
  `supabase db push` (lihat `HANDOFF.md`); terapkan migration lewat tool
  Supabase MCP `apply_migration`, dan uji lokal lebih dulu dengan
  `npx supabase migration up --local`.
- **Cloudflare: repo ini tidak punya file wrangler, dan itu bukan kelalaian.**
  Aplikasinya deploy ke Vercel (`vercel.json`, berisi satu cron), bukan ke
  Workers atau Pages. Cloudflare dipakai untuk dua hal lain:
  DNS zone `cosystem.co`, diatur lewat dashboard/API Cloudflare — di luar repo;
  dan object storage R2 untuk dokumen privat, yang dikonfigurasi lewat env var
  (`CLOUDFLARE_R2_*`) dan dipakai di `src/lib/r2/`. Kalau suatu saat ada
  Worker/Pages, barulah `wrangler.toml` muncul — sampai itu terjadi, jangan
  membuat file wrangler kosong supaya "sesuai pola".
- Jangan pernah menulis nilai secret/API key ke file apa pun; cukup nama
  variabelnya. Daftar namanya ada di `PROGRESS.md`.

## Project terkait

- Repo ini adalah **Cosystem** (dulu VeriHome) — GitHub `kemalmph/verihome`,
  `package.json` name `cosystem`. Nama repo masih nama lama; isinya Cosystem.
- Project lain milik owner yang sama: **Pasarin**. Itu produk berbeda dan
  **bukan** repo ini.
- Yang dipakai bersama, dan yang tidak:
  - **Supabase: satu organisasi, dua project terpisah.** Cosystem/VeriHome =
    `hxktoewssuahtkrksbpx`, Pasarin = `acwksgoziqenaqqnzhtk`. Keduanya ada di
    org `nzqxxsuurhvtygpyxdvb`, jadi satu grant menjangkau keduanya dan
    database Pasarin ikut terbaca dari session ini. **Databasenya terpisah;
    jangan sentuh Pasarin kecuali diminta.**
  - **Cloudflare:** satu account, dipakai bersama. Yang menyangkut repo ini
    hanya zone `cosystem.co` dan bucket R2-nya.
  - **Kode: independen.** Tidak ada kode, paket, atau tipe yang dibagi antara
    kedua project.
- Cloud environment: session berjalan di environment `verihome`
  (`env_019h1qiey4NpoNWKsHFsY7So`), bukan Default — Default dikonfigurasi untuk
  Pasarin. Session yang sudah jalan tidak bisa pindah; pilih di menu
  environment sebelum memulai.
