# Codery

Platform share code kayak Pastebin + follow system kayak sosmed, pakai GitHub Gist buat nyimpen kode dan sebuah repo GitHub **private** sebagai "database" JSON (users, follow, index snippet).

## Setup (server biasa / VPS)

1. **Revoke token lama** yang sempat bocor sebelumnya (cek riwayat plugin `gist.js` kamu) di GitHub → Settings → Developer settings → Personal access tokens.
2. Buat token baru dengan scope `repo` dan `gist`.
3. Copy `.env.example` jadi `.env`, isi:
   ```
   GITHUB_TOKEN=token_baru_kamu
   GITHUB_DB_REPO_NAME=codery-db
   GITHUB_ASSETS_REPO_NAME=codery-assets
   SESSION_SECRET=string_acak_bebas
   PORT=3000
   ```
   Cukup **nama** repo saja (bukan `owner/repo`) — owner otomatis dideteksi dari akun pemilik token.
4. Install & jalankan:
   ```
   npm install
   npm start
   ```
   Saat pertama kali start, server otomatis cek dan **membuat kedua repo** kalau belum ada:
   - `codery-db` → dibuat **private**
   - `codery-assets` → dibuat **public**

   Kalau repo dengan nama itu sudah ada di akunmu, server langsung pakai yang sudah ada (tidak menimpa).
5. Buka `http://localhost:3000`

## Deploy ke Vercel

Codery udah bisa langsung di-deploy ke Vercel sebagai serverless function — gak perlu ubah kode apa pun lagi, tinggal ikutin ini:

1. **Import project** di [vercel.com/new](https://vercel.com/new), pilih repo Codery kamu (atau `vercel` lewat CLI dari folder project ini). Vercel otomatis kedeteksi ini project Node.js biasa (bukan Next.js dkk) — gak perlu ubah Build/Output setting, biarin default.
2. **Set Environment Variables** di Project Settings → Environment Variables (isi persis kayak `.env` di setup biasa):
   - `GITHUB_TOKEN` — wajib, scope `repo` + `gist`
   - `GITHUB_DB_REPO_NAME` — default `codery-db` kalau dikosongin
   - `GITHUB_ASSETS_REPO_NAME` — default `codery-assets` kalau dikosongin
   - `SESSION_SECRET` — opsional (lihat catatan di bawah soal auto-generate)
   - `ALLOWED_ORIGINS` — isi domain Vercel kamu, misal `https://codery.vercel.app` (pisah koma kalau lebih dari satu, misal domain custom + preview)
   - `TENOR_API_KEY` — kalau fitur stiker GIF komentar dipakai
   - `CRON_SECRET` — opsional tapi disarankan; Vercel otomatis kirim header ini ke endpoint cron pruning kalau di-set, biar endpoint-nya gak bisa dipicu sembarang orang dari luar
3. **Deploy**. Vercel bakal jalanin `npm install` terus deploy `api/index.js` sebagai satu serverless function; `vercel.json` udah ngatur semua request (halaman, `/api/*`, static asset di `public/`) supaya lewat function itu.
4. Cron pembersih scrape-request expired (>7 hari) udah kedaftar otomatis lewat `vercel.json` (`crons`), jalan sekali sehari. **Catatan plan Hobby**: cron di Hobby dibatasi maksimal 1x/hari (yang udah dipakai di sini) dan waktu triggernya bisa meleset dalam rentang 1 jam dari jadwal — itu wajar, bukan bug.

**Kenapa ini bisa langsung jalan di serverless** (gak kayak app Express kebanyakan yang butuh refactor besar): Codery dari awal udah nyimpen semua data (users, snippets, sesi) lewat GitHub API, bukan file/DB lokal di disk — jadi gak ada state yang "hilang" tiap kali serverless function-nya di-spin down. Satu-satunya penyesuaian yang dibutuhin cuma: `server.js` sekarang nge-export Express app-nya (dipakai `api/index.js`) alih-alih langsung manggil `app.listen()`, build CSS dilayani dari memori (bukan nulis ke disk yang read-only di serverless), dan job bersih-bersih terjadwal pindah dari `setInterval` ke Vercel Cron Jobs.

Struktur tambahan yang khusus buat Vercel:
- `api/index.js` — pintu masuk serverless, cuma bungkus `app` dari `server.js`
- `vercel.json` — routing semua request ke `api/index.js`, include folder `public/` ke bundle function, dan jadwal cron

## Struktur

- `server.js` — Express app (di-`export default`, dipakai baik lewat `node server.js` langsung MAUPUN lewat `api/index.js` di Vercel)
- `api/index.js` — entrypoint serverless khusus Vercel (bungkus `server.js`)
- `vercel.json` — konfigurasi deploy Vercel (routing, cron, dll)
- `src/github.js` — semua panggilan ke GitHub API (Gist + Contents API buat repo private)
- `src/db.js` — layer "database" JSON di atas repo private (users, follows, snippets), ada retry kalau ada conflict write bersamaan
- `src/routes/` — auth, codes (upload/view/delete via gist), users (profile + follow)
- `public/` — frontend vanilla JS, styling tombol 3D

## Fitur

- Register/login (username + password, hash bcrypt)
- Upload kode → tersimpan sebagai Gist (publik/privat), otomatis masuk index `snippets.json`
- Feed: list semua kode publik (`GET /api/codes`)
- View code detail + raw link + link gist asli (`GET /api/codes/:id`)
- Hapus kode (khusus pemilik)
- Profile: bio, foto profil, jumlah kode/followers/following, list kode yang diupload (bisa diklik untuk view)
- Follow / unfollow user lain, lihat daftar followers & following
- Edit bio dan ganti foto profil (foto otomatis di-resize ke 256x256 di browser sebelum upload, disimpan permanen ke repo publik `codery-assets` — jadi selalu bisa diakses siapa saja dan tidak akan hilang selama repo ada)
- Like/suka kode (toggle, tersimpan di `likes.json`)
- Tag kode (maks 5 per kode) + search & filter tag di feed
- Tab Trending (skor `likes*3 + views`) vs Terbaru di feed
- Leaderboard (`/leaderboard`): Top Upload, Paling Disukai, Top Followers

## Catatan

- Token GitHub cuma hidup di server (`.env`), tidak pernah dikirim ke browser — aman dari inspect element.
- Repo `codery-db` private tetap bisa dibaca/ditulis backend karena token scope `repo` mencakup private repo milik akun itu.
- Repo `codery-assets` sengaja publik supaya foto profil bisa ditampilkan langsung lewat `raw.githubusercontent.com` tanpa autentikasi.
- Kalau nanti mau deploy (Vercel/Railway/Pterodactyl), set env var yang sama di panel deploy, jangan commit `.env`. Lihat bagian **Deploy ke Vercel** di atas kalau targetnya Vercel.
- **Sesi login gak ke-reset waktu deploy ulang**: kalau `SESSION_SECRET` gak di-set manual di env, server otomatis generate satu secret sekali lalu simpan permanen di `codery-db` (`session-secret.json`). Jadi walau proses server restart / platform hosting gak persist `.env` antar-deploy, semua orang tetap login. Kalau mau full kontrol, tetap boleh set `SESSION_SECRET` sendiri di env — itu akan diprioritaskan.
- View code pakai hitungan unik per-IP (di-hash, bukan disimpan mentah) — buka berkali-kali dari IP yang sama gak nambahin angka view-nya.
