
async function init() {
  await refreshAuth()

  document.getElementById('scrapePage').innerHTML = `
    <div class="card">
      <div class="hero-title" style="font-size:22px">Request Scrape</div>
      <div class="hero-rule"></div>
      <form id="scrapeForm">
        <div class="field"><label>URL Website</label><input name="url" type="url" placeholder="https://contoh.com/halaman" required></div>
        <div class="field"><label>Deskripsi</label><textarea name="description" class="textarea-autogrow" placeholder="Data apa yang ingin diambil dari situs ini? Misalnya: daftar harga produk, judul dan isi artikel, dll." style="min-height:90px" rows="3" required></textarea></div>
        <div class="field">
          <label>Gambar Referensi (opsional)</label>
          <button type="button" class="btn btn-white btn-block" id="pickImageBtn">${imageIconSvg()} Pilih Gambar</button>
          <input type="file" id="imageInput" style="display:none" accept="image/*">
          <div class="field-hint" id="imageHint">Screenshot bagian situs yang ingin di-scrape, agar lebih jelas.</div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Kirim Request</button>
      </form>
    </div>
  `

  const form = document.getElementById('scrapeForm')
  const imageInput = document.getElementById('imageInput')
  const imageHint = document.getElementById('imageHint')
  let imageBase64 = null

  wireAutoGrowTextarea(form.elements['description'])

  document.getElementById('pickImageBtn').onclick = () => imageInput.click()
  imageInput.onchange = async () => {
    const file = imageInput.files[0]
    if (!file) return
    try {
      imageBase64 = await fileToBase64(file)
      imageHint.textContent = `Terpilih: ${file.name}`
    } catch { toast('Gagal membaca gambar') }
    finally { imageInput.value = '' }
  }

  form.onsubmit = async (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    try {
      await api('/scrape-requests', {
        method: 'POST',
        body: JSON.stringify({
          url: f.get('url'),
          description: f.get('description'),
          imageBase64
        })
      })
      toast('Request scrape terkirim!')
      form.reset()
      imageBase64 = null
      imageHint.textContent = 'Screenshot bagian situs yang ingin di-scrape, agar lebih jelas.'
    } catch (err) { toast(err.message) }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function imageIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>`
}

init()
