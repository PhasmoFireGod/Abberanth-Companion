/* ============================================================
   Abberanth Companion — Timelines (Campaign Groups)
   DM: create campaigns, assign players.
   Players: see their campaigns, link to filtered journal/sessions.
   ============================================================ */

(function () {

  const COLORS = [
    '#6650d8', '#5898e8', '#c9923a', '#50d880',
    '#e05080', '#2a8a8a', '#e07030', '#b870e8',
  ];

  let _user     = null;
  let _players  = [];
  let _timelines = [];

  function _col() { return window._db.collection('timelines'); }

  /* ----------------------------------------------------------
     Load
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

  async function loadTimelines() {
    try {
      let snap;
      try { snap = await _col().orderBy('createdAt').get(); }
      catch (_) { snap = await _col().get(); }

      _timelines = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (!window.isDM) {
        _timelines = _timelines.filter(t =>
          (t.members || []).includes(_user?.uid)
        );
      }
    } catch (e) {
      console.warn('Timelines load failed:', e);
      _timelines = [];
    }
  }

  /* ----------------------------------------------------------
     Grid
  ---------------------------------------------------------- */
  function renderGrid() {
    const grid = document.getElementById('timeline-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (_timelines.length === 0) {
      grid.innerHTML = `<p class="tl-empty">${window.isDM
        ? 'No campaigns yet — click <strong>+ New Timeline</strong> to create one.'
        : 'You haven\'t been added to any campaign timelines yet.'
      }</p>`;
      return;
    }

    _timelines.forEach(tl => {
      const card = document.createElement('div');
      card.className = 'tl-card';
      card.style.borderTopColor = tl.color || COLORS[0];
      card.addEventListener('click', () => openModal(tl));

      const memberCount = (tl.members || []).length;

      card.innerHTML = `
        <div class="tl-card-header">
          <span class="tl-card-dot" style="background:${esc(tl.color || COLORS[0])};"></span>
          <span class="tl-card-name">${esc(tl.name || 'Untitled Campaign')}</span>
        </div>
        ${tl.description ? `<p class="tl-card-desc">${esc(tl.description)}</p>` : ''}
        <div class="tl-card-meta">
          <span>${memberCount} player${memberCount !== 1 ? 's' : ''}</span>
          <span class="tl-card-links">
            <a href="journal.html?tl=${esc(tl.id)}"   onclick="event.stopPropagation()">📔 Journal</a>
            <a href="playlist.html?tl=${esc(tl.id)}"  onclick="event.stopPropagation()">🎵 Sessions</a>
          </span>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  /* ----------------------------------------------------------
     Timeline modal (view / edit)
  ---------------------------------------------------------- */
  function openModal(tl) {
    removeEl('tl-modal');

    const colorBtns = COLORS.map(c =>
      `<button class="tl-color-btn${(tl.color || COLORS[0]) === c ? ' active' : ''}"
        data-color="${c}" style="background:${c};"
        ${window.isDM ? '' : 'disabled'}></button>`
    ).join('');

    const memberHtml = window.isDM
      ? _players.map(p => {
          const on = (tl.members || []).includes(p.uid);
          return `<label class="tl-member-toggle ${on ? 'active' : ''}" data-uid="${esc(p.uid)}">
            <input type="checkbox" ${on ? 'checked' : ''} /> ${esc(p.username || p.email)}
          </label>`;
        }).join('')
      : (tl.members || []).map(uid => {
          const p = _players.find(pl => pl.uid === uid);
          return `<span class="tl-member-chip">${esc(p?.email || uid)}</span>`;
        }).join('') || '<span style="color:var(--text-muted);font-size:0.8rem;">No members listed</span>';

    const wrap = document.createElement('div');
    wrap.id = 'tl-modal';
    wrap.className = 'tl-modal-overlay';
    wrap.innerHTML = `
      <div class="tl-modal-panel">
        <div class="tl-modal-color-bar" id="tl-modal-bar" style="background:${esc(tl.color || COLORS[0])}"></div>
        <div class="tl-modal-body">

          ${window.isDM ? `
            <input class="tl-name-input" id="tl-edit-name" type="text"
              placeholder="Campaign name" value="${esc(tl.name || '')}" />
            <textarea class="tl-desc-input" id="tl-edit-desc"
              placeholder="Description…">${esc(tl.description || '')}</textarea>
          ` : `
            <div class="tl-modal-name">${esc(tl.name || 'Untitled')}</div>
            ${tl.description ? `<p class="tl-modal-desc">${esc(tl.description)}</p>` : ''}
          `}

          ${window.isDM ? `
            <div class="tl-modal-section-label">Colour</div>
            <div class="tl-color-row" id="tl-modal-colors">${colorBtns}</div>
            <input type="hidden" id="tl-edit-color" value="${esc(tl.color || COLORS[0])}" />
          ` : ''}

          <div class="tl-modal-section-label">${window.isDM ? 'Players in this campaign' : 'Members'}</div>
          <div class="tl-member-list" id="tl-modal-members">${memberHtml}</div>

          <div class="tl-modal-section-label">Quick Links</div>
          <div class="tl-quick-links">
            <a class="tl-quick-link" href="journal.html?tl=${esc(tl.id)}">
              📔 Journal — ${esc(tl.name || 'this campaign')}
            </a>
            <a class="tl-quick-link" href="playlist.html?tl=${esc(tl.id)}">
              🎵 Sessions — ${esc(tl.name || 'this campaign')}
            </a>
          </div>

          <div class="tl-modal-actions">
            ${window.isDM ? '<button class="tl-delete-btn" id="tl-modal-delete">Delete</button>' : ''}
            <button class="tl-cancel-btn" id="tl-modal-close">Close</button>
            ${window.isDM ? '<button class="tl-save-btn" id="tl-modal-save">Save</button>' : ''}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    if (window.isDM) {
      // Colour picker
      wrap.querySelectorAll('.tl-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          wrap.querySelectorAll('.tl-color-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('tl-edit-color').value = btn.dataset.color;
          document.getElementById('tl-modal-bar').style.background = btn.dataset.color;
        });
      });

      // Member toggles
      wrap.querySelectorAll('.tl-member-toggle').forEach(label => {
        label.querySelector('input').addEventListener('change', e => {
          label.classList.toggle('active', e.target.checked);
        });
      });

      // Save
      document.getElementById('tl-modal-save').addEventListener('click', async () => {
        const name    = document.getElementById('tl-edit-name').value.trim();
        const desc    = document.getElementById('tl-edit-desc').value.trim();
        const color   = document.getElementById('tl-edit-color').value;
        const members = [...wrap.querySelectorAll('.tl-member-toggle.active')].map(l => l.dataset.uid);
        if (!name) { alert('Please enter a campaign name.'); return; }
        const btn = document.getElementById('tl-modal-save');
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await _col().doc(tl.id).update({ name, description: desc, color, members });
          removeEl('tl-modal');
          await loadTimelines();
          renderGrid();
        } catch (e) {
          alert('Save failed: ' + e.message);
          btn.disabled = false; btn.textContent = 'Save';
        }
      });

      // Delete
      document.getElementById('tl-modal-delete').addEventListener('click', async () => {
        if (!confirm(`Delete "${tl.name}"? Journal entries and sessions tagged to this campaign will lose their campaign tag.`)) return;
        try {
          await _col().doc(tl.id).delete();
          removeEl('tl-modal');
          await loadTimelines();
          renderGrid();
        } catch (e) { alert('Delete failed: ' + e.message); }
      });
    }

    document.getElementById('tl-modal-close').addEventListener('click', () => removeEl('tl-modal'));
    wrap.addEventListener('click', e => { if (e.target === wrap) removeEl('tl-modal'); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { removeEl('tl-modal'); document.removeEventListener('keydown', onKey); }
    });
  }

  /* ----------------------------------------------------------
     Create form (DM only)
  ---------------------------------------------------------- */
  function openCreateForm() {
    removeEl('tl-create-form');

    const colorBtns = COLORS.map((c, i) =>
      `<button class="tl-color-btn${i === 0 ? ' active' : ''}" data-color="${c}" style="background:${c};"></button>`
    ).join('');

    const memberHtml = _players.map(p =>
      `<label class="tl-member-toggle" data-uid="${esc(p.uid)}">
        <input type="checkbox" /> ${esc(p.username || p.email)}
      </label>`
    ).join('');

    const wrap = document.createElement('div');
    wrap.id = 'tl-create-form';
    wrap.className = 'tl-modal-overlay';
    wrap.innerHTML = `
      <div class="tl-modal-panel">
        <div class="tl-modal-color-bar" id="tl-new-bar" style="background:${COLORS[0]}"></div>
        <div class="tl-modal-body">
          <input class="tl-name-input" id="tl-new-name" type="text"
            placeholder="Campaign name (e.g. Darkfall Chronicles)" />
          <textarea class="tl-desc-input" id="tl-new-desc"
            placeholder="A brief description of this campaign…"></textarea>

          <div class="tl-modal-section-label">Colour</div>
          <div class="tl-color-row" id="tl-new-colors">${colorBtns}</div>
          <input type="hidden" id="tl-new-color" value="${COLORS[0]}" />

          <div class="tl-modal-section-label">Starting Players</div>
          <div class="tl-member-list" id="tl-new-members">${memberHtml || '<span style="color:var(--text-muted);font-size:0.8rem;">No players registered yet.</span>'}</div>

          <div class="tl-modal-actions">
            <button class="tl-cancel-btn" id="tl-new-cancel">Cancel</button>
            <button class="tl-save-btn"   id="tl-new-save">Create Campaign</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('tl-new-name').focus();

    wrap.querySelectorAll('.tl-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.tl-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tl-new-color').value = btn.dataset.color;
        document.getElementById('tl-new-bar').style.background = btn.dataset.color;
      });
    });

    wrap.querySelectorAll('.tl-member-toggle').forEach(label => {
      label.querySelector('input').addEventListener('change', e => {
        label.classList.toggle('active', e.target.checked);
      });
    });

    document.getElementById('tl-new-cancel').addEventListener('click', () => removeEl('tl-create-form'));
    wrap.addEventListener('click', e => { if (e.target === wrap) removeEl('tl-create-form'); });

    document.getElementById('tl-new-save').addEventListener('click', async () => {
      const name    = document.getElementById('tl-new-name').value.trim();
      const desc    = document.getElementById('tl-new-desc').value.trim();
      const color   = document.getElementById('tl-new-color').value;
      const members = [...wrap.querySelectorAll('.tl-member-toggle.active')].map(l => l.dataset.uid);
      if (!name) { alert('Please enter a campaign name.'); return; }
      const btn = document.getElementById('tl-new-save');
      btn.disabled = true; btn.textContent = 'Creating…';
      try {
        await _col().add({
          name, description: desc, color, members,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        removeEl('tl-create-form');
        await loadTimelines();
        renderGrid();
      } catch (e) {
        alert('Create failed: ' + e.message);
        btn.disabled = false; btn.textContent = 'Create Campaign';
      }
    });
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */
  function removeEl(id) { document.getElementById(id)?.remove(); }
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async user => {
      _user = user;
      if (window.isDM) {
        await loadPlayers();
        const btn = document.getElementById('create-timeline-btn');
        if (btn) { btn.style.display = 'block'; btn.addEventListener('click', openCreateForm); }
      }
      await loadTimelines();
      renderGrid();
    });
  });

})();
