
/** Platform koneksi sosial — value bisa handle, nomor, atau URL penuh */
const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', placeholder: 'Instagram', color: '#E4405F' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', placeholder: 'WhatsApp (62812…)', color: '#25D366' },
  { id: 'github', label: 'GitHub', icon: 'fa-brands fa-github', placeholder: 'GitHub', color: '#333' },
  { id: 'telegram', label: 'Telegram', icon: 'fa-brands fa-telegram', placeholder: 'Telegram', color: '#26A5E4' },
  { id: 'twitter', label: 'X', icon: 'fa-brands fa-x-twitter', placeholder: 'X / Twitter', color: '#111' }
]

function socialToUrl(id, value) {
  if (!value) return null
  const v = String(value).trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  const handle = v.replace(/^@+/, '')
  switch (id) {
    case 'instagram': return 'https://instagram.com/' + encodeURIComponent(handle)
    case 'twitter': return 'https://x.com/' + encodeURIComponent(handle)
    case 'github': return 'https://github.com/' + encodeURIComponent(handle)
    case 'youtube':
      if (handle.startsWith('@')) return 'https://youtube.com/' + handle
      return 'https://youtube.com/@' + encodeURIComponent(handle)
    case 'tiktok': return 'https://tiktok.com/@' + encodeURIComponent(handle)
    case 'whatsapp': {
      const phone = v.replace(/[^\d]/g, '')
      return phone ? 'https://wa.me/' + phone : null
    }
    case 'telegram': return 'https://t.me/' + encodeURIComponent(handle)
    case 'linkedin':
      if (handle.includes('/')) return 'https://linkedin.com/' + handle.replace(/^\//, '')
      return 'https://linkedin.com/in/' + encodeURIComponent(handle)
    case 'discord': return 'https://discord.com/users/' + encodeURIComponent(handle)
    default: return v
  }
}

function socialDisplayLabel(id, value) {
  if (!value) return ''
  const v = String(value).trim()
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v)
      return u.host.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '')
    } catch { return v }
  }
  if (id === 'whatsapp') return v.replace(/[^\d+]/g, '')
  return v.startsWith('@') ? v : '@' + v.replace(/^@+/, '')
}

function profileSocialsHtml(socials) {
  const data = socials && typeof socials === 'object' ? socials : {}
  const items = SOCIAL_PLATFORMS.filter(p => data[p.id]).map(p => {
    const raw = data[p.id]
    const href = socialToUrl(p.id, raw)
    if (!href) return ''
    const title = p.label + ': ' + socialDisplayLabel(p.id, raw)
    return `<a class="profile-social-btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" style="--social-color:${p.color}">
      <i class="${p.icon}" aria-hidden="true"></i>
    </a>`
  }).filter(Boolean)
  if (!items.length) return ''
  return `<div class="profile-socials" role="list">${items.join('')}</div>`
}

/** State untuk editor connections di modal (hanya platform yang ditambahkan) */
let editSocialState = {}

function renderConnectionsEditor(root) {
  if (!root) return
  const state = editSocialState || {}
  const active = SOCIAL_PLATFORMS.filter(p => state[p.id] !== undefined)
  const available = SOCIAL_PLATFORMS.filter(p => state[p.id] === undefined)

  const rows = active.map(p => `
    <div class="conn-row" data-conn="${p.id}">
      <span class="conn-icon" style="--social-color:${p.color}" aria-hidden="true"><i class="${p.icon}"></i></span>
      <input type="text" data-social="${p.id}" maxlength="120" placeholder="${escapeHtml(p.placeholder)}" value="${escapeHtml(state[p.id] || '')}" autocomplete="off" aria-label="${escapeHtml(p.label)}">
      <button type="button" class="conn-remove" data-remove="${p.id}" aria-label="Remove ${escapeHtml(p.label)}" title="Remove">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>`).join('')

  const addBtn = available.length
    ? `<button type="button" class="conn-add-btn" id="connAddBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>Add</span></button>`
    : ''

  const picker = available.length ? `
    <div class="conn-picker" id="connPicker" hidden>
      ${available.map(p => `
        <button type="button" class="conn-picker-item" data-add="${p.id}">
          <span class="conn-icon" style="--social-color:${p.color}"><i class="${p.icon}"></i></span>
          <span>${escapeHtml(p.label)}</span>
        </button>`).join('')}
    </div>` : ''

  root.innerHTML = `
    <div class="conn-list">${rows || `<div class="conn-empty">No connections yet</div>`}</div>
    <div class="conn-actions">${addBtn}</div>
    ${picker}`

  // Sync inputs → state
  root.querySelectorAll('input[data-social]').forEach(inp => {
    inp.addEventListener('input', () => {
      editSocialState[inp.dataset.social] = inp.value
    })
  })
  root.querySelectorAll('[data-remove]').forEach(btn => {
    btn.onclick = () => {
      delete editSocialState[btn.dataset.remove]
      renderConnectionsEditor(root)
    }
  })
  const addBtnEl = root.querySelector('#connAddBtn')
  const pickerEl = root.querySelector('#connPicker')
  if (addBtnEl && pickerEl) {
    addBtnEl.onclick = () => {
      const open = pickerEl.hasAttribute('hidden')
      if (open) pickerEl.removeAttribute('hidden')
      else pickerEl.setAttribute('hidden', '')
      addBtnEl.classList.toggle('is-open', open)
    }
  }
  root.querySelectorAll('[data-add]').forEach(btn => {
    btn.onclick = () => {
      editSocialState[btn.dataset.add] = ''
      renderConnectionsEditor(root)
      const inp = root.querySelector(`input[data-social="${btn.dataset.add}"]`)
      if (inp) inp.focus()
    }
  })
}

function collectSocialsFromForm() {
  const out = {}
  // Prefer live inputs if present
  document.querySelectorAll('#connEditorRoot input[data-social]').forEach(inp => {
    const v = (inp.value || '').trim()
    if (v) out[inp.dataset.social] = v
  })
  // Also merge state keys that might be empty (skip empties)
  Object.keys(editSocialState || {}).forEach(k => {
    if (out[k]) return
    const v = String(editSocialState[k] || '').trim()
    if (v) out[k] = v
  })
  return out
}

function openEditProfileModal(p, username) {
  editSocialState = {}
  const existing = (p.socials && typeof p.socials === 'object') ? p.socials : {}
  SOCIAL_PLATFORMS.forEach(plat => {
    if (existing[plat.id]) editSocialState[plat.id] = existing[plat.id]
  })

  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">${t('editProfile')}</div>
      <button type="button" class="modal-close-btn" id="editProfileCloseBtn" aria-label="Close">${closeIconSvg()}</button>
    </div>
    <div class="modal-body profile-edit-modal">
      <div class="pe-section">
        <div class="pe-section-title">Basic</div>
        <div class="field"><label>${t('nickname')}</label><input id="nicknameInput" value="${escapeHtml(p.nickname || '')}" maxlength="32"></div>
        <div class="field">
          <label>${t('username')}</label>
          <input id="usernameInput" value="${escapeHtml(p.username)}" maxlength="20">
          <div class="field-hint">${usernameCooldownHint(p.usernameChangedAt)}</div>
        </div>
        <div class="field"><label>${t('bio')}</label><textarea id="bioInput" class="textarea-autogrow" style="min-height:72px">${escapeHtml(p.bio || '')}</textarea></div>
      </div>
      <div class="pe-section">
        <div class="pe-section-title">About</div>
        <div class="field">
          <label>${t('location')} <span class="label-opt">(${t('optional')})</span></label>
          <input id="locationInput" type="text" maxlength="64" placeholder="${t('locationPlaceholder')}" value="${escapeHtml(p.location || '')}">
        </div>
        <div class="field">
          <label>${t('website')} <span class="label-opt">(${t('optional')})</span></label>
          <input id="websiteInput" type="text" inputmode="url" placeholder="${t('websitePlaceholder')}" value="${escapeHtml(p.website || '')}" maxlength="300">
        </div>
      </div>
      <div class="pe-section">
        <div class="pe-section-title">${t('connections')}</div>
        <div class="field-hint" style="margin-bottom:10px">${t('connectionsHint')}</div>
        <div id="connEditorRoot"></div>
      </div>
      <div class="pe-section">
        <div class="pe-section-title">Extras</div>
        <div class="field">
          <label>${t('musicUrl')} <span class="label-opt">(${t('optional')})</span></label>
          <input id="musicInput" type="url" placeholder="https://…/audio.mp3" value="${escapeHtml(p.profileMusic || '')}">
        </div>
        <label class="checkbox-row">
          <input type="checkbox" id="hideBadgesInput" ${p.hideBadges ? 'checked' : ''}>
          ${t('hideBadges')}
        </label>
      </div>
    </div>
    <div class="profile-edit-footer">
      <button type="button" class="btn btn-white" id="editProfileCancelBtn">Cancel</button>
      <button type="button" class="btn btn-primary" id="saveBioBtn">${t('save')}</button>
    </div>
  `)

  const box = document.getElementById('modalBox')
  if (box) box.classList.add('modal-box-profile-edit')

  const connRoot = document.getElementById('connEditorRoot')
  renderConnectionsEditor(connRoot)

  const closeEdit = () => {
    if (box) box.classList.remove('modal-box-profile-edit')
    closeModal(true)
  }
  document.getElementById('editProfileCloseBtn')?.addEventListener('click', closeEdit)
  document.getElementById('editProfileCancelBtn')?.addEventListener('click', closeEdit)

  const saveBioBtn = document.getElementById('saveBioBtn')
  if (saveBioBtn) saveBioBtn.onclick = async () => {
    await withBtnLoading(saveBioBtn, async () => {
      try {
        const body = {
          bio: document.getElementById('bioInput')?.value || '',
          nickname: document.getElementById('nicknameInput')?.value || '',
          profileMusic: (document.getElementById('musicInput')?.value || '').trim(),
          website: (document.getElementById('websiteInput')?.value || '').trim(),
          location: (document.getElementById('locationInput')?.value || '').trim(),
          socials: collectSocialsFromForm(),
          hideBadges: !!document.getElementById('hideBadgesInput')?.checked
        }
        const newUsername = (document.getElementById('usernameInput')?.value || '').trim()
        if (newUsername && newUsername !== username) body.username = newUsername

        const r = await api('/users/me', { method: 'PATCH', body: JSON.stringify(body) })
        toast('Profile updated')
        closeEdit()
        if (r.username !== username) window.location.href = profileUrl(r.username)
        else renderProfile()
      } catch (e) { toast(e.message) }
    })
  }
}




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
          <div class="profile-bio" id="bioText">${p.bio ? formatWaText(p.bio) : `<span class="profile-bio-empty">${t('noBio')}</span>`}</div>
          ${(() => {
            const joined = formatJoined(p.createdAt)
            const site = (p.website || '').trim()
            const loc = (p.location || '').trim()
            const items = []
            if (joined) items.push(`<div class="profile-meta-item" title="${escapeHtml(formatJoinedFull(p.createdAt))}">
                <i class="fa-regular fa-calendar profile-meta-icon" aria-hidden="true"></i>
                <span class="profile-meta-text">${t('joined')} ${escapeHtml(joined)}</span>
              </div>`)
            if (loc) items.push(`<div class="profile-meta-item" title="${escapeHtml(loc)}">
                <i class="fa-solid fa-location-dot profile-meta-icon" aria-hidden="true"></i>
                <span class="profile-meta-text">${escapeHtml(loc)}</span>
              </div>`)
            if (site) items.push(`<a class="profile-meta-item profile-meta-link" href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(site)}">
                <i class="fa-solid fa-arrow-up-right-from-square profile-meta-icon" aria-hidden="true"></i>
                <span class="profile-meta-text">${escapeHtml(websiteDisplayHost(site))}</span>
              </a>`)
            const meta = items.length ? `<div class="profile-meta-list">${items.join('')}</div>` : ''
            return meta + profileSocialsHtml(p.socials)
          })()}
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
             </div>`
          : `<button class="btn ${p.isFollowing ? 'btn-white' : 'btn-primary'} btn-block profile-actions" id="followBtn">${p.isFollowing ? t('following') : t('follow')}</button>`}
      </div>
      <div class="section-label">${t('sharedCode')}</div>
      <div id="profileSnippets"></div>
    `

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
      await withBtnLoading(followBtn, async () => {
        try { await api(`/users/${username}/follow`, { method: 'POST' }); renderProfile() }
        catch (e) { toast(e.message) }
      })
    }

    const editBtn = document.getElementById('editProfileBtn')
    if (editBtn) editBtn.onclick = () => openEditProfileModal(p, username)

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
          // 256px + WebP 0.82 -- lebih kecil & lebih cepat didownload dari JPEG
          const { base64, mime, ext } = await openImageCropper(file, { outW: 256, outH: 256, shape: 'circle', quality: 0.82 })
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
          const previewUrl = `data:${mime};base64,${base64}`
          const avatarImgEl = document.getElementById('avatarImg')
          avatarImgEl.src = previewUrl
          document.querySelectorAll('#profileSnippets .avatar-circle').forEach(img => { img.src = previewUrl })
          if (me && me.username === username) { me.avatar = previewUrl; renderAuthArea() }

          avatarBtn.classList.add('is-uploading')
          avatarBtn.disabled = true
          addUploadingSpinner(avatarBtn)
          toast('Mengupload foto...')
          await api('/users/me/avatar', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext }) })
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
          // 800×333 + WebP 0.78 -- cukup lebar di mobile, lebih hemat kuota dari JPEG
          const { base64, mime, ext } = await openImageCropper(file, { outW: 800, outH: 333, shape: 'rect', quality: 0.78 })
          // Sama kayak avatar: pasang preview lokal (data URL hasil crop)
          // LANGSUNG duluan, biar gak ada celah waktu di mana banner sempat
          // kelihatan balik ke yang lama pas nunggu response server / URL
          // server di-refetch.
          const previewUrl = `data:${mime};base64,${base64}`
          const bannerImgEl = document.getElementById('bannerImg')
          bannerImgEl.style.backgroundImage = `url('${previewUrl}')`
          bannerImgEl.closest('.profile-banner-wrap').classList.remove('no-banner')

          bannerBtn.classList.add('is-uploading')
          bannerBtn.disabled = true
          addUploadingSpinner(bannerBtn)
          toast('Mengupload foto sampul...')
          await api('/users/me/banner', { method: 'POST', body: JSON.stringify({ imageBase64: base64, ext }) })
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
      await withBtnLoading(signOutBtn, async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {})
        me = null
        window.location.href = '/'
      })
    }
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

function cameraIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>`
}

function formatJoined(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatJoinedFull(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function websiteDisplayHost(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    let host = u.host + (u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '')
    if (host.length > 42) host = host.slice(0, 39) + '…'
    return host
  } catch {
    let s = String(url).replace(/^https?:\/\//i, '').replace(/\/$/, '')
    if (s.length > 42) s = s.slice(0, 39) + '…'
    return s
  }
}

function usernameCooldownHint(changedAt) {
  const cooldownMs = 7 * 24 * 60 * 60 * 1000
  if (!changedAt) return 'Bisa diganti kapan saja (cooldown 7 hari berlaku setelah ganti pertama).'
  const remain = cooldownMs - (Date.now() - changedAt)
  if (remain <= 0) return 'Bisa diganti kapan saja.'
  const days = Math.ceil(remain / (24 * 60 * 60 * 1000))
  return `Baru bisa ganti username lagi dalam ${days} hari.`
}

function openImageCropper(file, { outW, outH, shape = 'rect', quality = 0.82 }) {
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
          // WebP dulu (jauh lebih kecil dari JPEG di kualitas yang sama).
          // Kalau browser gak support encode WebP lewat canvas, toDataURL
          // otomatis fallback ke PNG -- makanya mime & ext dibaca dari hasil
          // asli dataUrl-nya, bukan di-hardcode, biar gak salah label.
          const dataUrl = outCanvas.toDataURL('image/webp', quality)
          cleanup()
          const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
          const ext = mime === 'image/webp' ? 'webp' : (mime === 'image/png' ? 'png' : 'jpg')
          resolve({ base64: dataUrl.split(',')[1], mime, ext })
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

