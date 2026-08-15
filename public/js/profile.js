
async function renderProfile() {
  const app = document.getElementById('app')
  const username = qs('u')
  if (!username) { app.innerHTML = `<div class="card"><div class="empty-state">Profil tidak ditemukan.</div></div>`; return }
  app.innerHTML = `<div class="card"><div class="empty-state">Memuat profil...</div></div>`
  try {
    const p = await api(`/users/${username}`)
    const totalViews = p.snippets.reduce((sum, s) => sum + (s.views || 0), 0)
    app.innerHTML = `
      <div class="card profile-card">
        ${p.banner
          ? `<div class="profile-banner-wrap">
               <div class="profile-banner-img" id="bannerImg" style="background-image:url('${p.banner}')"></div>
               <div class="profile-banner-fade"></div>
               ${p.isMe ? `<button class="banner-pencil-btn" id="bannerBtn" aria-label="Ganti foto sampul">${cameraIconSvg()}</button>` : ''}
             </div>`
          : (p.isMe ? `<button type="button" class="profile-banner-add-btn" id="bannerAddBtn">${cameraIconSvg()} Tambah foto sampul</button>` : '')}
        ${p.isMe ? `<input type="file" id="bannerInput" accept="image/*" style="display:none">` : ''}
        <div class="profile-head">
          <div class="avatar-wrap">
            <img class="avatar avatar-circle" id="avatarImg" src="${p.avatar}">
            ${p.isMe ? `<button class="avatar-pencil-btn" id="avatarBtn" aria-label="Ganti foto profil">${cameraIconSvg()}</button>` : ''}
            <input type="file" id="avatarInput" accept="image/*" style="display:none">
          </div>
          <div class="profile-names">
            <div class="profile-nickname">${escapeHtml(p.nickname || p.username)}${badgesHtml(p.badges)}${devBadgeHtml(p.isDeveloper)}${roleBadgeHtml(p.role)}</div>
            <div class="profile-username">@${escapeHtml(p.username)}</div>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat"><b>${p.snippets.length}</b><span>Kode</span></div>
          <div class="stat"><b>${p.totalViews ?? totalViews}</b><span>Views</span></div>
          <div class="stat"><b>${p.totalLikes ?? 0}</b><span>Suka</span></div>
          <a class="stat" href="${followUrl(p.username, 'followers')}"><b>${p.followersCount}</b><span>Followers</span></a>
          <a class="stat" href="${followUrl(p.username, 'following')}"><b>${p.followingCount}</b><span>Following</span></a>
        </div>
        <div class="profile-below-stats">
          <div class="profile-bio" id="bioText">${p.bio ? formatWaText(p.bio) : 'Belum ada bio'}</div>
        </div>
        ${p.isMe
          ? `<div class="btn-row" style="margin-top:14px">
               <button class="btn btn-white" id="editProfileBtn">Edit Profil</button>
               <button class="btn btn-white" id="signOutBtn">Keluar</button>
             </div>
             <div id="editProfileForm" style="display:none;margin-top:14px">
               <div class="field"><label>Nickname</label><input id="nicknameInput" value="${escapeHtml(p.nickname || '')}" maxlength="32"></div>
               <div class="field">
                 <label>Username</label>
                 <input id="usernameInput" value="${escapeHtml(p.username)}" maxlength="20">
                 <div class="field-hint">${usernameCooldownHint(p.usernameChangedAt)}</div>
               </div>
               <div class="field"><label>Bio</label><textarea id="bioInput" style="min-height:80px">${escapeHtml(p.bio || '')}</textarea></div>
               <label class="checkbox-row">
                 <input type="checkbox" id="hideBadgesInput" ${p.hideBadges ? 'checked' : ''}>
                 Sembunyikan lencana (termasuk tag Developer & role)
               </label>
               <div class="field">
                 <label>Latar Belakang Kode</label>
                 <div class="field-hint">Gambar ini dipajang di belakang tampilan kode kamu pas orang buka halaman detail kode.</div>
                 <div class="btn-row" style="margin-top:8px">
                   <button type="button" class="btn btn-white" id="codeBgBtn">${p.codeBg ? 'Ganti Gambar' : 'Pilih Gambar'}</button>
                   ${p.codeBg ? `<button type="button" class="btn btn-white" id="codeBgRemoveBtn">Hapus</button>` : ''}
                 </div>
                 <input type="file" id="codeBgInput" accept="image/*" style="display:none">
               </div>
               <button class="btn btn-primary btn-block" id="saveBioBtn">Simpan</button>
             </div>`
          : `<button class="btn ${p.isFollowing ? 'btn-white' : 'btn-primary'} btn-block" id="followBtn" style="margin-top:14px">${p.isFollowing ? 'Following' : 'Follow'}</button>`}
      </div>
      <div class="section-label">Kode yang Dibagikan</div>
      <div id="profileSnippets"></div>
    `

    const list = document.getElementById('profileSnippets')
    list.innerHTML = p.snippets.length ? p.snippets.map(snippetCard).join('') : `<div class="empty-state">Belum ada kode.</div>`
    highlightAllIn('#profileSnippets pre code')
    wireLikeButtons(list)
    wireBookmarkButtons(list)

    const followBtn = document.getElementById('followBtn')
    if (followBtn) followBtn.onclick = async () => {
      if (!me) { window.location.href = '/auth'; return }
      try { await api(`/users/${username}/follow`, { method: 'POST' }); renderProfile() }
      catch (e) { toast(e.message) }
    }

    const editBtn = document.getElementById('editProfileBtn')
    if (editBtn) editBtn.onclick = () => {
      const form = document.getElementById('editProfileForm')
      form.style.display = form.style.display === 'none' ? 'block' : 'none'
    }
    const saveBioBtn = document.getElementById('saveBioBtn')
    if (saveBioBtn) saveBioBtn.onclick = async () => {
      try {
        const body = {
          bio: document.getElementById('bioInput').value,
          nickname: document.getElementById('nicknameInput').value,
          hideBadges: document.getElementById('hideBadgesInput').checked
        }
        const newUsername = document.getElementById('usernameInput').value.trim()
        if (newUsername && newUsername !== username) body.username = newUsername

        const r = await api('/users/me', { method: 'PATCH', body: JSON.stringify(body) })
        toast('Profil diperbarui!')
        if (r.username !== username) window.location.href = profileUrl(r.username)
        else renderProfile()
      } catch (e) { toast(e.message) }
    }

    const avatarBtn = document.getElementById('avatarBtn')
    const avatarInput = document.getElementById('avatarInput')
    if (avatarBtn) {
      avatarBtn.onclick = () => avatarInput.click()
      avatarInput.onchange = async () => {
        const file = avatarInput.files[0]
        if (!file) return
        try {
          const base64 = await openImageCropper(file, { outW: 256, outH: 256, shape: 'circle' })
          toast('Mengupload foto...')
          const r = await api('/users/me/avatar', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext: 'jpg' }) })
          document.getElementById('avatarImg').src = r.avatar
          if (me && me.username === username) { me.avatar = r.avatar; renderAuthArea() }
          toast('Foto profil diperbarui!')
        } catch (e) { if (e.message !== 'cancelled') toast(e.message) }
        finally { avatarInput.value = '' }
      }
    }

    const bannerBtn = document.getElementById('bannerBtn')
    const bannerAddBtn = document.getElementById('bannerAddBtn')
    const bannerInput = document.getElementById('bannerInput')
    const triggerBannerUpload = () => bannerInput && bannerInput.click()
    if (bannerBtn) bannerBtn.onclick = triggerBannerUpload
    if (bannerAddBtn) bannerAddBtn.onclick = triggerBannerUpload
    if (bannerInput) {
      bannerInput.onchange = async () => {
        const file = bannerInput.files[0]
        if (!file) return
        try {
          const base64 = await openImageCropper(file, { outW: 960, outH: 400, shape: 'rect' })
          toast('Mengupload foto sampul...')
          await api('/users/me/banner', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext: 'jpg' }) })
          toast('Foto sampul diperbarui!')
          renderProfile()
        } catch (e) { if (e.message !== 'cancelled') toast(e.message) }
        finally { bannerInput.value = '' }
      }
    }

    const codeBgBtn = document.getElementById('codeBgBtn')
    const codeBgRemoveBtn = document.getElementById('codeBgRemoveBtn')
    const codeBgInput = document.getElementById('codeBgInput')
    if (codeBgBtn) codeBgBtn.onclick = () => codeBgInput.click()
    if (codeBgInput) {
      codeBgInput.onchange = async () => {
        const file = codeBgInput.files[0]
        if (!file) return
        try {
          const base64 = await openImageCropper(file, { outW: 960, outH: 540, shape: 'rect' })
          toast('Mengupload latar belakang...')
          await api('/users/me/code-background', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext: 'jpg' }) })
          toast('Latar belakang kode diperbarui!')
          renderProfile()
        } catch (e) { if (e.message !== 'cancelled') toast(e.message) }
        finally { codeBgInput.value = '' }
      }
    }
    if (codeBgRemoveBtn) codeBgRemoveBtn.onclick = async () => {
      try {
        await api('/users/me/code-background', { method: 'DELETE' })
        toast('Latar belakang kode dihapus.')
        renderProfile()
      } catch (e) { toast(e.message) }
    }

    const signOutBtn = document.getElementById('signOutBtn')
    if (signOutBtn) signOutBtn.onclick = async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
      me = null
      window.location.href = '/'
    }
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

function cameraIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>`
}

function usernameCooldownHint(changedAt) {
  const cooldownMs = 7 * 24 * 60 * 60 * 1000
  if (!changedAt) return 'Bisa diganti kapan saja (cooldown 7 hari berlaku setelah ganti pertama).'
  const remain = cooldownMs - (Date.now() - changedAt)
  if (remain <= 0) return 'Bisa diganti kapan saja.'
  const days = Math.ceil(remain / (24 * 60 * 60 * 1000))
  return `Baru bisa ganti username lagi dalam ${days} hari.`
}

function openImageCropper(file, { outW, outH, shape = 'rect' }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Gagal memuat gambar'))
      img.onload = () => {
        const aspect = outW / outH
        const stageW = Math.min(window.innerWidth - 32, 480)
        const stageH = window.innerHeight - 190

        let boxW = stageW * 0.94
        let boxH = boxW / aspect
        if (boxH > stageH * 0.82) { boxH = stageH * 0.82; boxW = boxH * aspect }
        let boxX = (stageW - boxW) / 2
        let boxY = (stageH - boxH) / 2

        const overlay = document.createElement('div')
        overlay.className = 'cropper-overlay'
        overlay.innerHTML = `
          <div class="cropper-topbar">
            <button type="button" class="cropper-link cropper-cancel">Cancel</button>
            <button type="button" class="cropper-link cropper-save">Done</button>
          </div>
          <div class="cropper-stage" style="width:${stageW}px;height:${stageH}px">
            <canvas class="cropper-canvas" width="${stageW}" height="${stageH}"></canvas>
            <div class="cropper-cropbox${shape === 'circle' ? ' cropper-cropbox-circle' : ''}" style="left:${boxX}px;top:${boxY}px;width:${boxW}px;height:${boxH}px">
              ${shape === 'circle' ? '' : `
              <div class="cropper-grid-line cropper-grid-v1"></div>
              <div class="cropper-grid-line cropper-grid-v2"></div>
              <div class="cropper-grid-line cropper-grid-h1"></div>
              <div class="cropper-grid-line cropper-grid-h2"></div>`}
              <span class="cropper-corner cropper-corner-tl"></span>
              <span class="cropper-corner cropper-corner-tr"></span>
              <span class="cropper-corner cropper-corner-bl"></span>
              <span class="cropper-corner cropper-corner-br"></span>
            </div>
          </div>
          <div class="cropper-zoom-row">
            <span class="cropper-zoom-icon">－</span>
            <input type="range" class="cropper-zoom" min="0" max="100" value="0">
            <span class="cropper-zoom-icon">＋</span>
          </div>
        `
        document.body.appendChild(overlay)

        const canvas = overlay.querySelector('.cropper-canvas')
        const ctx = canvas.getContext('2d')
        const zoomSlider = overlay.querySelector('.cropper-zoom')

        const minScale = Math.max(boxW / img.width, boxH / img.height)
        const maxScale = minScale * 4
        let scale = minScale
        let offX = boxX + (boxW - img.width * scale) / 2
        let offY = boxY + (boxH - img.height * scale) / 2

        function clampOffset() {
          const w = img.width * scale, h = img.height * scale
          offX = Math.min(boxX, Math.max(boxX + boxW - w, offX))
          offY = Math.min(boxY, Math.max(boxY + boxH - h, offY))
        }
        function draw() {
          ctx.clearRect(0, 0, stageW, stageH)
          ctx.drawImage(img, offX, offY, img.width * scale, img.height * scale)
        }
        clampOffset(); draw()

        function zoomAt(cx, cy, newScale) {
          newScale = Math.min(maxScale, Math.max(minScale, newScale))
          const imgX = (cx - offX) / scale, imgY = (cy - offY) / scale
          scale = newScale
          offX = cx - imgX * scale
          offY = cy - imgY * scale
        }
        function syncZoomSlider() {
          const t = (scale - minScale) / (maxScale - minScale)
          zoomSlider.value = Math.round(t * 100)
        }
        zoomSlider.oninput = () => {
          const t = zoomSlider.value / 100
          zoomAt(boxX + boxW / 2, boxY + boxH / 2, minScale + (maxScale - minScale) * t)
          clampOffset(); draw()
        }

        // Cubit dua jari buat zoom in/out langsung di gambar (pinch-to-zoom),
        // selain lewat slider. Titik tengah kedua jari jadi jangkar zoom-nya
        // biar area yang dicubit tetap di tempat, gak lompat-lompat.
        let dragging = false, lastX = 0, lastY = 0
        let pinching = false, pinchStartDist = 0, pinchStartScale = minScale

        function touchDist(t0, t1) {
          return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
        }
        function stagePoint(clientX, clientY) {
          const rect = canvas.getBoundingClientRect()
          return { x: clientX - rect.left, y: clientY - rect.top }
        }
        function down(e) {
          if (e.touches && e.touches.length === 2) {
            dragging = false
            pinching = true
            pinchStartDist = touchDist(e.touches[0], e.touches[1])
            pinchStartScale = scale
            return
          }
          dragging = true
          const p = e.touches ? e.touches[0] : e
          lastX = p.clientX; lastY = p.clientY
        }
        function move(e) {
          if (e.touches && e.touches.length === 2) {
            pinching = true
            const dist = touchDist(e.touches[0], e.touches[1])
            const mid = stagePoint(
              (e.touches[0].clientX + e.touches[1].clientX) / 2,
              (e.touches[0].clientY + e.touches[1].clientY) / 2
            )
            zoomAt(mid.x, mid.y, pinchStartScale * (dist / pinchStartDist))
            syncZoomSlider()
            clampOffset(); draw()
            if (e.cancelable) e.preventDefault()
            return
          }
          if (pinching || !dragging) return
          const p = e.touches ? e.touches[0] : e
          offX += p.clientX - lastX; offY += p.clientY - lastY
          lastX = p.clientX; lastY = p.clientY
          clampOffset(); draw()
          if (e.cancelable) e.preventDefault()
        }
        function up(e) {
          dragging = false
          if (!e.touches || e.touches.length < 2) pinching = false
        }

        canvas.addEventListener('mousedown', down)
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
        canvas.addEventListener('touchstart', down, { passive: true })
        canvas.addEventListener('touchmove', move, { passive: false })
        canvas.addEventListener('touchend', up)
        canvas.addEventListener('touchcancel', up)

        function cleanup() {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          overlay.remove()
        }

        overlay.querySelector('.cropper-cancel').onclick = () => { cleanup(); reject(new Error('cancelled')) }
        overlay.querySelector('.cropper-save').onclick = () => {
          const outCanvas = document.createElement('canvas')
          outCanvas.width = outW; outCanvas.height = outH
          const octx = outCanvas.getContext('2d')
          const factor = outW / boxW
          octx.drawImage(
            img,
            (offX - boxX) * factor, (offY - boxY) * factor,
            img.width * scale * factor, img.height * scale * factor
          )
          const dataUrl = outCanvas.toDataURL('image/jpeg', 0.9)
          cleanup()
          resolve(dataUrl.split(',')[1])
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

refreshAuth()
renderProfile()
