/* ============================================================
   Abberanth Companion — Spell List
   Shows canonical spells (window.SPELL_DATA) + approved
   community submissions from Firestore.
   ============================================================ */

(function () {

  const WELLS = ['All','Arcane','Chaos','Day','Death','Fortitude','Life','Night','Order','Time'];
  let _filter    = 'All';
  let _community = [];

  async function loadCommunitySpells() {
    try {
      const snap = await window._db.collection('spellSubmissions')
        .where('status', '==', 'approved')
        .get();
      _community = snap.docs.map(d => ({ id: d.id, ...d.data(), isSubmission: true }));
    } catch (_) { _community = []; }
  }

  function allSpells() {
    const canonical = (window.SPELL_DATA || []).map(s => ({ ...s, isSubmission: false }));
    return [...canonical, ..._community];
  }

  function renderFilterBar() {
    const bar = document.getElementById('spell-filter-bar');
    if (!bar) return;
    bar.innerHTML = `<span class="spell-filter-label">Well:</span>` +
      WELLS.map(w => `<button class="spell-filter-btn${_filter === w ? ' active' : ''}"
        data-well="${w}">${w}</button>`).join('');
    bar.querySelectorAll('.spell-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter = btn.dataset.well;
        renderFilterBar();
        renderGrid();
      });
    });
  }

  function renderGrid() {
    const grid = document.getElementById('spell-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const spells = allSpells().filter(s => {
      if (_filter === 'All') return true;
      // spells-data.js uses `wells` (plural); submitted spells use `wellRequired`
      const well = s.wells?.name || s.well?.name || s.wellRequired || null;
      return well === _filter;
    });

    if (spells.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);">No spells found for this filter.</p>';
      return;
    }

    spells.forEach(spell => {
      const card = document.createElement('div');
      card.className = 'spell-card' + (spell.isSubmission ? ' community' : '');

      // Resolve well name + min level regardless of singular/plural field name
      const wellObj  = spell.wells || spell.well || null;
      const wellName = wellObj?.name || spell.wellRequired || null;
      const wellMin  = wellObj?.minLevel || spell.wellMinLevel || null;
      const wellLine = wellName
        ? `<div class="spell-well">Requires ${esc(wellName)}${wellMin ? ` ${wellMin}+` : ''}</div>`
        : '';

      const scaling = spell.scaling || spell.scalingDesc;

      card.innerHTML = `
        ${spell.isSubmission ? '<div class="spell-community-tag">⭐ Community Spell</div>' : ''}
        <div class="spell-card-header">
          <span class="spell-name">${esc(spell.name)}</span>
          <span class="spell-cost">${spell.cost ?? spell.manaCost ?? '?'} mana</span>
        </div>
        ${wellLine}
        <div class="spell-desc">${esc(spell.desc || spell.description || '')}</div>
        ${scaling ? `<div class="spell-scaling">Scaling: ${esc(scaling)}</div>` : ''}
      `;
      grid.appendChild(card);
    });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async () => {
      await loadCommunitySpells();
      renderFilterBar();
      renderGrid();
    });
  });

})();
