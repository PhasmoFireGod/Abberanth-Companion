/* ============================================================
   Abberanth Companion — Auth Guard
   - Redirects unauthenticated users to login.html
   - Fetches/sets username; prompts on first login
   - Sets window.isDM, window._username, window._userDisplay
   - Exposes window.onAuthReady(callback)
   - Populates sidebar footer: display name + Sign Out
   ============================================================ */

(function () {

  /* ---- Helpers ---- */
  function getLoginUrl() {
    const inPages = window.location.pathname.toLowerCase().includes('/pages/');
    return inPages ? 'login.html' : 'pages/login.html';
  }

  function checkIsDM(user) {
    const emails = (window.SITE_CONFIG && window.SITE_CONFIG.dmEmails) || [];
    return emails.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
  }

  /* ---- Username fetch ---- */
  async function fetchAndSetUsername(user) {
    if (!window._db) return;
    try {
      const snap = await window._db.collection('players').doc(user.uid).get();
      const data = snap.data() || {};
      window._username    = data.username  || null;
      window._userDisplay = data.username  || user.email;
      window._avatarUrl   = data.avatarUrl || null;
    } catch (_) {
      window._username    = null;
      window._userDisplay = user.email;
    }
  }

  /* ---- Username modal ---- */
  function showUsernameModal(user, optional = true) {
    document.getElementById('username-modal')?.remove();

    const wrap = document.createElement('div');
    wrap.id = 'username-modal';
    wrap.className = 'username-modal-overlay';
    wrap.innerHTML = `
      <div class="username-modal-panel">
        <h2>🧙 Choose a Username</h2>
        <p>This is how other players will see you — your email stays private.</p>
        <input class="username-modal-input" id="um-input" type="text"
          maxlength="20"
          placeholder="YourUsername"
          value="${window._username ? escAttr(window._username) : ''}" />
        <p class="um-hint">2–20 characters. Can include spaces.</p>

        <div style="margin-top:0.75rem;display:flex;align-items:center;gap:0.75rem;">
          ${window._avatarUrl
            ? `<img id="um-avatar-preview" src="${escAttr(window._avatarUrl)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid var(--border);flex-shrink:0;" />`
            : `<div id="um-avatar-preview" style="width:48px;height:48px;border-radius:50%;background:var(--bg-surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">🧙</div>`}
          <label style="cursor:pointer;font-size:0.78rem;color:var(--text-muted);border:1px solid var(--border);border-radius:var(--radius);padding:0.3rem 0.65rem;" for="um-avatar-file" id="um-avatar-label">📁 Upload Avatar</label>
          <input type="file" id="um-avatar-file" accept="image/*" style="display:none;" />
        </div>

        <div class="um-actions">
          ${optional ? '<button class="um-cancel-btn" id="um-cancel">Cancel</button>' : ''}
          <button class="um-save-btn" id="um-save">Save Username</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    const input = document.getElementById('um-input');
    input.focus();
    input.select();

    if (optional) {
      document.getElementById('um-cancel').addEventListener('click', () => wrap.remove());
      wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveUsername(); });
    document.getElementById('um-save').addEventListener('click', saveUsername);

    // Avatar upload
    document.getElementById('um-avatar-file').addEventListener('change', async e => {
      const file  = e.target.files[0];
      if (!file) return;
      const label = document.getElementById('um-avatar-label');
      if (label) label.textContent = 'Uploading…';
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'Abberanth');
        const res  = await fetch('https://api.cloudinary.com/v1_1/dwvp6we4c/auto/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
        await window._db.collection('players').doc(user.uid).update({ avatarUrl: data.secure_url });
        window._avatarUrl = data.secure_url;
        // Update sidebar avatar if present
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        if (sidebarAvatar) {
          sidebarAvatar.src = data.secure_url;
        } else {
          const footer    = document.getElementById('sidebar-footer');
          const displayEl = document.getElementById('sidebar-user-email');
          if (footer && displayEl) {
            const img = document.createElement('img');
            img.id            = 'sidebar-avatar';
            img.src           = data.secure_url;
            img.alt           = 'Avatar';
            img.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border);flex-shrink:0;display:block;margin-bottom:0.3rem;';
            img.onerror       = () => img.remove();
            footer.insertBefore(img, displayEl);
          }
        }
        // Update preview in modal
        const preview = document.getElementById('um-avatar-preview');
        if (preview) {
          const img = document.createElement('img');
          img.id            = 'um-avatar-preview';
          img.src           = data.secure_url;
          img.style.cssText = 'width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid var(--border);flex-shrink:0;';
          preview.replaceWith(img);
        }
        if (label) label.textContent = '✓ Done';
        setTimeout(() => { if (label) label.textContent = '📁 Upload Avatar'; }, 2000);
      } catch (err) {
        console.error('Avatar upload failed:', err);
        if (label) label.textContent = '✗ Failed';
        setTimeout(() => { if (label) label.textContent = '📁 Upload Avatar'; }, 2500);
      }
    });

    async function saveUsername() {
      const val = input.value.trim();
      if (val.length < 2)  { shake(input); return; }
      if (val.length > 20) { shake(input); return; }

      const btn = document.getElementById('um-save');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        await window._db.collection('players').doc(user.uid).update({ username: val });
        window._username    = val;
        window._userDisplay = val;
        const el = document.getElementById('sidebar-user-email');
        if (el) el.textContent = val;
        wrap.remove();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Save Username';
        alert('Could not save username: ' + e.message);
      }
    }
  }

  /* Briefly animate the input when invalid */
  function shake(el) {
    el.style.borderColor = '#e05080';
    el.style.outline = '0';
    setTimeout(() => { el.style.borderColor = ''; }, 800);
  }

  function escAttr(s) {
    return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* ---- Sidebar population ---- */
  function populateSidebar(user) {
    const footer    = document.getElementById('sidebar-footer');
    const displayEl = document.getElementById('sidebar-user-email');
    const logoutEl  = document.getElementById('logout-btn');

    /* DM badge */
    if (window.isDM && footer && !document.getElementById('sidebar-dm-badge')) {
      const badge = document.createElement('span');
      badge.id        = 'sidebar-dm-badge';
      badge.className = 'sidebar-dm-badge';
      badge.textContent = '🎭 Game Master';
      footer.insertBefore(badge, footer.firstChild);
    }

    if (displayEl) {
      // Avatar
      if (window._avatarUrl && !document.getElementById('sidebar-avatar')) {
        const img = document.createElement('img');
        img.id             = 'sidebar-avatar';
        img.src            = window._avatarUrl;
        img.alt            = 'Avatar';
        img.style.cssText  = 'width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border);flex-shrink:0;display:block;margin-bottom:0.3rem;';
        img.onerror        = () => img.remove();
        footer.insertBefore(img, displayEl);
      }
      displayEl.textContent = window._userDisplay || user.email;
      displayEl.title       = 'Click to change username or avatar';
      if (!displayEl.dataset.bound) {
        displayEl.dataset.bound = '1';
        displayEl.addEventListener('click', () => showUsernameModal(user, true));
      }
    }

    if (logoutEl && !logoutEl.dataset.bound) {
      logoutEl.dataset.bound = '1';
      logoutEl.addEventListener('click', () => {
        window._auth.signOut().then(() => window.location.replace(getLoginUrl()));
      });
    }
  }

  /* ---- Player registration (writes/updates Firestore on each login) ---- */
  function registerPlayer(user) {
    if (!window._db) return;
    try {
      const ts = typeof firebase !== 'undefined' && firebase.firestore
        ? firebase.firestore.FieldValue.serverTimestamp() : null;

      window._db.collection('players').doc(user.uid).set({
        email:    user.email,
        uid:      user.uid,
        isDM:     !!window.isDM,
        lastSeen: ts,
      }, { merge: true }).catch(() => {});
    } catch (_) {}
  }

  /* ---- onAuthReady callback queue ---- */
  let _resolved  = false;
  let _user      = null;
  let _callbacks = [];

  window.onAuthReady = function (cb) {
    if (_resolved) { cb(_user); }
    else           { _callbacks.push(cb); }
  };

  /* ---- Auth state listener ---- */
  if (window.firebaseReady) {
    window._auth.onAuthStateChanged(async function (user) {
      if (!user) {
        window.location.replace(getLoginUrl());
        return;
      }

      window.isDM = checkIsDM(user);

      /* Fetch username before resolving so display name is ready immediately */
      await fetchAndSetUsername(user);

      _user     = user;
      _resolved = true;

      populateSidebar(user);
      registerPlayer(user);

      /* Prompt for username on first login (no username set yet) */
      if (!window._username) {
        setTimeout(() => showUsernameModal(user, false), 600);
      }

      _callbacks.forEach(cb => cb(user));
      _callbacks = [];
    });
  } else {
    _resolved = true;
    _callbacks.forEach(cb => cb(null));
    _callbacks = [];
  }

})();