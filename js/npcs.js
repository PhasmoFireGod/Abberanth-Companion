/* ============================================================
   Abberanth Companion — NPCs Page Logic
   ============================================================ */

(function () {

  let _user        = null;
  let _allNpcs     = [];   // full list (DM sees all, players see filtered)
  let _visibleNpcs = [];   // what's currently shown / navigated
  let _modalIndex  = 0;
  let _players     = [];   // registered players (DM only, for visibility toggles)
  let _editingId   = null; // npc doc ID being edited, or null for new

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      _user = user;
      if (window.isDM) await loadPlayers();
      await loadNpcs();
      renderGrid();
      buildModals();
    });
  });

  /* ----------------------------------------------------------
     Firestore helpers
  ---------------------------------------------------------- */
  function _npcCol() { return window._db.collection('npcs'); }

  async function loadPlayers() {
    try {
      const dmEmails = (SITE_CONFIG.dmEmails || []).map(e => e.toLowerCase());
      const snap     = await window._db.collection('players').orderBy('email').get();
      _players = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!dmEmails.includes((d.email || '').toLowerCase())) {
          _players.push({ uid: d.uid || doc.id, email: d.email || doc.id });
        }
      });
    } catch (e) { console.warn('Could not load players:', e); }
  }

  async function loadNpcs() {
    try {
      const snap = await _npcCol().orderBy('order').get();
      _allNpcs   = [];
      snap.forEach(doc => _allNpcs.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
      // 'order' field index may not exist yet — fall back to unordered
      try {
        const snap = await _npcCol().get();
        _allNpcs   = [];
        snap.forEach(doc => _allNpcs.push({ id: doc.id, ...doc.data() }));
      } catch (e2) { console.warn('Could not load NPCs:', e2); }
    }

    // Filter for players
    if (window.isDM) {
      _visibleNpcs = [..._allNpcs];
    } else {
      const uid = _user?.uid || null;
      _visibleNpcs = _allNpcs.filter(n => {
        const v = n.visibility || {};
        return v.all === true || (uid && v[uid] === true);
      });
    }
  }

  /* ----------------------------------------------------------
     Grid rendering
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
        ? `<img class="npc-token" src="${esc(npc.token)}" alt="${esc(npc.name)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="npc-token-placeholder" style="display:none;">🧙</div>`
        : `<div class="npc-token-placeholder">🧙</div>`;

      card.innerHTML = `
        ${tokenEl}
        <span class="npc-card-name">${esc(npc.name || 'Unknown')}</span>
      `;
      grid.appendChild(card);
    });

    // DM: add "Add NPC" card
    if (window.isDM) {
      const addCard = document.createElement('div');
      addCard.className = 'npc-add-card';
      addCard.innerHTML = `<span style="font-size:1.5rem;">＋</span><span>Add NPC</span>`;
      addCard.addEventListener('click', () => openForm(null));
      grid.appendChild(addCard);
    }
  }

  /* ----------------------------------------------------------
     NPC Detail Modal
  ---------------------------------------------------------- */
  function buildModals() {
    // Detail modal
    document.body.insertAdjacentHTML('beforeend', `
      <div id="npc-modal">
        <div id="npc-panel">
          <div class="npc-modal-top" id="npc-modal-top"></div>
          <div class="npc-modal-nav">
            <button class="npc-nav-btn" id="npc-prev">← Prev</button>
            <span class="npc-nav-counter" id="npc-counter"></span>
            ${window.isDM ? '<button class="npc-edit-btn" id="npc-edit-btn">✏️ Edit</button>' : ''}
            <button class="npc-nav-btn" id="npc-next">Next →</button>
            <button class="npc-modal-close" id="npc-close">Close</button>
          </div>
          ${window.isDM ? '<div class="npc-visibility-panel" id="npc-vis-panel"></div>' : ''}
        </div>
      </div>
    `);

    // Form modal (DM only)
    if (window.isDM) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="npc-form-modal">
          <div id="npc-form-panel">
            <div class="npc-form-title" id="npc-form-title">Add NPC</div>
            <div class="npc-form-field">
              <label>Name</label>
              <input class="npc-form-input" id="nf-name" type="text" placeholder="NPC name" />
            </div>
            <div class="npc-form-field">
              <label>Token Image URL</label>
              <input class="npc-form-input" id="nf-token" type="url" placeholder="https://…" />
            </div>
            <div class="npc-form-field">
              <label>Full Portrait URL</label>
              <input class="npc-form-input" id="nf-image" type="url" placeholder="https://…" />
            </div>
            <div class="npc-form-field">
              <label>Biography / Known Info</label>
              <textarea class="npc-form-textarea" id="nf-bio" placeholder="What is known about this NPC…"></textarea>
            </div>
            <div class="npc-form-field">
              <label>Display Order</label>
              <input class="npc-form-input" id="nf-order" type="number" min="0" value="0" style="width:80px;" />
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
    }

    // Wire nav
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

    if (window.isDM) {
      document.getElementById('npc-edit-btn')?.addEventListener('click', () => {
        openForm(_visibleNpcs[_modalIndex]);
      });
    }
  }

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

    // Portrait + info
    const portraitEl = npc.image
      ? `<img class="npc-modal-portrait" src="${esc(npc.image)}" alt="${esc(npc.name)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="npc-modal-portrait-placeholder" style="display:none;">🧙</div>`
      : `<div class="npc-modal-portrait-placeholder">🧙</div>`;

    document.getElementById('npc-modal-top').innerHTML = `
      ${portraitEl}
      <div class="npc-modal-info">
        <div class="npc-modal-name">${esc(npc.name || 'Unknown')}</div>
        <div class="npc-modal-bio">${esc(npc.bio || 'No information known.')}</div>
      </div>
    `;

    // Counter
    document.getElementById('npc-counter').textContent =
      `${_modalIndex + 1} / ${_visibleNpcs.length}`;

    // Nav buttons
    document.getElementById('npc-prev').disabled = _modalIndex === 0;
    document.getElementById('npc-next').disabled = _modalIndex === _visibleNpcs.length - 1;

    // DM visibility panel
    if (window.isDM) renderVisibilityPanel(npc);
  }

  /* ----------------------------------------------------------
     Visibility panel (DM only)
  ---------------------------------------------------------- */
  function renderVisibilityPanel(npc) {
    const panel = document.getElementById('npc-vis-panel');
    if (!panel) return;

    const vis = npc.visibility || {};

    let togglesHtml = `
      <label class="npc-vis-toggle ${vis.all ? 'active' : ''}" data-uid="all">
        <input type="checkbox" ${vis.all ? 'checked' : ''} /> All Players
      </label>
    `;

    _players.forEach(p => {
      const checked = vis[p.uid] === true;
      togglesHtml += `
        <label class="npc-vis-toggle ${checked ? 'active' : ''}" data-uid="${esc(p.uid)}">
          <input type="checkbox" ${checked ? 'checked' : ''} /> ${esc(p.email)}
        </label>
      `;
    });

    panel.innerHTML = `
      <div class="npc-visibility-title">🔒 Visibility — who can see this NPC?</div>
      <div class="npc-visibility-grid">${togglesHtml}</div>
    `;

    panel.querySelectorAll('.npc-vis-toggle').forEach(label => {
      label.querySelector('input').addEventListener('change', async (e) => {
        const uid     = label.dataset.uid;
        const checked = e.target.checked;
        label.classList.toggle('active', checked);

        // Update Firestore
        const update = {};
        update[`visibility.${uid}`] = checked;
        try {
          await _npcCol().doc(npc.id).update(update);
          // Reflect locally
          if (!npc.visibility) npc.visibility = {};
          npc.visibility[uid] = checked;
        } catch (err) { console.error('Visibility update failed:', err); }
      });
    });
  }

  /* ----------------------------------------------------------
     Add / Edit Form (DM only)
  ---------------------------------------------------------- */
  function openForm(npc) {
    _editingId = npc ? npc.id : null;
    document.getElementById('npc-form-title').textContent = npc ? 'Edit NPC' : 'Add NPC';
    document.getElementById('nf-name').value  = npc?.name   || '';
    document.getElementById('nf-token').value = npc?.token  || '';
    document.getElementById('nf-image').value = npc?.image  || '';
    document.getElementById('nf-bio').value   = npc?.bio    || '';
    document.getElementById('nf-order').value = npc?.order  ?? _allNpcs.length;
    document.getElementById('nf-delete').style.display = npc ? 'block' : 'none';
    document.getElementById('npc-form-modal').classList.add('open');
    closeModal();
  }

  function closeForm() {
    document.getElementById('npc-form-modal').classList.remove('open');
    _editingId = null;
  }

  async function saveNpc() {
    const btn  = document.getElementById('nf-save');
    btn.textContent = 'Saving…'; btn.disabled = true;

    const data = {
      name:       document.getElementById('nf-name').value.trim(),
      token:      document.getElementById('nf-token').value.trim(),
      image:      document.getElementById('nf-image').value.trim(),
      bio:        document.getElementById('nf-bio').value.trim(),
      order:      parseInt(document.getElementById('nf-order').value, 10) || 0,
      visibility: {},
    };

    if (!data.name) {
      btn.textContent = 'Save NPC'; btn.disabled = false;
      alert('Please enter a name.');
      return;
    }

    try {
      if (_editingId) {
        // Preserve existing visibility when editing
        const existing = _allNpcs.find(n => n.id === _editingId);
        data.visibility = existing?.visibility || {};
        await _npcCol().doc(_editingId).set(data);
      } else {
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
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();