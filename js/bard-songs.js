/* ============================================================
   Abberanth Companion — Bard Songs
   DM: upload songs, assign to timelines, control who has heard them.
   Players: see and play only the songs they've been given access to.
   ============================================================ */

(function () {

  let _user              = null;
  let _all               = [];
  let _visible           = [];
  let _players           = [];
  let _timelines         = [];
  let _currentTimelineId = null;
  let _modalIdx          = 0;
  let _editingId         = null;

  function _col()  { return window._db.collection('bardSongs'); }
  function _stg()  { return window._storage; }

  /* ----------------------------------------------------------
     Load players (DM only)
  ---------------------------------------------------------- */
  async function loadPlayers() {
    if (!window.isDM) return;
    try {
      const dmEmails = (SITE_CONFIG.dmEmails || []).map(e => e.toLowerCase());
      const snap = await window._db.collection('players').orderBy('email').get();
      _players = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!dmEmails.includes((d.email || '').toLowerCase()))
          _players.push({ uid: d.uid || doc.id, email: d.email || doc.id, username: d.username || null });
      });
    } catch (e) { console.warn('Could not load players:', e); }
  }

  /* ----------------------------------------------------------
     Load timelines
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
    } catch (_) { _timelines = []; }
  }

  /* ----------------------------------------------------------
     Load songs
  ---------------------------------------------------------- */
  async function loadSongs() {
    try {
      let snap;
      try { snap = await _col().orderBy('order').get(); }
      catch (_) { snap = await _col().get(); }
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { _all = []; console.warn('Bard songs load failed:', e); }

    const uid = _user?.uid;
    _visible = window.isDM
      ? (_currentTimelineId ? _all.filter(s => s.timelineId === _currentTimelineId) : [..._all])
      : _all.filter(s => {
          const v = s.visibility || {};
          const heard = v.all === true || (uid && v[uid] === true);
          const inTl  = !_currentTimelineId || s.timelineId === _currentTimelineId;
          return heard && inTl;
        });
  }

  /* ----------------------------------------------------------
     Timeline filter bar
  ---------------------------------------------------------- */
  function renderTimelineFilter() {
    const bar = document.getElementById('bs-timeline-filter');
    if (!bar) return;
    const pills = [{ id: null, name: 'All', color: null }, ..._timelines].map(tl => {
      const active = _currentTimelineId === tl.id;
      const dot    = tl.color ? `<span class="tl-filter-dot" style="background:${tl.color};"></span>` : '';
      const style  = (active && tl.color) ? `background:${tl.color};` : '';
      return `<button class="tl-filter-pill${active ? ' active' : ''}"
        data-tlid="${tl.id || ''}" style="${style}">${dot}${esc(tl.name)}</button>`;
    }).join('');
    bar.innerHTML = `<span class="tl-filter-label">Campaign:</span>${pills}`;
    bar.querySelectorAll('.tl-filter-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        _currentTimelineId = btn.dataset.tlid || null;
        renderTimelineFilter();
        await loadSongs();
        renderGrid();
      });
    });
  }

  /* ----------------------------------------------------------
     Grid
  ---------------------------------------------------------- */
  function renderGrid() {
    const grid = document.getElementById('bs-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (_visible.length === 0 && !window.isDM) {
      grid.insertAdjacentHTML('beforeend', '<p class="bs-empty">No songs have been shared with you yet.</p>');
      return;
    }

    _visible.forEach((song, idx) => {
      const card = document.createElement('div');
      card.className = 'bs-card';
      card.addEventListener('click', () => openModal(idx));

      const coverEl = song.coverUrl
        ? `<img class="bs-cover" src="${esc(song.coverUrl)}" alt="${esc(song.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
           <div class="bs-cover-placeholder" style="display:none;">🎶</div>`
        : `<div class="bs-cover-placeholder">🎶</div>`;

      card.innerHTML = `
        ${coverEl}
        <span class="bs-card-name">${esc(song.name || 'Untitled')}</span>
        ${song.artist ? `<span class="bs-card-artist">${esc(song.artist)}</span>` : ''}
      `;
      grid.appendChild(card);
    });

    if (window.isDM) {
      const add = document.createElement('div');
      add.className = 'bs-add-card';
      add.innerHTML = '<span style="font-size:1.5rem;">＋</span><span>Add Song</span>';
      add.addEventListener('click', () => openForm(null));
      grid.appendChild(add);
    }
  }

  /* ----------------------------------------------------------
     Modal
  ---------------------------------------------------------- */
  function buildModal() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bs-modal">
        <div id="bs-panel">
          <div class="bs-modal-top" id="bs-modal-top"></div>
          <div class="bs-player-wrap" id="bs-player-wrap"></div>
          <div class="bs-modal-nav">
            <button class="bs-nav-btn" id="bs-prev">← Prev</button>
            <span  class="bs-nav-counter" id="bs-counter"></span>
            ${window.isDM ? '<button class="bs-edit-btn" id="bs-edit-btn">✏️ Edit</button>' : ''}
            <button class="bs-nav-btn" id="bs-next">Next →</button>
            <button class="bs-modal-close" id="bs-close">Close</button>
          </div>
          ${window.isDM ? '<div class="bs-vis-panel" id="bs-vis-panel"></div>' : ''}
        </div>
      </div>
    `);

    document.getElementById('bs-prev').addEventListener('click',  () => navigate(-1));
    document.getElementById('bs-next').addEventListener('click',  () => navigate(1));
    document.getElementById('bs-close').addEventListener('click', closeModal);
    document.getElementById('bs-modal').addEventListener('click', e => {
      if (e.target.id === 'bs-modal') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (!document.getElementById('bs-modal').classList.contains('open')) return;
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Escape')     closeModal();
    });
    if (window.isDM) {
      document.getElementById('bs-edit-btn').addEventListener('click', () => openForm(_visible[_modalIdx]));
    }
  }

  function openModal(idx) {
    _modalIdx = idx;
    renderModal();
    document.getElementById('bs-modal').classList.add('open');
  }
  function closeModal() { document.getElementById('bs-modal').classList.remove('open'); }
  function navigate(dir) {
    const n = _modalIdx + dir;
    if (n < 0 || n >= _visible.length) return;
    _modalIdx = n;
    renderModal();
  }

  function renderModal() {
    const song = _visible[_modalIdx];
    if (!song) return;

    const cover = song.coverUrl
      ? `<img class="bs-modal-cover" src="${esc(song.coverUrl)}" alt="${esc(song.name)}"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
         <div class="bs-modal-cover-placeholder" style="display:none;">🎶</div>`
      : `<div class="bs-modal-cover-placeholder">🎶</div>`;

    document.getElementById('bs-modal-top').innerHTML = `
      ${cover}
      <div class="bs-modal-info">
        <div class="bs-modal-name">${esc(song.name || 'Untitled')}</div>
        ${song.artist ? `<div class="bs-modal-artist">by ${esc(song.artist)}</div>` : ''}
        ${song.description ? `<div class="bs-modal-desc">${esc(song.description)}</div>` : ''}
      </div>
    `;

    const playerWrap = document.getElementById('bs-player-wrap');
    if (song.audioUrl) {
      playerWrap.innerHTML = `
        <audio class="bs-audio" controls preload="metadata">
          <source src="${esc(song.audioUrl)}" />
          Your browser doesn't support the audio element.
        </audio>
      `;
    } else {
      playerWrap.innerHTML = `<p class="bs-no-audio">No audio file uploaded yet.</p>`;
    }

    document.getElementById('bs-counter').textContent = `${_modalIdx + 1} / ${_visible.length}`;
    document.getElementById('bs-prev').disabled = _modalIdx === 0;
    document.getElementById('bs-next').disabled = _modalIdx === _visible.length - 1;

    if (window.isDM) renderVisPanel(song);
  }

  /* ----------------------------------------------------------
     Visibility ("heard by") panel
  ---------------------------------------------------------- */
  function renderVisPanel(song) {
    const panel = document.getElementById('bs-vis-panel');
    if (!panel) return;
    const vis = song.visibility || {};

    let html = `
      <div class="bs-vis-title">🎵 Heard by — who can listen to this song?</div>
      <div class="bs-vis-grid">
        <label class="bs-vis-toggle ${vis.all ? 'active' : ''}" data-uid="all">
          <input type="checkbox" ${vis.all ? 'checked' : ''} /> All Players
        </label>
    `;
    _players.forEach(p => {
      const on = vis[p.uid] === true;
      html += `
        <label class="bs-vis-toggle ${on ? 'active' : ''}" data-uid="${esc(p.uid)}">
          <input type="checkbox" ${on ? 'checked' : ''} /> ${esc(p.username || p.email)}
        </label>`;
    });
    html += '</div>';
    panel.innerHTML = html;

    panel.querySelectorAll('.bs-vis-toggle').forEach(label => {
      label.querySelector('input').addEventListener('change', async e => {
        const uid = label.dataset.uid;
        const on  = e.target.checked;
        label.classList.toggle('active', on);
        const upd = {};
        upd[`visibility.${uid}`] = on;
        try {
          await _col().doc(song.id).update(upd);
          if (!song.visibility) song.visibility = {};
          song.visibility[uid] = on;
        } catch (err) { console.error('Visibility update failed:', err); }
      });
    });
  }

  /* ----------------------------------------------------------
     Add / Edit form (DM only)
  ---------------------------------------------------------- */
  function buildForm() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bs-form-modal">
        <div id="bs-form-panel">
          <div class="bs-form-title" id="bs-form-title">Add Song</div>

          <div class="bs-form-field">
            <label>Song Name *</label>
            <input class="bs-form-input" id="bf-name" type="text" placeholder="The Ballad of the Fallen King" />
          </div>

          <div class="bs-form-field">
            <label>Artist / Composer <span class="bs-form-hint">(optional)</span></label>
            <input class="bs-form-input" id="bf-artist" type="text" placeholder="Bard Elara Silversong" />
          </div>

          <div class="bs-form-field">
            <label>Description <span class="bs-form-hint">(optional)</span></label>
            <textarea class="bs-form-textarea" id="bf-desc" placeholder="Where this song was heard, what it means…"></textarea>
          </div>

          <div class="bs-form-field">
            <label>Audio File</label>
            <div class="bs-upload-row">
              <input class="bs-form-input" id="bf-audio-url" type="url" placeholder="URL or upload →" />
              <label class="bs-upload-btn" for="bf-audio-file">🎵 Upload</label>
              <input type="file" id="bf-audio-file" accept="audio/*" style="display:none;" />
            </div>
            <div id="bf-audio-preview" style="margin-top:0.4rem;"></div>
          </div>

          <div class="bs-form-field">
            <label>Cover Art <span class="bs-form-hint">(optional)</span></label>
            <div class="bs-upload-row">
              <input class="bs-form-input" id="bf-cover-url" type="url" placeholder="URL or upload →" />
              <label class="bs-upload-btn" for="bf-cover-file">📁 Upload</label>
              <input type="file" id="bf-cover-file" accept="image/*" style="display:none;" />
            </div>
            <div id="bf-cover-preview" style="margin-top:0.4rem;"></div>
          </div>

          <div class="bs-form-field">
            <label>Campaign</label>
            <select class="bs-form-select" id="bf-timeline">
              <option value="">— No campaign —</option>
            </select>
          </div>

          <div class="bs-form-field">
            <label>Display Order</label>
            <input class="bs-form-input" id="bf-order" type="number" min="0" value="0" style="width:80px;" />
          </div>

          <div class="bs-form-actions">
            <button class="bs-form-delete-btn" id="bf-delete" style="display:none;">Delete</button>
            <button class="bs-form-cancel-btn" id="bf-cancel">Cancel</button>
            <button class="bs-form-save-btn"   id="bf-save">Save Song</button>
          </div>
        </div>
      </div>
    `);

    document.getElementById('bf-cancel').addEventListener('click', closeForm);
    document.getElementById('bf-save').addEventListener('click',   saveSong);
    document.getElementById('bf-delete').addEventListener('click', deleteSong);
    document.getElementById('bs-form-modal').addEventListener('click', e => {
      if (e.target.id === 'bs-form-modal') closeForm();
    });
    document.getElementById('bf-audio-file').addEventListener('change', e => handleUpload(e, 'audio'));
    document.getElementById('bf-cover-file').addEventListener('change', e => handleUpload(e, 'cover'));
  }

  function openForm(song) {
    _editingId = song?.id ?? null;
    document.getElementById('bs-form-title').textContent = song ? 'Edit Song' : 'Add Song';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('bf-name',      song?.name        || '');
    set('bf-artist',    song?.artist      || '');
    set('bf-desc',      song?.description || '');
    set('bf-audio-url', song?.audioUrl    || '');
    set('bf-cover-url', song?.coverUrl    || '');
    set('bf-order',     song?.order       ?? _all.length);

    // Audio preview
    const audioPreview = document.getElementById('bf-audio-preview');
    audioPreview.innerHTML = song?.audioUrl
      ? `<audio controls preload="metadata" class="bs-audio"><source src="${esc(song.audioUrl)}" /></audio>` : '';

    // Cover preview
    const coverPreview = document.getElementById('bf-cover-preview');
    coverPreview.innerHTML = song?.coverUrl
      ? `<img src="${esc(song.coverUrl)}" style="max-height:60px;border-radius:6px;" />` : '';

    // Timeline dropdown
    const tlSel = document.getElementById('bf-timeline');
    if (tlSel) {
      tlSel.innerHTML = '<option value="">— No campaign —</option>' +
        _timelines.map(t =>
          `<option value="${t.id}" ${song?.timelineId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`
        ).join('');
      if (!song && _currentTimelineId) tlSel.value = _currentTimelineId;
    }

    document.getElementById('bf-delete').style.display = song ? 'block' : 'none';
    document.getElementById('bs-form-modal').classList.add('open');
    closeModal();
  }

  function closeForm() {
    document.getElementById('bs-form-modal').classList.remove('open');
    _editingId = null;
  }

  /* ----------------------------------------------------------
     File uploads
  ---------------------------------------------------------- */
 async function handleUpload(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const isAudio  = type === 'audio';
  const urlInput = document.getElementById(isAudio ? 'bf-audio-url' : 'bf-cover-url');
  const preview  = document.getElementById(isAudio ? 'bf-audio-preview' : 'bf-cover-preview');
  const btn      = document.querySelector(`label[for="bf-${isAudio ? 'audio' : 'cover'}-file"]`);

  btn.textContent = 'Uploading…';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'Abberanth');

    const res  = await fetch('https://api.cloudinary.com/v1_1/dwvp6we4c/auto/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

    const url = data.secure_url;
    urlInput.value = url;

    preview.innerHTML = isAudio
      ? `<audio controls preload="metadata" class="bs-audio"><source src="${esc(url)}" /></audio>`
      : `<img src="${esc(url)}" style="max-height:60px;border-radius:6px;" />`;

    btn.textContent = '✓ Done';
    setTimeout(() => { btn.textContent = isAudio ? '🎵 Upload' : '📁 Upload'; }, 2000);
  } catch (err) {
    console.error('Upload failed:', err);
    btn.textContent = '✗ Failed';
    setTimeout(() => { btn.textContent = isAudio ? '🎵 Upload' : '📁 Upload'; }, 2500);
  }
}

  /* ----------------------------------------------------------
     Save / Delete
  ---------------------------------------------------------- */
  async function saveSong() {
    const btn  = document.getElementById('bf-save');
    const name = document.getElementById('bf-name').value.trim();
    if (!name) { alert('Please enter a song name.'); return; }

    btn.disabled = true; btn.textContent = 'Saving…';

    const data = {
      name,
      artist:      document.getElementById('bf-artist').value.trim(),
      description: document.getElementById('bf-desc').value.trim(),
      audioUrl:    document.getElementById('bf-audio-url').value.trim() || null,
      coverUrl:    document.getElementById('bf-cover-url').value.trim() || null,
      timelineId:  document.getElementById('bf-timeline').value || null,
      order:       parseInt(document.getElementById('bf-order').value, 10) || 0,
    };

    try {
      if (_editingId) {
        const existing = _all.find(s => s.id === _editingId);
        data.visibility = existing?.visibility || {};
        await _col().doc(_editingId).set(data);
      } else {
        data.visibility = {};
        await _col().add(data);
      }
      await loadSongs();
      renderGrid();
      closeForm();
    } catch (e) {
      alert('Save failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Save Song';
    }
  }

  async function deleteSong() {
    if (!_editingId || !confirm('Delete this song? This cannot be undone.')) return;
    try {
      await _col().doc(_editingId).delete();
      await loadSongs();
      renderGrid();
      closeForm();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async user => {
      _user = user;
      const urlTl = new URLSearchParams(location.search).get('tl');
      if (urlTl) _currentTimelineId = urlTl;
      if (window.isDM) await loadPlayers();
      await loadTimelines();
      await loadSongs();
      renderTimelineFilter();
      renderGrid();
      buildModal();
      if (window.isDM) buildForm();
    });
  });

})();
