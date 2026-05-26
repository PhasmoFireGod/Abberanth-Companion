/* ============================================================
   Abberanth Companion — NPCs Page Logic
   ============================================================ */

(function () {

  let _user              = null;
  let _allNpcs           = [];
  let _visibleNpcs       = [];
  let _modalIndex        = 0;
  let _players           = [];
  let _editingId         = null;
  let _timelines         = [];
  let _currentTimelineId = null;

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
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
    } catch (_) { _timelines = []; }
  }

  function renderTimelineFilter() {
    const bar = document.getElementById('npc-timeline-filter');
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
        await loadNpcs();
        renderGrid();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      _user = user;
      const urlTl = new URLSearchParams(location.search).get('tl');
      if (urlTl) _currentTimelineId = urlTl;
      if (window.isDM) await loadPlayers();
      await loadTimelines();
      await loadNpcs();
      renderTimelineFilter();
      renderGrid();
      buildModals();
    });
  });

  /* ----------------------------------------------------------
     Firestore / Storage helpers
  ---------------------------------------------------------- */
  function _npcCol()  { return window._db.collection('npcs'); }
  function _storage() { return window._storage || (window._storage = firebase.storage()); }

  async function uploadImage(file, npcId, field) {
    const ext  = file.name.split('.').pop();
    const path = `npc-images/${npcId}/${field}.${ext}`;
    const ref  = _storage().ref(path);
    await ref.put(file);
    return await ref.getDownloadURL();
  }

  async function loadPlayers() {
    try {
      const dmEmails = (SITE_CONFIG.dmEmails || []).map(e => e.toLowerCase());
      const snap     = await window._db.collection('players').orderBy('email').get();
      _players = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!dmEmails.includes((d.email || '').toLowerCase()))
          _players.push({ uid: d.uid || doc.id, email: d.email || doc.id, username: d.username || null });
      });
    } catch (e) { console.warn('Could not load players:', e); }
  }

  async function loadNpcs() {
    try {
      const snap = await _npcCol().orderBy('order').get();
      _allNpcs = [];
      snap.forEach(doc => _allNpcs.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
      try {
        const snap = await _npcCol().get();
        _allNpcs = [];
        snap.forEach(doc => _allNpcs.push({ id: doc.id, ...doc.data() }));
      } catch (e2) { console.warn('Could not load NPCs:', e2); }
    }

    if (window.isDM) {
      _visibleNpcs = _currentTimelineId
        ? _allNpcs.filter(n => n.timelineId === _currentTimelineId)
        : [..._allNpcs];
    } else {
      const uid = _user?.uid || null;
      _visibleNpcs = _allNpcs.filter(n => {
        const v = n.visibility || {};
        const visibleToPlayer = v.all === true || (uid && v[uid] === true);
        const inTimeline = !_currentTimelineId || n.timelineId === _currentTimelineId;
        return visibleToPlayer && inTimeline;
      });
    }
  }

  /* ----------------------------------------------------------
     Grid
  ---------------------------------------------------------- */
  function renderGrid() {
    const grid = document.getElementById('npc-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (_visibleNpcs.length === 0 && !window.isDM) {
      grid.insertAdjacentHTML('beforeend', '<p class="npc-empty">No NPC entries visible yet.</p>');
      return;
    }

    _visibleNpcs.forEach((npc, idx) => {
      const card = document.createElement('div');
      card.className = 'npc-card';
      card.addEventListener('click', () => openModal(idx));

      const tokenEl = npc.token
        ? `<img class="npc-token" src="${esc(npc.token)}" alt="${esc(npc.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
           <div class="npc-token-placeholder" style="display:none;">🧙</div>`
        : `<div class="npc-token-placeholder">🧙</div>`;

      card.innerHTML = `${tokenEl}<span class="npc-card-name">${esc(npc.name || 'Unknown')}</span>`;
      grid.appendChild(card);
    });

    if (window.isDM) {
      const addCard = document.createElement('div');
      addCard.className = 'npc-add-card';
      addCard.innerHTML = `<span style="font-size:1.5rem;">＋</span><span>Add NPC</span>`;
      addCard.addEventListener('click', () => openForm(null));
      grid.appendChild(addCard);
    }
  }

  /* ----------------------------------------------------------
     Detail Modal
  ---------------------------------------------------------- */
  function buildModals() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="npc-modal">
        <div id="npc-panel">
          <div class="npc-modal-top" id="npc-modal-top"></div>
          <div class="npc-modal-nav">
            <button class="npc-nav-btn" id="npc-prev">← Prev</button>
            <span class="npc-nav-counter" id="npc-counter"></span>
            ${window.isDM ? `
              <button class="npc-edit-btn" id="npc-edit-btn">✏️ Edit</button>
              <button class="npc-sheet-btn" id="npc-sheet-btn">📋 DM Sheet</button>
            ` : ''}
            <button class="npc-nav-btn" id="npc-next">Next →</button>
            <button class="npc-modal-close" id="npc-close">Close</button>
          </div>
          ${window.isDM ? `
            <div class="npc-visibility-panel" id="npc-vis-panel"></div>
          ` : ''}
        </div>
      </div>
    `);

    /* ---- Form modal (DM only) ---- */
    if (window.isDM) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="npc-form-modal">
          <div id="npc-form-panel">
            <div class="npc-form-title" id="npc-form-title">Add NPC</div>

            <div class="npc-form-field">
              <label>Name</label>
              <input class="npc-form-input" id="nf-name" type="text" placeholder="NPC name" />
            </div>

            <!-- Token upload + URL -->
            <div class="npc-form-field">
              <label>Token Image</label>
              <div class="npc-upload-row">
                <input class="npc-form-input" id="nf-token" type="url" placeholder="URL (auto-filled on upload)" />
                <label class="npc-upload-btn" for="nf-token-file">📁 Upload</label>
                <input type="file" id="nf-token-file" accept="image/*" style="display:none;" />
              </div>
              <div class="npc-upload-preview" id="nf-token-preview"></div>
            </div>

            <!-- Portrait upload + URL -->
            <div class="npc-form-field">
              <label>Full Portrait Image</label>
              <div class="npc-upload-row">
                <input class="npc-form-input" id="nf-image" type="url" placeholder="URL (auto-filled on upload)" />
                <label class="npc-upload-btn" for="nf-image-file">📁 Upload</label>
                <input type="file" id="nf-image-file" accept="image/*" style="display:none;" />
              </div>
              <div class="npc-upload-preview" id="nf-image-preview"></div>
            </div>

            <div class="npc-form-field">
              <label>Biography / Known Info</label>
              <textarea class="npc-form-textarea" id="nf-bio" placeholder="What is known about this NPC…"></textarea>
            </div>
            <div class="npc-form-field">
              <label>Display Order</label>
              <input class="npc-form-input" id="nf-order" type="number" min="0" value="0" style="width:80px;" />
            </div>
            <div class="npc-form-field">
              <label>Campaign</label>
              <select class="npc-form-input" id="nf-timeline">
                <option value="">— No campaign —</option>
              </select>
            </div>

            <div class="npc-form-actions">
              <button class="npc-form-delete-btn" id="nf-delete" style="display:none;">Delete NPC</button>
              <button class="npc-form-cancel-btn" id="nf-cancel">Cancel</button>
              <button class="npc-form-save-btn" id="nf-save">Save NPC</button>
            </div>
          </div>
        </div>
      `);

      document.getElementById('nf-cancel').addEventListener('click', closeForm);
      document.getElementById('nf-save').addEventListener('click', saveNpc);
      document.getElementById('nf-delete').addEventListener('click', deleteNpc);
      document.getElementById('npc-form-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('npc-form-modal')) closeForm();
      });

      // Upload handlers
      document.getElementById('nf-token-file').addEventListener('change', e => handleUpload(e, 'token'));
      document.getElementById('nf-image-file').addEventListener('change', e => handleUpload(e, 'image'));

      document.getElementById('npc-edit-btn').addEventListener('click', () => openForm(_visibleNpcs[_modalIndex]));
      document.getElementById('npc-sheet-btn').addEventListener('click', () => {
        const npc = _visibleNpcs[_modalIndex];
        if (npc) window.location.href = `character-sheet.html?npc=${npc.id}`;
      });
    }

    document.getElementById('npc-prev').addEventListener('click', () => navigateModal(-1));
    document.getElementById('npc-next').addEventListener('click', () => navigateModal(1));
    document.getElementById('npc-close').addEventListener('click', closeModal);
    document.getElementById('npc-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('npc-modal')) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (!document.getElementById('npc-modal').classList.contains('open')) return;
      if (e.key === 'ArrowLeft')  navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
      if (e.key === 'Escape')     closeModal();
    });
  }

  /* ----------------------------------------------------------
     Image upload handler
  ---------------------------------------------------------- */
  async function handleUpload(e, field) {
    const file = e.target.files[0];
    if (!file) return;

    const btn      = document.querySelector(`label[for="nf-${field}-file"]`);
    const urlInput = document.getElementById(`nf-${field}`);
    const preview  = document.getElementById(`nf-${field}-preview`);

    btn.textContent = 'Uploading…';

    // We need an NPC ID to store against — use editing ID or generate a temp one
    const npcId = _editingId || `temp-${Date.now()}`;

    try {
      const url = await uploadImage(file, npcId, field);
      urlInput.value   = url;
      preview.innerHTML = `<img src="${url}" alt="preview" style="max-height:80px;border-radius:6px;margin-top:0.4rem;" />`;
      btn.textContent  = '✓ Uploaded';
      setTimeout(() => { btn.textContent = '📁 Upload'; }, 2000);
    } catch (err) {
      console.error('Upload failed:', err);
      btn.textContent = '✗ Failed';
      setTimeout(() => { btn.textContent = '📁 Upload'; }, 2500);
    }
  }

  /* ----------------------------------------------------------
     Modal open / close / navigate
  ---------------------------------------------------------- */
  function openModal(idx) {
    _modalIndex = idx;
    renderModalContent();
    document.getElementById('npc-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('npc-modal').classList.remove('open');
  }

  function navigateModal(dir) {
    const next = _modalIndex + dir;
    if (next < 0 || next >= _visibleNpcs.length) return;
    _modalIndex = next;
    renderModalContent();
  }

  function renderModalContent() {
    const npc = _visibleNpcs[_modalIndex];
    if (!npc) return;

    const portraitEl = npc.image
      ? `<img class="npc-modal-portrait" src="${esc(npc.image)}" alt="${esc(npc.name)}"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
         <div class="npc-modal-portrait-placeholder" style="display:none;">🧙</div>`
      : `<div class="npc-modal-portrait-placeholder">🧙</div>`;

    document.getElementById('npc-modal-top').innerHTML = `
      ${portraitEl}
      <div class="npc-modal-info">
        <div class="npc-modal-name">${esc(npc.name || 'Unknown')}</div>
        <div class="npc-modal-bio">${esc(npc.bio || 'No information known.')}</div>
      </div>
    `;

    document.getElementById('npc-counter').textContent = `${_modalIndex + 1} / ${_visibleNpcs.length}`;
    document.getElementById('npc-prev').disabled = _modalIndex === 0;
    document.getElementById('npc-next').disabled = _modalIndex === _visibleNpcs.length - 1;

    if (window.isDM) renderVisibilityPanel(npc);
  }

  /* ----------------------------------------------------------
     Visibility panel
  ---------------------------------------------------------- */
  function renderVisibilityPanel(npc) {
    const panel = document.getElementById('npc-vis-panel');
    if (!panel) return;
    const vis = npc.visibility || {};

    let html = `
      <label class="npc-vis-toggle ${vis.all ? 'active' : ''}" data-uid="all">
        <input type="checkbox" ${vis.all ? 'checked' : ''} /> All Players
      </label>
    `;
    _players.forEach(p => {
      const checked = vis[p.uid] === true;
      html += `
        <label class="npc-vis-toggle ${checked ? 'active' : ''}" data-uid="${esc(p.uid)}">
          <input type="checkbox" ${checked ? 'checked' : ''} /> ${esc(p.username || p.email)}
        </label>
      `;
    });

    panel.innerHTML = `
      <div class="npc-visibility-title">🔒 Visibility — who can see this NPC?</div>
      <div class="npc-visibility-grid">${html}</div>
    `;

    panel.querySelectorAll('.npc-vis-toggle').forEach(label => {
      label.querySelector('input').addEventListener('change', async (e) => {
        const uid     = label.dataset.uid;
        const checked = e.target.checked;
        label.classList.toggle('active', checked);
        const update = {};
        update[`visibility.${uid}`] = checked;
        try {
          await _npcCol().doc(npc.id).update(update);
          if (!npc.visibility) npc.visibility = {};
          npc.visibility[uid] = checked;
        } catch (err) { console.error('Visibility update failed:', err); }
      });
    });
  }

  /* ----------------------------------------------------------
     Add / Edit Form
  ---------------------------------------------------------- */
  function openForm(npc) {
    _editingId = npc ? npc.id : null;
    document.getElementById('npc-form-title').textContent = npc ? 'Edit NPC' : 'Add NPC';
    document.getElementById('nf-name').value  = npc?.name  || '';
    document.getElementById('nf-token').value = npc?.token || '';
    document.getElementById('nf-image').value = npc?.image || '';
    document.getElementById('nf-bio').value   = npc?.bio   || '';
    document.getElementById('nf-order').value = npc?.order ?? _allNpcs.length;
    document.getElementById('nf-delete').style.display = npc ? 'block' : 'none';

    // Populate timeline dropdown
    const tlSel = document.getElementById('nf-timeline');
    if (tlSel) {
      tlSel.innerHTML = '<option value="">— No campaign —</option>' +
        _timelines.map(t =>
          `<option value="${t.id}" ${(npc?.timelineId === t.id) ? 'selected' : ''}>${t.name}</option>`
        ).join('');
      if (!npc && _currentTimelineId) tlSel.value = _currentTimelineId;
    }

    // Show existing image previews
    const tp = document.getElementById('nf-token-preview');
    const ip = document.getElementById('nf-image-preview');
    tp.innerHTML = npc?.token ? `<img src="${esc(npc.token)}" style="max-height:60px;border-radius:6px;margin-top:0.4rem;" />` : '';
    ip.innerHTML = npc?.image ? `<img src="${esc(npc.image)}" style="max-height:60px;border-radius:6px;margin-top:0.4rem;" />` : '';

    document.getElementById('npc-form-modal').classList.add('open');
    closeModal();
  }

  function closeForm() {
    document.getElementById('npc-form-modal').classList.remove('open');
    _editingId = null;
  }

  async function saveNpc() {
    const btn = document.getElementById('nf-save');
    btn.textContent = 'Saving…'; btn.disabled = true;

    const data = {
      name:       document.getElementById('nf-name').value.trim(),
      token:      document.getElementById('nf-token').value.trim(),
      image:      document.getElementById('nf-image').value.trim(),
      bio:        document.getElementById('nf-bio').value.trim(),
      order:      parseInt(document.getElementById('nf-order').value, 10) || 0,
      timelineId: document.getElementById('nf-timeline')?.value || null,
    };

    if (!data.name) {
      btn.textContent = 'Save NPC'; btn.disabled = false;
      alert('Please enter a name.');
      return;
    }

    try {
      if (_editingId) {
        const existing = _allNpcs.find(n => n.id === _editingId);
        data.visibility = existing?.visibility || {};
        await _npcCol().doc(_editingId).set(data);
      } else {
        data.visibility = {};
        await _npcCol().add(data);
      }
      await loadNpcs();
      renderGrid();
      closeForm();
    } catch (e) {
      console.error('Save NPC failed:', e);
      alert('Save failed: ' + e.message);
    } finally {
      btn.textContent = 'Save NPC'; btn.disabled = false;
    }
  }

  async function deleteNpc() {
    if (!_editingId) return;
    if (!confirm('Delete this NPC? This cannot be undone.')) return;
    try {
      await _npcCol().doc(_editingId).delete();
      await loadNpcs();
      renderGrid();
      closeForm();
    } catch (e) {
      console.error('Delete NPC failed:', e);
      alert('Delete failed: ' + e.message);
    }
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