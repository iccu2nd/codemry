# codery-cli

Command-line client buat Codery. Push/pull/list/hapus snippet dari terminal, tanpa dependency eksternal (cuma butuh Node.js >= 18, pakai `fetch` bawaan).

## Install

Dari dalam folder `cli/`:

```
npm install -g .
```

Ini bikin command `codery` tersedia global. (Bisa juga `npm link` kalau lagi develop.)

## Setup

1. Login ke Codery di browser, buka halaman **API Docs** (`/api-docs`), generate/lihat API key kamu.
2. Login lewat CLI:
   ```
   codery login <api-key> --server https://domain-codery-kamu.com
   ```
   Server URL cuma perlu disebut sekali — tersimpan di `~/.codery/config.json` buat command berikutnya.

## Perintah

```
codery login <api-key> [--server <url>]   Simpan API key
codery logout                             Hapus login tersimpan
codery whoami                             Info akun yang lagi login

codery ls [--private]                     List snippet kamu (--private buat ikutin yang privat juga)
codery push <file> [opsi]                 Upload file jadi snippet baru
  --title "..."       Judul (default: nama file)
  --desc "..."        Deskripsi
  --tags a,b,c        Tag, pisah koma (maks 5)
  --lang js           Bahasa (default: ditebak dari ekstensi file)
  --filename name     Nama file yang disimpan (default: nama file asli)
  --private            Upload privat (default: publik)
codery pull <shortId> [-o outfile]        Download isi snippet (kalau login, private punyamu juga bisa)
codery rm <shortId>                       Hapus snippet milikmu

codery config show                        Lihat config aktif
codery config set-server <url>            Ganti server default
```

## Contoh

```
codery push ./backup.sh --title "Backup script" --tags devops,backup
codery ls --private
codery pull aB3xQ1 -o backup.sh
codery rm aB3xQ1
```

Config (server + API key) disimpan di `~/.codery/config.json`. Jangan commit/share file itu — API key setara password buat akun kamu.
