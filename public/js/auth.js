
const EYE_OPEN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`
const EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.86 21.86 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

let captchaToken = null
async function newCaptcha() {
  const c = await api('/auth/captcha')
  captchaToken = c.token
  document.getElementById('captchaQuestion').textContent = `${c.a} + ${c.b} = ?`
  document.getElementById('captchaAnswerInput').value = ''
}

async function init() {
  await refreshAuth()
  if (me) { window.location.href = profileUrl(me.username); return }
  document.getElementById('authCard').style.display = ''

  let mode = 'login'
  document.getElementById('toggleAuth').onclick = (e) => {
    e.preventDefault()
    mode = mode === 'login' ? 'register' : 'login'
    document.getElementById('authTitle').textContent = mode === 'login' ? 'Masuk' : 'Daftar'
    document.getElementById('authSubmit').textContent = mode === 'login' ? 'Masuk' : 'Daftar'
    document.getElementById('captchaField').style.display = mode === 'register' ? 'block' : 'none'
    document.getElementById('toggleAuthText').textContent = mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'
    document.getElementById('toggleAuth').textContent = mode === 'login' ? 'Daftar' : 'Masuk'
    if (mode === 'register') { newCaptcha() }
  }

  document.getElementById('togglePassword').onclick = () => {
    const input = document.getElementById('passwordInput')
    const btn = document.getElementById('togglePassword')
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    btn.innerHTML = show ? EYE_OFF_SVG : EYE_OPEN_SVG
  }

  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    try {
      const body = { username: f.get('username'), password: f.get('password') }
      if (mode === 'register') {
        body.captchaToken = captchaToken
        body.captchaAnswer = Number(f.get('captchaAnswer'))
      }
      await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) })
      toast(mode === 'login' ? 'Berhasil masuk!' : 'Akun dibuat!')
      window.location.href = '/'
    } catch (err) {
      toast(err.message)
      if (mode === 'register') newCaptcha()
    }
  }
}

init()
