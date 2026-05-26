/* ============================================================
   Abberanth Companion — Session Playlist
   Anyone can add external links; own entries or DM can delete.
   ============================================================ */

(function () {

  let _user              = null;
  let _sessions          = [];
  let _formOpen          = false;
  let _timelines         = [];
  let _currentTimelineId = null;

  function playlistRef() {
    return window._db.collection('playlist');
  }

  /* ----------------------------------------------------------
     Timelines
  ---------------------------------------------------------- */
  async function loadTimelines() {
    try {
      let snap;
      try { snap = await window._db.collection('timelines').orderBy('createdAt').get(); }
      catch (_) { snap = await window._db.collection('timelines').get(); }
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _timelines = window.isDM
        ? all
        : all.filter(t => (t.members || []).includes(_user?.uid));
    } catch (e) {
      _timelines = [];
    }
  }

  function renderTimelineFilter() {
    const bar = document.getElementById('playlist-timeline-filter');
    if (!bar) return;
    const pills = [
      { id: null, name: 'All', color: null },
      ..._timelines,
    ].map(tl => {
      const active = _currentTimelineId === tl.id;
      const dot    = tl.color ? `<span class="tl-filter-dot" style="background:${esc(tl.color)};"></span>` : '';
      const style  = (active && tl.color) ? `background:${esc(tl.color)};` : '';
      return `<button class="tl-filter-pill${active ? ' active' : ''}"
        data-tlid="${esc(tl.id || '')}" style="${style}">${dot}${esc(tl.name)}</button>`;
    }).join('');
    bar.innerHTML = `<span class="tl-filter-label">Campaign:</span>${pills}`;
    bar.querySelectorAll('.tl-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentTimelineId = btn.dataset.tlid || null;
        renderTimelineFilter();
        loadSessions();
      });
    });
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      _user = user;
      const urlTl = new URLSearchParams(location.search).get('tl');
      if (urlTl) _currentTimelineId = urlTl;
      await loadTimelines();
      renderTimelineFilter();
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
      let sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (_currentTimelineId) sessions = sessions.filter(s => s.timelineId === _currentTimelineId);
      _sessions = sessions;
    } catch (e) {
      try {
        const snap = await playlistRef().get();
        let sessions = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0));
        if (_currentTimelineId) sessions = sessions.filter(s => s.timelineId === _currentTimelineId);
        _sessions = sessions;
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

      const canEdit = window.isDM ||
        (session.addedByUid && session.addedByUid === _user?.uid);

      const dateStr = session.date
        ? new Date(session.date + 'T12:00:00').toLocaleDateString('en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const addedWhen = session.addedAt?.toDate
        ? session.addedAt.toDate().toLocaleDateString('en-GB',
            { day: 'numeric', month: 'short' })
        : '';

      const addedByDisplay = session.addedByUsername || session.addedByEmail;
      const metaParts = [dateStr, addedByDisplay ? `Added by ${addedByDisplay}` : '', addedWhen]
        .filter(Boolean).join(' · ');

      card.innerHTML = `
        <div class="playlist-session-header">
          <div class="playlist-session-info">
            <div class="playlist-session-title">${esc(session.title || 'Session')}</div>
            <div class="playlist-session-meta">${esc(metaParts)}</div>
          </div>
          ${canEdit ? `
            <div class="playlist-session-actions">
              <button class="playlist-edit-btn"   data-id="${esc(session.id)}">✏️ Edit</button>
              <button class="playlist-delete-btn" data-id="${esc(session.id)}">🗑 Delete</button>
            </div>` : ''}
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

      // Edit + Delete button handlers
      card.querySelector('.playlist-edit-btn')
        ?.addEventListener('click', () => openEditModal(session));
      card.querySelector('.playlist-delete-btn')
        ?.addEventListener('click', () => deleteSession(session.id, session.title));

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
        timelineId:   _currentTimelineId || null,
        addedByUid:      _user.uid,
        addedByEmail:    _user.email,
        addedByUsername: window._username || null,
        addedAt:         firebase.firestore.FieldValue.serverTimestamp(),
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
     Edit modal
  ---------------------------------------------------------- */
  function openEditModal(session) {
    document.getElementById('playlist-edit-modal')?.remove();

    const tlOpts = [
      `<option value="">— No campaign —</option>`,
      ..._timelines.map(t =>
        `<option value="${esc(t.id)}" ${session.timelineId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`
      ),
    ].join('');

    const wrap = document.createElement('div');
    wrap.id = 'playlist-edit-modal';
    wrap.className = 'playlist-edit-overlay';
    wrap.innerHTML = `
      <div class="playlist-edit-panel">
        <div class="playlist-edit-title">Edit Session</div>

        <div class="playlist-form-field">
          <label for="pe-title">Title</label>
          <input type="text" id="pe-title" value="${esc(session.title || '')}" placeholder="Session title" />
        </div>

        <div class="playlist-form-field">
          <label for="pe-url">Recording URL</label>
          <input type="url" id="pe-url" value="${esc(session.url || '')}" placeholder="https://…" />
        </div>

        <div class="playlist-form-field">
          <label for="pe-date">Date</label>
          <input type="date" id="pe-date" value="${esc(session.date || '')}" />
        </div>

        <div class="playlist-form-field full-width">
          <label for="pe-desc">Description</label>
          <textarea id="pe-desc" placeholder="What happened this session…">${esc(session.description || '')}</textarea>
        </div>

        ${_timelines.length > 0 ? `
        <div class="playlist-form-field">
          <label for="pe-tl">Campaign</label>
          <select id="pe-tl">${tlOpts}</select>
        </div>` : ''}

        <div class="playlist-form-actions">
          <button class="playlist-form-cancel" id="pe-cancel">Cancel</button>
          <button class="playlist-form-save"   id="pe-save">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('pe-title').focus();

    // Close handlers
    document.getElementById('pe-cancel').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { wrap.remove(); document.removeEventListener('keydown', onKey); }
    });

    // Save
    document.getElementById('pe-save').addEventListener('click', async () => {
      const title = document.getElementById('pe-title').value.trim();
      const url   = document.getElementById('pe-url').value.trim();
      const desc  = document.getElementById('pe-desc').value.trim();
      const date  = document.getElementById('pe-date').value;
      const tlId  = document.getElementById('pe-tl')?.value || null;
      const btn   = document.getElementById('pe-save');

      if (!title) { alert('Please add a title.'); return; }
      if (!url)   { alert('Please add a URL.'); return; }

      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        await playlistRef().doc(session.id).update({
          title, url, description: desc, date,
          timelineId: tlId || null,
        });
        // Patch local cache so the list re-renders instantly
        const idx = _sessions.findIndex(s => s.id === session.id);
        if (idx >= 0) {
          _sessions[idx] = { ..._sessions[idx], title, url, description: desc, date, timelineId: tlId || null };
        }
        wrap.remove();
        renderList();
      } catch (e) {
        alert('Save failed: ' + e.message);
        btn.disabled = false; btn.textContent = 'Save Changes';
      }
    });
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
