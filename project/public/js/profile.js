

async function renderProfile() {
  const app = document.getElementById('app')
  const username = qs('u')
  if (!username) { app.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Profile not found' })}</div>`; return }
  app.innerHTML = skelProfileHeader()
  try {
    const p = await api(`/users/${username}`)
    const totalViews = p.totalViews ?? p.snippets.reduce((sum, s) => sum + (s.views || 0), 0)
    app.innerHTML = `
      <div class="card profile-card">
        <div class="profile-banner-wrap${p.banner ? '' : ' no-banner'}">
          <div class="profile-banner-img" id="bannerImg" style="${p.banner ? `background-image:url('${p.banner}')` : ''}"></div>
          <div class="profile-banner-fade"></div>
          ${p.isMe ? `<button type="button" class="banner-pencil-btn" id="bannerBtn" aria-label="Change cover photo">${cameraIconSvg()}</button>` : ''}
        </div>
        ${p.isMe ? `<input type="file" id="bannerInput" accept="image/*" style="display:none">` : ''}
        <div class="profile-head">
          <div class="avatar-wrap">
            <img class="avatar avatar-circle" id="avatarImg" src="${p.avatar}">
            ${p.isMe ? `<button type="button" class="avatar-pencil-btn" id="avatarBtn" aria-label="Change profile photo">${cameraIconSvg()}</button>` : ''}
            <input type="file" id="avatarInput" accept="image/*" style="display:none">
          </div>
          <div class="profile-names">
            <div class="profile-nickname">${escapeHtml(p.nickname || p.username)}${badgesHtml(p.badges)}${devBadgeHtml(p.isDeveloper)}${roleBadgeHtml(p.role)}</div>
            <div class="profile-username">@${escapeHtml(p.username)}</div>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat"><b>${p.snippets.length}</b><span>${t('codes')}</span></div>
          <div class="stat"><b>${formatViews(totalViews)}</b><span>${t('views')}</span></div>
          <div class="stat"><b>${p.totalLikes ?? 0}</b><span>${t('likes')}</span></div>
          <a class="stat" href="${followUrl(p.username, 'followers')}"><b>${p.followersCount}</b><span>${t('followers')}</span></a>
          <a class="stat" href="${followUrl(p.username, 'following')}"><b>${p.followingCount}</b><span>${t('followingStat')}</span></a>
        </div>
        <div class="profile-below-stats">
          <div class="profile-bio" id="bioText">${p.bio ? formatWaText(p.bio) : t('noBio')}</div>
          ${p.profileMusic ? `
          <div class="profile-music" id="profileMusicBar">
            <div class="pm-circle-wrap">
              <svg class="pm-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle class="pm-ring-bg" cx="18" cy="18" r="15.5" fill="none"/>
                <circle class="pm-ring-fg" id="pmRingFg" cx="18" cy="18" r="15.5" fill="none"
                  stroke-dasharray="97.4" stroke-dashoffset="97.4"/>
              </svg>
              <button type="button" class="pm-btn" id="pmToggle" aria-label="${t('playPause')}">${playIconMini()}</button>
            </div>
            <div class="pm-meta">
              <span class="pm-label">${escapeHtml(p.nickname || p.username)} · ${t('music')}</span>
              <span class="pm-hint" id="pmTrackName">${escapeHtml(musicTitleFromUrl(p.profileMusic))}</span>
            </div>
            <span class="pm-time" id="pmTime">0:00</span>
            <audio id="profileAudio" src="${escapeHtml(p.profileMusic)}" preload="metadata" loop></audio>
          </div>` : ''}
        </div>
        ${p.isMe
          ? `<div class="btn-row profile-actions">
               <button class="btn btn-white" id="editProfileBtn">${t('editProfile')}</button>
               <button class="btn btn-white" id="signOutBtn">${t('signOut')}</button>
             </div>
             <div id="editProfileForm" style="display:none;margin-top:14px">
               <div class="field"><label>${t('nickname')}</label><input id="nicknameInput" value="${escapeHtml(p.nickname || '')}" maxlength="32"></div>
               <div class="field">
                 <label>${t('username')}</label>
                 <input id="usernameInput" value="${escapeHtml(p.username)}" maxlength="20">
                 <div class="field-hint">${usernameCooldownHint(p.usernameChangedAt)}</div>
               </div>
               <div class="field"><label>${t('bio')}</label><textarea id="bioInput" style="min-height:80px">${escapeHtml(p.bio || '')}</textarea></div>
               <div class="field">
                 <label>${t('musicUrl')} <span class="label-opt">(${t('optional')})</span></label>
                 <input id="musicInput" type="url" placeholder="https://…/audio.mp3" value="${escapeHtml(p.profileMusic || '')}">
                 <div class="field-hint">${t('musicHint')}</div>
               </div>
               <label class="checkbox-row">
                 <input type="checkbox" id="hideBadgesInput" ${p.hideBadges ? 'checked' : ''}>
                 ${t('hideBadges')}
               </label>
               <button class="btn btn-primary btn-block" id="saveBioBtn">${t('save')}</button>
             </div>`
          : `<button class="btn ${p.isFollowing ? 'btn-white' : 'btn-primary'} btn-block profile-actions" id="followBtn">${p.isFollowing ? t('following') : t('follow')}</button>`}
      </div>
      <div id="profileCollections"></div>
      <div class="section-label">${t('sharedCode')}</div>
      <div id="profileSnippets"></div>
    `

    // Public collections of this user (shown above their codes)
    loadProfileCollections(p.username, p.isMe)

    const list = document.getElementById('profileSnippets')
    const pinCount = (p.pinnedShortIds || []).length
    const sectionLabel = document.querySelector('.section-label')
    if (sectionLabel && pinCount) {
      sectionLabel.innerHTML = `${t('sharedCode')}${pinCount ? ` <span class="pin-hint">${pinCount} pinned</span>` : ''}`
    }
    list.innerHTML = p.snippets.length
      ? p.snippets.map(s => {
          let card = snippetCard(s)
          if (!s.pinned) return card
          card = card.replace('class="snippet-card"', 'class="snippet-card is-pinned"')
          card = card.replace('<h3 class="sc-title">', '<h3 class="sc-title"><span class="pin-badge" title="Pinned">📌</span> ')
          return card
        }).join('')
      : (p.isMe
          ? emptyStateHtml({
               title: t('noCodeYet'),
               sub: t('noCodeYetSub'),
               actionHtml: `<a class="btn btn-primary" href="/upload">${t('uploadCode')}</a>`
             })
          : emptyStateHtml({ title: t('noCodeShared') }))
    highlightAllIn('#profileSnippets pre code')
    wireLikeButtons(list)
    wireBookmarkButtons(list)
    wireCopyLinkButtons(list)


    // Profile music — circular progress + duration next to play button
    const audio = document.getElementById('profileAudio')
    const pmBtn = document.getElementById('pmToggle')
    const pmTime = document.getElementById('pmTime')
    const pmRing = document.getElementById('pmRingFg')
    const RING = 97.4 // 2 * PI * 15.5
    if (audio && pmBtn) {
      audio.volume = 0.22
      const fmt = (s) => {
        if (!isFinite(s) || s < 0) return '0:00'
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return m + ':' + String(sec).padStart(2, '0')
      }
      const setIcon = (playing) => {
        pmBtn.innerHTML = playing ? pauseIconMini() : playIconMini()
        pmBtn.classList.toggle('playing', playing)
      }
      const tick = () => {
        const cur = audio.currentTime || 0
        const dur = audio.duration
        if (pmTime) {
          if (isFinite(dur) && dur > 0) pmTime.textContent = fmt(cur) + ' / ' + fmt(dur)
          else pmTime.textContent = fmt(cur)
        }
        if (pmRing && isFinite(dur) && dur > 0) {
          const pct = Math.min(1, cur / dur)
          pmRing.style.strokeDashoffset = String(RING * (1 - pct))
        }
      }
      pmBtn.onclick = () => {
        if (audio.paused) {
          audio.play().then(() => setIcon(true)).catch(() => toast('Tap again to play music'))
        } else {
          audio.pause()
          setIcon(false)
        }
      }
      audio.addEventListener('timeupdate', tick)
      audio.addEventListener('loadedmetadata', tick)
      audio.addEventListener('ended', () => { setIcon(false); tick() })
      audio.addEventListener('pause', () => setIcon(false))
      audio.addEventListener('play', () => setIcon(true))
      audio.play().then(() => setIcon(true)).catch(() => setIcon(false))

      const stopMusic = () => {
        try {
          audio.pause()
          audio.currentTime = 0
          setIcon(false)
          tick()
        } catch {}
      }
      // Stop when leaving page / closing tab / switching away
      window.addEventListener('pagehide', stopMusic)
      window.addEventListener('beforeunload', stopMusic)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') stopMusic()
      })
      // SPA-style navigation within site
      window.addEventListener('popstate', stopMusic)
      document.querySelectorAll('a[href]').forEach(a => {
        a.addEventListener('click', (e) => {
          const href = a.getAttribute('href')
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) stopMusic()
        }, { once: false, passive: true })
      })
      tick()
    }

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
      setBtnLoading(saveBioBtn, true)
      try {
        const body = {
          bio: document.getElementById('bioInput').value,
          nickname: document.getElementById('nicknameInput').value,
          profileMusic: (document.getElementById('musicInput')?.value || '').trim(),
          hideBadges: document.getElementById('hideBadgesInput').checked
        }
        const newUsername = document.getElementById('usernameInput').value.trim()
        if (newUsername && newUsername !== username) body.username = newUsername

        const r = await api('/users/me', { method: 'PATCH', body: JSON.stringify(body) })
        toast('Profil diperbarui!')
        if (r.username !== username) window.location.href = profileUrl(r.username)
        else renderProfile()
      } catch (e) { toast(e.message); setBtnLoading(saveBioBtn, false) }
    }

    // Penting: tombol kamera (avatar & banner) TIDAK PERNAH dipindah posisinya.
    // Selama upload berlangsung, tombolnya cuma dikasih class "is-uploading"
    // (spinner + disabled) di tempat yang sama -- gak ada re-render struktur
    // ulang yang bisa bikin ikonnya "lompat".
    const avatarBtn = document.getElementById('avatarBtn')
    const avatarInput = document.getElementById('avatarInput')
    if (avatarBtn) {
      avatarBtn.onclick = () => avatarInput.click()
      avatarInput.onchange = async () => {
        const file = avatarInput.files[0]
        if (!file) return
        try {
          const base64 = await openImageCropper(file, { outW: 256, outH: 256, shape: 'circle' })
          // FIX "kedip balik ke foto lama": sebelumnya kita nunggu response
          // server dulu baru ganti src avatar ke URL server (`/avatar/user?v=...`).
          // Ganti-ke-URL itu artinya browser harus request ulang ke server, dan
          // kalau request itu kebetulan nyasar ke instance server yang belum
          // sempat tau data barusan (server ini jalan di serverless, beberapa
          // instance sekaligus), sempat kejadian foto SEMPAT balik nampilin
          // yang lama dulu sebelum akhirnya ke-update.
          // Fixnya: begitu hasil crop siap, langsung pasang sebagai preview
          // (data URL) -- ini PERSIS byte yang bakal diupload, jadi user
          // gak pernah lihat apa pun selain hasil crop barunya, gak ada
          // celah waktu buat foto lama nongol lagi.
          const previewUrl = `data:image/jpeg;base64,${base64}`
          const avatarImgEl = document.getElementById('avatarImg')
          avatarImgEl.src = previewUrl
          document.querySelectorAll('#profileSnippets .avatar-circle').forEach(img => { img.src = previewUrl })
          if (me && me.username === username) { me.avatar = previewUrl; renderAuthArea() }

          avatarBtn.classList.add('is-uploading')
          avatarBtn.disabled = true
          addUploadingSpinner(avatarBtn)
          toast('Mengupload foto...')
          await api('/users/me/avatar', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext: 'jpg' }) })
          // Sengaja TIDAK ganti src lagi ke URL server sesudah ini -- preview
          // lokal di atas udah identik sama yang barusan diupload. Reload
          // halaman berikutnya bakal otomatis pakai URL server yang baru
          // (waktu yang udah lewat cukup buat data server settle).
          toast('Foto profil diperbarui!')
        } catch (e) { if (e.message !== 'cancelled') toast(e.message) }
        finally {
          avatarInput.value = ''
          avatarBtn.classList.remove('is-uploading')
          avatarBtn.disabled = false
          removeUploadingSpinner(avatarBtn)
        }
      }
    }

    const bannerBtn = document.getElementById('bannerBtn')
    const bannerInput = document.getElementById('bannerInput')
    if (bannerBtn) bannerBtn.onclick = () => bannerInput.click()
    if (bannerInput) {
      bannerInput.onchange = async () => {
        const file = bannerInput.files[0]
        if (!file) return
        try {
          const base64 = await openImageCropper(file, { outW: 960, outH: 400, shape: 'rect' })
          // Sama kayak avatar: pasang preview lokal (data URL hasil crop)
          // LANGSUNG duluan, biar gak ada celah waktu di mana banner sempat
          // kelihatan balik ke yang lama pas nunggu response server / URL
          // server di-refetch.
          const previewUrl = `data:image/jpeg;base64,${base64}`
          const bannerImgEl = document.getElementById('bannerImg')
          bannerImgEl.style.backgroundImage = `url('${previewUrl}')`
          bannerImgEl.closest('.profile-banner-wrap').classList.remove('no-banner')

          bannerBtn.classList.add('is-uploading')
          bannerBtn.disabled = true
          addUploadingSpinner(bannerBtn)
          toast('Mengupload foto sampul...')
          await api('/users/me/banner', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext: 'jpg' }) })
          // Gak perlu ganti background-image lagi ke URL server -- preview
          // lokal di atas udah sama persis sama yang barusan diupload.
          toast('Foto sampul diperbarui!')
        } catch (e) { if (e.message !== 'cancelled') toast(e.message) }
        finally {
          bannerInput.value = ''
          bannerBtn.classList.remove('is-uploading')
          bannerBtn.disabled = false
          removeUploadingSpinner(bannerBtn)
        }
      }
    }

    const signOutBtn = document.getElementById('signOutBtn')
    if (signOutBtn) signOutBtn.onclick = async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
      me = null
      window.location.href = '/'
    }
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
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

function musicTitleFromUrl(url) {
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    const base = path.split('/').filter(Boolean).pop() || 'Track'
    const name = base.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim()
    return name || 'Track'
  } catch {
    return 'Track'
  }
}

function playIconMini() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
}
function pauseIconMini() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`
}

async function loadProfileCollections(username, isMe) {
  const el = document.getElementById('profileCollections')
  if (!el) return
  try {
    const list = await api(`/collections/user/${encodeURIComponent(username)}`)
    // Non-owners only see public; API already filters. Hide section if empty (unless isMe with manage link).
    if (!list.length) {
      if (isMe) {
        el.innerHTML = `
          <div class="section-label">Collections</div>
          <div class="card" style="padding:14px 16px">
            <p class="field-hint" style="margin:0 0 10px">Organize codes into series or playlists.</p>
            <a class="btn btn-sm btn-primary" href="/collections">Manage collections</a>
          </div>`
      } else {
        el.innerHTML = ''
      }
      return
    }
    el.innerHTML = `
      <div class="section-label">Collections${isMe ? ` <a href="/collections" class="section-link">Manage</a>` : ''}</div>
      <div class="col-profile-list">
        ${list.map(c => {
          const n = c.count || (c.shortIds || []).length || 0
          const vis = c.isPublic === false ? `<span class="col-badge col-badge-private">Private</span>` : ''
          return `<a class="col-profile-item" href="/collection?id=${encodeURIComponent(c.shortId)}">
            <span class="col-profile-title">${escapeHtml(c.title)}</span>
            <span class="col-profile-meta">${n} code${n === 1 ? '' : 's'} ${vis}</span>
          </a>`
        }).join('')}
      </div>`
  } catch {
    el.innerHTML = ''
  }
}
