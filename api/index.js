// Entrypoint serverless buat Vercel. Vercel otomatis nganggep tiap file di
// folder /api sebagai satu function -- file ini yang jadi "pintu masuk"
// tunggal buat SEMUA request (lihat rewrites di vercel.json), karena app
// Express di server.js yang nanganin routing beneran (halaman, /api/*,
// static assets, dst).
//
// `ready` (di-export dari server.js) nyimpen setup async yang harus beres
// sebelum request dilayani (init repo GitHub, ambil session secret). Kita
// await itu duluan di sini tiap invocation -- instance yang baru "dingin"
// bakal nunggu sekali di request pertamanya, instance yang udah "hangat"
// (dipakai ulang buat request berikutnya oleh Vercel) langsung lanjut
// karena promise-nya udah resolved dari invocation sebelumnya.
import app, { ready } from '../server.js'

export default async function handler(req, res) {
    try {
        await ready
    } catch (e) {
        res.status(500).json({ error: 'Server sedang sibuk, coba lagi sebentar lagi.' })
        return
    }
    return app(req, res)
}
