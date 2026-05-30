/* ============================================================
   Abberanth Companion — Merch JS
   - DM can add/edit/delete items stored in Firestore /merch
   - All authed users (including guests) can browse + buy
   - Buy button opens Stripe Payment Link in new tab
   ============================================================ */

(function () {

  const TYPE_LABELS = {
    apparel: '👕 Apparel',
    music:   '🎵 Music',
    digital: '📦 Digital',
    other:   '✨ Other',
  };

  const TYPE_ICONS = {
    apparel: '👕',
    music:   '🎵',
    digital: '📦',
    other:   '✨',
  };

  let _allItems   = [];
  let _editingId  = null;
  let _activeFilter = 'all';

  /* ---- DOM refs ---- */
  const grid       = () => document.getElementById('merch-grid');
  const adminBar   = () => document.getElementById('merch-admin-bar');
  const formWrap   = () => document.getElementById('merch-form-wrap');
  const formTitle  = () => document.getElementById('merch-form-title');

  /* ---- Init ---- */
  window.onAuthReady(async () => {
    if (window.isDM) {
      adminBar().style.display = 'block';
      document.getElementById('merch-add-btn')
        .addEventListener('click', () => openForm(null));
    }

    setupFilters();
    await loadItems();
    setupForm();
  });

  /* ---- Load items from Firestore ---- */
  async function loadItems() {
    grid().innerHTML = '<p class="merch-empty">Loading…</p>';
    try {
      const snap = await window._db.collection('merch')
        .orderBy('createdAt', 'desc')
        .get();
      _allItems = [];
      snap.forEach(doc => _allItems.push({ id: doc.id, ...doc.data() }));
      renderGrid();
    } catch (e) {
      // orderBy may need index; fall back
      try {
        const snap = await window._db.collection('merch').get();
        _allItems = [];
        snap.forEach(doc => _allItems.push({ id: doc.id, ...doc.data() }));
        renderGrid();
      } catch (e2) {
        grid().innerHTML = `<p class="merch-empty">Could not load items: ${e2.message}</p>`;
      }
    }
  }

  /* ---- Render grid with active filter ---- */
  function renderGrid() {
    const g = grid();
    const filtered = _activeFilter === 'all'
      ? _allItems
      : _allItems.filter(i => i.type === _activeFilter);

    if (filtered.length === 0) {
      g.innerHTML = '<p class="merch-empty">No items here yet.</p>';
      return;
    }

    g.innerHTML = '';
    filtered.forEach(item => g.appendChild(makeCard(item)));
  }

  /* ---- Build a merch card ---- */
  function makeCard(item) {
    const card = document.createElement('div');
    card.className = 'merch-card';

    // Image / icon area
    const imgWrap = document.createElement('div');
    imgWrap.className = 'merch-card-img';
    if (item.imageUrl) {
      const img = document.createElement('img');
      img.src   = item.imageUrl;
      img.alt   = item.name || '';
      img.onerror = () => { imgWrap.innerHTML = TYPE_ICONS[item.type] || '✨'; };
      imgWrap.appendChild(img);
    } else {
      imgWrap.textContent = TYPE_ICONS[item.type] || '✨';
    }
    card.appendChild(imgWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'merch-card-body';
    body.innerHTML = `
      <div class="merch-card-type">${TYPE_LABELS[item.type] || item.type || 'Item'}</div>
      <div class="merch-card-name">${esc(item.name || 'Unnamed Item')}</div>
      ${item.description ? `<div class="merch-card-desc">${esc(item.description)}</div>` : ''}
    `;
    card.appendChild(body);

    // Footer: price + buy button
    const footer = document.createElement('div');
    footer.className = 'merch-card-footer';
    footer.innerHTML = `
      <span class="merch-card-price">${esc(item.price || '')}</span>
      ${item.stripeUrl
        ? `<a class="merch-buy-btn" href="${esc(item.stripeUrl)}" target="_blank" rel="noopener">Buy →</a>`
        : `<span style="font-size:0.72rem;color:var(--text-muted);">Coming soon</span>`}
    `;
    card.appendChild(footer);

    // DM: edit / delete buttons
    if (window.isDM) {
      const dmActions = document.createElement('div');
      dmActions.className = 'merch-card-dm-actions';

      const editBtn = document.createElement('button');
      editBtn.className   = 'merch-card-dm-btn';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', () => openForm(item));

      const delBtn = document.createElement('button');
      delBtn.className   = 'merch-card-dm-btn delete';
      delBtn.textContent = '🗑 Delete';
      delBtn.addEventListener('click', () => deleteItem(item.id, item.name));

      dmActions.appendChild(editBtn);
      dmActions.appendChild(delBtn);
      card.appendChild(dmActions);
    }

    return card;
  }

  /* ---- Filter tabs ---- */
  function setupFilters() {
    document.querySelectorAll('.merch-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.merch-filter-btn')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _activeFilter = btn.dataset.filter;
        renderGrid();
      });
    });
  }

  /* ---- Form: open for add or edit ---- */
  function openForm(item) {
    _editingId = item ? item.id : null;
    formTitle().textContent = item ? 'Edit Item' : 'Add Merch Item';

    document.getElementById('mf-name').value   = item?.name        || '';
    document.getElementById('mf-price').value  = item?.price       || '';
    document.getElementById('mf-type').value   = item?.type        || 'apparel';
    document.getElementById('mf-stripe').value = item?.stripeUrl   || '';
    document.getElementById('mf-desc').value   = item?.description || '';
    document.getElementById('mf-img').value    = item?.imageUrl    || '';

    formWrap().style.display = 'block';
    formWrap().scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---- Form: wire up save + cancel ---- */
  function setupForm() {
    document.getElementById('mf-cancel').addEventListener('click', closeForm);
    document.getElementById('mf-save').addEventListener('click', saveItem);
  }

  function closeForm() {
    formWrap().style.display = 'none';
    _editingId = null;
  }

  /* ---- Save item to Firestore ---- */
  async function saveItem() {
    const name      = document.getElementById('mf-name').value.trim();
    const stripeUrl = document.getElementById('mf-stripe').value.trim();

    if (!name) {
      shake(document.getElementById('mf-name'));
      return;
    }

    const saveBtn = document.getElementById('mf-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const ts = typeof firebase !== 'undefined' && firebase.firestore
      ? firebase.firestore.FieldValue.serverTimestamp() : null;

    const data = {
      name,
      price:       document.getElementById('mf-price').value.trim(),
      type:        document.getElementById('mf-type').value,
      stripeUrl:   stripeUrl || null,
      description: document.getElementById('mf-desc').value.trim(),
      imageUrl:    document.getElementById('mf-img').value.trim() || null,
      updatedAt:   ts,
    };

    try {
      if (_editingId) {
        await window._db.collection('merch').doc(_editingId).update(data);
      } else {
        data.createdAt = ts;
        await window._db.collection('merch').add(data);
      }
      closeForm();
      await loadItems();
    } catch (e) {
      alert('Could not save item: ' + e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Item';
    }
  }

  /* ---- Delete item ---- */
  async function deleteItem(id, name) {
    if (!confirm(`Delete "${name || 'this item'}"? This cannot be undone.`)) return;
    try {
      await window._db.collection('merch').doc(id).delete();
      await loadItems();
    } catch (e) {
      alert('Could not delete item: ' + e.message);
    }
  }

  /* ---- Helpers ---- */
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shake(el) {
    el.style.borderColor = '#e05080';
    setTimeout(() => { el.style.borderColor = ''; }, 800);
  }

})();
