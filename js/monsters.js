/* ============================================================
   Abberanth Companion — Monsters
   DM: full stat blocks, image uploads, per-player visibility,
       optional stat reveal toggle.
   Players: see only revealed monsters; stat block shown only
            if DM has toggled statsRevealed.
   ============================================================ */

(function () {

  const ATTRIBUTES = ['Strength','Speed','Constitution','Wisdom','Intelligence','Charisma','Willpower'];
  const SHORT = { Strength:'STR', Speed:'SPD', Constitution:'CON', Wisdom:'WIS', Intelligence:'INT', Charisma:'CHA', Willpower:'WIL' };

  let _user              = null;
  let _all               = [];
  let _timelines         = [];
  let _currentTimelineId = null;
  let _visible    = [];
  let _players    = [];
  let _modalIdx   = 0;
  let _editingId  = null;

  /* ----------------------------------------------------------
     Firestore / Storage
  ---------------------------------------------------------- */
  function _col()      { return window._db.collection('monsters'); }
  function _stg()      { return window._storage; }

 async function uploadImage(file, id, field) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'Abberanth');
  const res  = await fetch('https://api.cloudinary.com/v1_1/dwvp6we4c/auto/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url;
}

  async function loadPlayers() {
    if (!window.isDM) return;
    try {
      const dmEmails = (SITE_CONFIG.dmEmails || []).map(e => e.toLowerCase());
      const snap = await window._db.collection('players').orderBy('email').get();
      _players = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!dmEmails.includes((d.email||'').toLowerCase()))
          _players.push({ uid: d.uid || doc.id, email: d.email || doc.id, username: d.username || null });
      });
    } catch(e) { console.warn('Could not load players:', e); }
  }

  async function loadMonsters() {
    try {
      const snap = await _col().orderBy('order').get();
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(_) {
      try {
        const snap = await _col().get();
        _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e) { _all = []; console.warn('Monsters load failed:', e); }
    }

    const uid = _user?.uid;
    _visible = window.isDM
      ? (_currentTimelineId ? _all.filter(m => m.timelineId === _currentTimelineId) : [..._all])
      : _all.filter(m => {
          const v = m.visibility || {};
          const visibleToPlayer = v.all === true || (uid && v[uid] === true);
          const inTimeline = !_currentTimelineId || m.timelineId === _currentTimelineId;
          return visibleToPlayer && inTimeline;
        });
  }

  /* ----------------------------------------------------------
     Grid
  ---------------------------------------------------------- */
  function renderGrid() {
    const grid = document.getElementById('monster-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (_visible.length === 0 && !window.isDM) {
      grid.insertAdjacentHTML('beforeend', '<p class="mon-empty">No monsters have been revealed yet.</p>');
      return;
    }

    _visible.forEach((mon, idx) => {
      const card = document.createElement('div');
      card.className = 'mon-card';
      card.addEventListener('click', () => openModal(idx));

      const tokenEl = mon.token
        ? `<img class="mon-token" src="${esc(mon.token)}" alt="${esc(mon.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
           <div class="mon-token-placeholder" style="display:none;">🐉</div>`
        : `<div class="mon-token-placeholder">🐉</div>`;

      card.innerHTML = `
        ${tokenEl}
        <span class="mon-card-name">${esc(mon.name || 'Unknown')}</span>
        ${mon.threat ? `<span class="mon-threat">Threat ${esc(String(mon.threat))}</span>` : ''}
      `;
      grid.appendChild(card);
    });

    if (window.isDM) {
      const add = document.createElement('div');
      add.className = 'mon-add-card';
      add.innerHTML = '<span style="font-size:1.5rem;">＋</span><span>Add Monster</span>';
      add.addEventListener('click', () => openForm(null));
      grid.appendChild(add);
    }
  }

  /* ----------------------------------------------------------
     Modals — build once
  ---------------------------------------------------------- */
  function buildModals() {
    /* ---- Detail modal ---- */
    document.body.insertAdjacentHTML('beforeend', `
      <div id="mon-modal">
        <div id="mon-panel">
          <div class="mon-modal-top"  id="mon-modal-top"></div>
          <div class="mon-stat-block" id="mon-stat-block" style="display:none;"></div>
          ${window.isDM ? '<div class="mon-dm-notes-wrap" id="mon-dm-notes-wrap"></div>' : ''}
          <div class="mon-modal-nav">
            <button class="mon-nav-btn" id="mon-prev">← Prev</button>
            <span  class="mon-nav-counter" id="mon-counter"></span>
            ${window.isDM ? '<button class="mon-edit-btn" id="mon-edit-btn">✏️ Edit</button>' : ''}
            <button class="mon-nav-btn" id="mon-next">Next →</button>
            <button class="mon-modal-close" id="mon-close">Close</button>
          </div>
          ${window.isDM ? '<div class="mon-vis-panel" id="mon-vis-panel"></div>' : ''}
        </div>
      </div>
    `);

    document.getElementById('mon-prev').addEventListener('click',  () => navigate(-1));
    document.getElementById('mon-next').addEventListener('click',  () => navigate(1));
    document.getElementById('mon-close').addEventListener('click', closeModal);
    document.getElementById('mon-modal').addEventListener('click', e => {
      if (e.target.id === 'mon-modal') closeModal();
    });
    document.addEventListener('keydown', e => {
      if (!document.getElementById('mon-modal').classList.contains('open')) return;
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Escape')     closeModal();
    });

    if (window.isDM) {
      document.getElementById('mon-edit-btn').addEventListener('click', () => openForm(_visible[_modalIdx]));
      buildFormModal();
    }
  }

  /* ----------------------------------------------------------
     Form modal (DM only)
  ---------------------------------------------------------- */
  function buildFormModal() {
    const attrInputs = ATTRIBUTES.map(a => `
      <div class="mon-form-attr">
        <label>${SHORT[a]}</label>
        <input class="mon-attr-input" type="number" min="0" max="20" value="0" data-attr="${a}" />
      </div>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
      <div id="mon-form-modal">
        <div id="mon-form-panel">
          <div class="mon-form-title" id="mon-form-title">Add Monster</div>

          <div class="mon-form-2col">
            <div class="mon-form-field">
              <label>Name *</label>
              <input class="mon-form-input" id="mf-name" type="text" placeholder="Monster name" />
            </div>
            <div class="mon-form-field">
              <label>Type</label>
              <input class="mon-form-input" id="mf-type" type="text" placeholder="Beast, Undead, Dragon…" />
            </div>
            <div class="mon-form-field">
              <label>Threat Level</label>
              <input class="mon-form-input" id="mf-threat" type="number" min="0" value="1" />
            </div>
            <div class="mon-form-field">
              <label>Display Order</label>
              <input class="mon-form-input" id="mf-order" type="number" min="0" value="0" />
            </div>
          </div>

          <div class="mon-form-2col">
            <div class="mon-form-field">
              <label>Token Image (circle)</label>
              <div class="mon-upload-row">
                <input class="mon-form-input" id="mf-token" type="url" placeholder="URL or upload →" />
                <label class="mon-upload-btn" for="mf-token-file">📁</label>
                <input type="file" id="mf-token-file" accept="image/*" style="display:none;" />
              </div>
              <div id="mf-token-preview"></div>
            </div>
            <div class="mon-form-field">
              <label>Full Portrait</label>
              <div class="mon-upload-row">
                <input class="mon-form-input" id="mf-image" type="url" placeholder="URL or upload →" />
                <label class="mon-upload-btn" for="mf-image-file">📁</label>
                <input type="file" id="mf-image-file" accept="image/*" style="display:none;" />
              </div>
              <div id="mf-image-preview"></div>
            </div>
          </div>

          <div class="mon-form-section-label">Core Stats</div>
          <div class="mon-form-3col">
            <div class="mon-form-field">
              <label>HP</label>
              <input class="mon-form-input" id="mf-hp" type="number" min="0" value="10" />
            </div>
            <div class="mon-form-field">
              <label>AC</label>
              <input class="mon-form-input" id="mf-ac" type="number" min="0" value="10" />
            </div>
            <div class="mon-form-field">
              <label>Speed (m)</label>
              <input class="mon-form-input" id="mf-speed" type="number" min="0" value="6" />
            </div>
          </div>

          <div class="mon-form-section-label">Attributes</div>
          <div class="mon-attr-grid">${attrInputs}</div>

          <div class="mon-form-field">
            <label>Description <span class="mon-form-hint">(shown to players)</span></label>
            <textarea class="mon-form-textarea" id="mf-desc" placeholder="What the players can see or know…"></textarea>
          </div>

          <div class="mon-form-field">
            <label>DM Notes <span class="mon-form-hint">(always hidden from players)</span></label>
            <textarea class="mon-form-textarea" id="mf-dmnotes" placeholder="Weaknesses, loot, tactics…"></textarea>
          </div>

          <div class="mon-form-section-label">
            Attacks
            <button class="mon-form-add-row-btn" id="mf-add-attack">+ Add Attack</button>
          </div>
          <div id="mf-attacks"></div>

          <div class="mon-form-section-label">
            Special Abilities
            <button class="mon-form-add-row-btn" id="mf-add-ability">+ Add Ability</button>
          </div>
          <div id="mf-abilities"></div>

          <div class="mon-form-field">
            <label>Campaign</label>
            <select class="mon-form-input" id="mf-timeline">
              <option value="">— No campaign —</option>
            </select>
          </div>

          <div class="mon-form-actions">
            <button class="mon-form-delete-btn" id="mf-delete" style="display:none;">Delete</button>
            <button class="mon-form-cancel-btn" id="mf-cancel">Cancel</button>
            <button class="mon-form-save-btn"   id="mf-save">Save Monster</button>
          </div>
        </div>
      </div>
    `);

    document.getElementById('mf-cancel').addEventListener('click', closeForm);
    document.getElementById('mf-save').addEventListener('click',   saveMonster);
    document.getElementById('mf-delete').addEventListener('click', deleteMonster);
    document.getElementById('mon-form-modal').addEventListener('click', e => {
      if (e.target.id === 'mon-form-modal') closeForm();
    });
    document.getElementById('mf-token-file').addEventListener('change', e => handleUpload(e, 'token'));
    document.getElementById('mf-image-file').addEventListener('change', e => handleUpload(e, 'image'));
    document.getElementById('mf-add-attack').addEventListener('click',  () => addAttackRow());
    document.getElementById('mf-add-ability').addEventListener('click', () => addAbilityRow());
  }

  /* ----------------------------------------------------------
     Dynamic attack / ability rows
  ---------------------------------------------------------- */
  function addAttackRow(d = {}) {
    const row = document.createElement('div');
    row.className = 'mon-form-row';
    row.innerHTML = `
      <input class="mon-form-input mon-attack-name"  type="text" placeholder="Name"      value="${esc(d.name ||'')}" />
      <input class="mon-form-input mon-attack-dice"  type="text" placeholder="2d6+3"     value="${esc(d.dice ||'')}" />
      <select class="mon-form-select mon-attack-type">
        ${['Melee','Ranged','Spell','Other'].map(t =>
          `<option ${(d.type||'Melee')===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <input class="mon-form-input mon-attack-notes" type="text" placeholder="Notes"     value="${esc(d.notes||'')}" />
      <button class="mon-row-remove" type="button">✕</button>
    `;
    row.querySelector('.mon-row-remove').addEventListener('click', () => row.remove());
    document.getElementById('mf-attacks').appendChild(row);
  }

  function addAbilityRow(d = {}) {
    const row = document.createElement('div');
    row.className = 'mon-ability-row';
    row.innerHTML = `
      <div class="mon-ability-row-header">
        <input class="mon-form-input mon-ability-name" type="text" placeholder="Ability name" value="${esc(d.name||'')}" />
        <button class="mon-row-remove" type="button">✕</button>
      </div>
      <textarea class="mon-form-textarea mon-ability-desc" placeholder="Description…">${esc(d.desc||'')}</textarea>
    `;
    row.querySelector('.mon-row-remove').addEventListener('click', () => row.remove());
    document.getElementById('mf-abilities').appendChild(row);
  }

  function collectAttacks() {
    return [...document.querySelectorAll('#mf-attacks .mon-form-row')].map(r => ({
      name:  r.querySelector('.mon-attack-name').value.trim(),
      dice:  r.querySelector('.mon-attack-dice').value.trim(),
      type:  r.querySelector('.mon-attack-type').value,
      notes: r.querySelector('.mon-attack-notes').value.trim(),
    })).filter(a => a.name);
  }

  function collectAbilities() {
    return [...document.querySelectorAll('#mf-abilities .mon-ability-row')].map(r => ({
      name: r.querySelector('.mon-ability-name').value.trim(),
      desc: r.querySelector('.mon-ability-desc').value.trim(),
    })).filter(a => a.name);
  }

  /* ----------------------------------------------------------
     Upload
  ---------------------------------------------------------- */
  async function handleUpload(e, field) {
    const file = e.target.files[0];
    if (!file) return;
    const btn     = document.querySelector(`label[for="mf-${field}-file"]`);
    const urlInput = document.getElementById(`mf-${field}`);
    const preview  = document.getElementById(`mf-${field}-preview`);
    btn.textContent = '…';
    try {
      const url = await uploadImage(file, _editingId || `tmp-${Date.now()}`, field);
      urlInput.value = url;
      preview.innerHTML = `<img src="${url}" style="max-height:70px;border-radius:6px;margin-top:0.35rem;" />`;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '📁'; }, 2000);
    } catch(err) {
      console.error('Upload failed:', err);
      btn.textContent = '✗';
      setTimeout(() => { btn.textContent = '📁'; }, 2500);
    }
  }

  /* ----------------------------------------------------------
     Modal open / navigate / close
  ---------------------------------------------------------- */
  function openModal(idx) {
    _modalIdx = idx;
    renderModal();
    document.getElementById('mon-modal').classList.add('open');
  }
  function closeModal() { document.getElementById('mon-modal').classList.remove('open'); }
  function navigate(dir) {
    const n = _modalIdx + dir;
    if (n < 0 || n >= _visible.length) return;
    _modalIdx = n;
    renderModal();
  }

  function renderModal() {
    const mon = _visible[_modalIdx];
    if (!mon) return;

    /* Top */
    const portrait = mon.image
      ? `<img class="mon-modal-portrait" src="${esc(mon.image)}" alt="${esc(mon.name)}"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
         <div class="mon-modal-portrait-placeholder" style="display:none;">🐉</div>`
      : `<div class="mon-modal-portrait-placeholder">🐉</div>`;

    const typeLine = [mon.type, mon.threat ? `Threat ${mon.threat}` : ''].filter(Boolean).join(' · ');

    document.getElementById('mon-modal-top').innerHTML = `
      ${portrait}
      <div class="mon-modal-info">
        <div class="mon-modal-name">${esc(mon.name || 'Unknown')}</div>
        ${typeLine ? `<div class="mon-modal-type">${esc(typeLine)}</div>` : ''}
        ${mon.description ? `<div class="mon-modal-desc">${esc(mon.description)}</div>` : ''}
      </div>
    `;

    /* Stat block */
    const sbEl = document.getElementById('mon-stat-block');
    if (window.isDM || mon.statsRevealed) {
      sbEl.style.display = 'block';
      sbEl.innerHTML = buildStatBlock(mon);
    } else {
      sbEl.style.display = 'none';
    }

    /* DM notes */
    if (window.isDM) {
      const dmEl = document.getElementById('mon-dm-notes-wrap');
      dmEl.innerHTML = mon.dmNotes
        ? `<div class="mon-dm-notes-label">🔒 DM Notes</div>
           <div class="mon-dm-notes-text">${esc(mon.dmNotes)}</div>`
        : '';
    }

    /* Nav */
    document.getElementById('mon-counter').textContent = `${_modalIdx + 1} / ${_visible.length}`;
    document.getElementById('mon-prev').disabled = _modalIdx === 0;
    document.getElementById('mon-next').disabled = _modalIdx === _visible.length - 1;

    if (window.isDM) renderVisPanel(mon);
  }

  /* ----------------------------------------------------------
     Stat block HTML
  ---------------------------------------------------------- */
  function buildStatBlock(mon) {
    const attrs = mon.attrs || {};
    const core = ['hp','ac','speed'].map(k => {
      const label = k === 'speed' ? 'Speed' : k.toUpperCase();
      const val   = k === 'speed' ? `${mon[k] ?? 0}m` : mon[k] ?? 0;
      return mon[k] != null
        ? `<div class="mon-sb-core-stat"><span>${label}</span><strong>${val}</strong></div>` : '';
    }).join('');

    const attrHtml = ATTRIBUTES.map(a =>
      `<div class="mon-sb-attr">
        <span class="mon-sb-attr-name">${SHORT[a]}</span>
        <span class="mon-sb-attr-val">${attrs[a] ?? 0}</span>
      </div>`).join('');

    const attacksHtml = (mon.attacks || []).length
      ? `<div class="mon-sb-section-label">Attacks</div>` +
        (mon.attacks).map(a =>
          `<div class="mon-sb-attack">
            <span class="mon-sb-attack-name">${esc(a.name)}</span>
            ${a.dice  ? `<span class="mon-sb-attack-dice">${esc(a.dice)}</span>` : ''}
            ${a.type  ? `<span class="mon-sb-attack-type">${esc(a.type)}</span>` : ''}
            ${a.notes ? `<span class="mon-sb-attack-notes">${esc(a.notes)}</span>` : ''}
          </div>`).join('')
      : '';

    const abilitiesHtml = (mon.abilities || []).length
      ? `<div class="mon-sb-section-label">Special Abilities</div>` +
        (mon.abilities).map(ab =>
          `<div class="mon-sb-ability">
            <span class="mon-sb-ability-name">${esc(ab.name)}.</span>
            ${ab.desc ? `<span class="mon-sb-ability-desc">${esc(ab.desc)}</span>` : ''}
          </div>`).join('')
      : '';

    return `
      <div class="mon-sb-core">${core}</div>
      <div class="mon-sb-attrs">${attrHtml}</div>
      ${attacksHtml}
      ${abilitiesHtml}
    `;
  }

  /* ----------------------------------------------------------
     Visibility panel
  ---------------------------------------------------------- */
  function renderVisPanel(mon) {
    const panel = document.getElementById('mon-vis-panel');
    if (!panel) return;
    const vis = mon.visibility || {};

    let html = `
      <div class="mon-vis-title">🔒 Visibility — who can see this monster?</div>
      <div class="mon-vis-grid">
        <label class="mon-vis-toggle ${vis.all?'active':''}" data-uid="all">
          <input type="checkbox" ${vis.all?'checked':''} /> All Players
        </label>
    `;
    _players.forEach(p => {
      const on = vis[p.uid] === true;
      html += `
        <label class="mon-vis-toggle ${on?'active':''}" data-uid="${esc(p.uid)}">
          <input type="checkbox" ${on?'checked':''} /> ${esc(p.username || p.email)}
        </label>`;
    });
    html += `</div>
      <div class="mon-vis-stats-row">
        <label class="mon-vis-toggle ${mon.statsRevealed?'active':''}">
          <input type="checkbox" id="mon-stats-toggle" ${mon.statsRevealed?'checked':''} />
          📊 Reveal stat block to visible players
        </label>
      </div>`;

    panel.innerHTML = html;

    panel.querySelectorAll('.mon-vis-grid .mon-vis-toggle').forEach(label => {
      label.querySelector('input').addEventListener('change', async e => {
        const uid = label.dataset.uid;
        const on  = e.target.checked;
        label.classList.toggle('active', on);
        const upd = {};
        upd[`visibility.${uid}`] = on;
        try {
          await _col().doc(mon.id).update(upd);
          if (!mon.visibility) mon.visibility = {};
          mon.visibility[uid] = on;
        } catch(err) { console.error('Visibility update failed:', err); }
      });
    });

    document.getElementById('mon-stats-toggle')?.addEventListener('change', async e => {
      const on = e.target.checked;
      e.target.closest('label').classList.toggle('active', on);
      try {
        await _col().doc(mon.id).update({ statsRevealed: on });
        mon.statsRevealed = on;
        renderModal();   // refresh so stat block shows/hides
      } catch(err) { console.error('Stats reveal update failed:', err); }
    });
  }

  /* ----------------------------------------------------------
     Form — open / populate / save / delete
  ---------------------------------------------------------- */
  function openForm(mon) {
    _editingId = mon?.id ?? null;
    document.getElementById('mon-form-title').textContent = mon ? 'Edit Monster' : 'Add Monster';

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('mf-name',    mon?.name        || '');
    set('mf-type',    mon?.type        || '');
    set('mf-threat',  mon?.threat      ?? 1);
    set('mf-order',   mon?.order       ?? _all.length);
    set('mf-token',   mon?.token       || '');
    set('mf-image',   mon?.image       || '');
    set('mf-hp',      mon?.hp          ?? 10);
    set('mf-ac',      mon?.ac          ?? 10);
    set('mf-speed',   mon?.speed       ?? 6);
    set('mf-desc',    mon?.description || '');
    set('mf-dmnotes', mon?.dmNotes     || '');

    const attrs = mon?.attrs || {};
    document.querySelectorAll('.mon-attr-input').forEach(inp => {
      inp.value = attrs[inp.dataset.attr] ?? 0;
    });

    const imgPreview = (id, url) => {
      document.getElementById(id).innerHTML = url
        ? `<img src="${esc(url)}" style="max-height:60px;border-radius:6px;margin-top:0.35rem;" />` : '';
    };
    imgPreview('mf-token-preview', mon?.token);
    imgPreview('mf-image-preview', mon?.image);

    document.getElementById('mf-attacks').innerHTML   = '';
    (mon?.attacks   || []).forEach(a  => addAttackRow(a));
    document.getElementById('mf-abilities').innerHTML = '';
    (mon?.abilities || []).forEach(ab => addAbilityRow(ab));

    document.getElementById('mf-delete').style.display = mon ? 'block' : 'none';

    // Populate timeline dropdown
    const tlSel = document.getElementById('mf-timeline');
    if (tlSel) {
      tlSel.innerHTML = '<option value="">— No campaign —</option>' +
        _timelines.map(t =>
          `<option value="${t.id}" ${(mon?.timelineId === t.id) ? 'selected' : ''}>${t.name}</option>`
        ).join('');
      if (!mon && _currentTimelineId) tlSel.value = _currentTimelineId;
    }

    document.getElementById('mon-form-modal').classList.add('open');
    closeModal();
  }

  function closeForm() {
    document.getElementById('mon-form-modal').classList.remove('open');
    _editingId = null;
  }

  async function saveMonster() {
    const btn = document.getElementById('mf-save');
    btn.textContent = 'Saving…'; btn.disabled = true;

    const attrs = {};
    document.querySelectorAll('.mon-attr-input').forEach(inp => {
      attrs[inp.dataset.attr] = parseInt(inp.value, 10) || 0;
    });

    const num = id => parseInt(document.getElementById(id).value, 10) || 0;
    const str = id => document.getElementById(id).value.trim();

    const data = {
      name:        str('mf-name'),
      type:        str('mf-type'),
      threat:      num('mf-threat'),
      order:       num('mf-order'),
      timelineId:  document.getElementById('mf-timeline')?.value || null,
      token:       str('mf-token'),
      image:       str('mf-image'),
      hp:          num('mf-hp'),
      ac:          num('mf-ac'),
      speed:       num('mf-speed'),
      description: str('mf-desc'),
      dmNotes:     str('mf-dmnotes'),
      attrs,
      attacks:     collectAttacks(),
      abilities:   collectAbilities(),
    };

    if (!data.name) {
      alert('Please enter a name.');
      btn.textContent = 'Save Monster'; btn.disabled = false;
      return;
    }

    try {
      if (_editingId) {
        const existing = _all.find(m => m.id === _editingId);
        data.visibility   = existing?.visibility   || {};
        data.statsRevealed = existing?.statsRevealed ?? false;
        await _col().doc(_editingId).set(data);
      } else {
        data.visibility    = {};
        data.statsRevealed = false;
        await _col().add(data);
      }
      await loadMonsters();
      renderGrid();
      closeForm();
    } catch(e) {
      console.error('Save monster failed:', e);
      alert('Save failed: ' + e.message);
    } finally {
      btn.textContent = 'Save Monster'; btn.disabled = false;
    }
  }

  async function deleteMonster() {
    if (!_editingId || !confirm('Delete this monster? This cannot be undone.')) return;
    try {
      await _col().doc(_editingId).delete();
      await loadMonsters();
      renderGrid();
      closeForm();
    } catch(e) { alert('Delete failed: ' + e.message); }
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
    const bar = document.getElementById('monster-timeline-filter');
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
        await loadMonsters();
        renderGrid();
      });
    });
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
      await loadMonsters();
      renderTimelineFilter();
      renderGrid();
      buildModals();
    });
  });

})();
