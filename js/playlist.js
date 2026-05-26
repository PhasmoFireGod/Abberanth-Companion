/* ============================================================
   Abberanth Companion — Session Playlist
   Anyone can add external links; own entries or DM can delete.
   ============================================================ */

(function () {

  let _user     = null;
  let _sessions = [];
  let _formOpen = false;

  function playlistRef() {
    return window._db.collection('playlist');
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      _user = user;
      bindUI();
      await loadSessions();
    });
  });

  /* ----------------------------------------------------------
     Load
  ---------------------------------------------------------- */
  async function loadSessions() {
    const listEl = document.getElementById('playlist-list');
    if (listEl) listEl.innerHTML = '<p class="playlist-empty">Loading…</p>';

    try {
      const snap = await playlistRef().orderBy('addedAt', 'desc').get();
      _sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      try {
        const snap = await playlistRef().get();
        _sessions = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0));
      } catch (e2) {
        _sessions = [];
        console.warn('Playlist load failed:', e2);
      }
    }

    renderList();
  }

  /* ----------------------------------------------------------
     Render
  ---------------------------------------------------------- */
  function renderList() {
    const listEl = document.getElementById('playlist-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (_sessions.length === 0) {
      listEl.innerHTML = '<p class="playlist-empty">No sessions added yet. Be the first!</p>';
      return;
    }

    _sessions.forEach(session => {
      const card = document.createElement('div');
      card.className = 'playlist-session';

      const canDelete = window.isDM ||
        (session.addedByUid && session.addedByUid === _user?.uid);

      const dateStr = session.date
        ? new Date(session.date + 'T12:00:00').toLocaleDateString('en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const addedWhen = session.addedAt?.toDate
        ? session.addedAt.toDate().toLocaleDateString('en-GB',
            { day: 'numeric', month: 'short' })
        : '';

      const metaParts = [dateStr, session.addedByEmail ? `Added by ${session.addedByEmail}` : '', addedWhen]
        .filter(Boolean).join(' · ');

      card.innerHTML = `
        <div class="playlist-session-header">
          <div class="playlist-session-info">
            <div class="playlist-session-title">${esc(session.title || 'Session')}</div>
            <div class="playlist-session-meta">${esc(metaParts)}</div>
          </div>
          ${canDelete ? `<button class="playlist-delete-btn" data-id="${esc(session.id)}">🗑 Delete</button>` : ''}
        </div>
        ${session.description ? `<div class="playlist-session-desc">${esc(session.description)}</div>` : ''}
      `;

      // Embed or link
      const mediaEl = document.createElement('div');
      const ytId = getYouTubeId(session.url || '');
      if (ytId) {
        mediaEl.innerHTML = `
          <div class="playlist-yt-wrap">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${ytId}"
              title="${esc(session.title)}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        `;
      } else if (session.url) {
        mediaEl.innerHTML = `
          <a class="playlist-link-btn" href="${esc(session.url)}" target="_blank" rel="noopener">
            🔗 Open Recording
          </a>
        `;
      }
      card.appendChild(mediaEl);

      // Delete button handler
      const delBtn = card.querySelector('.playlist-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', () => deleteSession(session.id, session.title));
      }

      listEl.appendChild(card);
    });
  }

  /* ----------------------------------------------------------
     Add session
  ---------------------------------------------------------- */
  function toggleForm(open) {
    _formOpen = open;
    const wrap = document.getElementById('playlist-form-wrap');
    const btn  = document.getElementById('playlist-add-btn');
    if (wrap) wrap.style.display = open ? 'block' : 'none';
    if (btn)  btn.textContent    = open ? '✕ Cancel' : '+ Add Session';
  }

  async function submitForm() {
    const title = document.getElementById('pf-title').value.trim();
    const url   = document.getElementById('pf-url').value.trim();
    const desc  = document.getElementById('pf-desc').value.trim();
    const date  = document.getElementById('pf-date').value;
    const btn   = document.getElementById('pf-save');

    if (!title) { alert('Please add a session title.'); return; }
    if (!url)   { alert('Please add a URL.'); return; }

    btn.disabled = true;
    btn.textContent = 'Adding…';

    try {
      await playlistRef().add({
        title,
        url,
        description:  desc,
        date,
        addedByUid:   _user.uid,
        addedByEmail: _user.email,
        addedAt:      firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Reset form
      ['pf-title','pf-url','pf-desc','pf-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      toggleForm(false);
      await loadSessions();
    } catch (e) {
      alert('Could not add session: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Session';
    }
  }

  /* ----------------------------------------------------------
     Delete
  ---------------------------------------------------------- */
  async function deleteSession(id, title) {
    if (!confirm(`Delete "${title || 'this session'}"? This cannot be undone.`)) return;
    try {
      await playlistRef().doc(id).delete();
      _sessions = _sessions.filter(s => s.id !== id);
      renderList();
    } catch (e) {
      alert('Could not delete: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Bind UI
  ---------------------------------------------------------- */
  function bindUI() {
    document.getElementById('playlist-add-btn')
      ?.addEventListener('click', () => toggleForm(!_formOpen));

    document.getElementById('pf-save')
      ?.addEventListener('click', submitForm);

    document.getElementById('pf-cancel')
      ?.addEventListener('click', () => toggleForm(false));

    // Default date to today
    const dateInput = document.getElementById('pf-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  }

  /* ----------------------------------------------------------
     YouTube helpers
  ---------------------------------------------------------- */
  function getYouTubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
