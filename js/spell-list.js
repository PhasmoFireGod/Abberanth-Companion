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

      _community = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        isSubmission: true
      }));

    } catch (_) {
      _community = [];
    }
  }

  function allSpells() {
    const canonical = (window.SPELL_DATA || []).map(s => ({
      ...s,
      isSubmission: false
    }));

    return [...canonical, ..._community];
  }

  function renderFilterBar() {
    const bar = document.getElementById('spell-filter-bar');
    if (!bar) return;

    bar.innerHTML =
      `<span class="spell-filter-label">Well:</span>` +
      WELLS.map(w => `
        <button
          class="spell-filter-btn${_filter === w ? ' active' : ''}"
          data-well="${w}">
          ${w}
        </button>
      `).join('');

    bar.querySelectorAll('.spell-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _filter = btn.dataset.well;
        renderFilterBar();
        renderGrid();
      });
    });
  }

  function spellMatchesFilter(spell) {
    if (_filter === 'All') return true;

    // Canonical spells use wells: []
    if (Array.isArray(spell.wells)) {
      return spell.wells.some(w => w.name === _filter);
    }

    // Older/community formats
    const singleWell =
      spell.well?.name ||
      spell.wellRequired ||
      null;

    return singleWell === _filter;
  }

  function getWellDisplay(spell) {

    // Multi-well format
    if (Array.isArray(spell.wells)) {
      return spell.wells
        .map(w => `${w.name}${w.minLevel ? ` ${w.minLevel}+` : ''}`)
        .join(', ');
    }

    // Single-well format
    if (spell.well?.name) {
      return `${spell.well.name}${spell.well.minLevel ? ` ${spell.well.minLevel}+` : ''}`;
    }

    // Community format
    if (spell.wellRequired) {
      return `${spell.wellRequired}${spell.wellMinLevel ? ` ${spell.wellMinLevel}+` : ''}`;
    }

    return null;
  }

  function renderGrid() {

    const grid = document.getElementById('spell-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const spells = allSpells().filter(spellMatchesFilter);

    if (spells.length === 0) {
      grid.innerHTML = `
        <p style="color:var(--text-muted);">
          No spells found for this filter.
        </p>
      `;
      return;
    }

    spells.forEach(spell => {

      const card = document.createElement('div');

      card.className =
        'spell-card' +
        (spell.isSubmission ? ' community' : '');

      const wellDisplay = getWellDisplay(spell);

      const wellLine = wellDisplay
        ? `<div class="spell-well">Requires ${esc(wellDisplay)}</div>`
        : '';

      const scaling = spell.scaling || spell.scalingDesc;

      card.innerHTML = `
        ${spell.isSubmission
          ? '<div class="spell-community-tag">⭐ Community Spell</div>'
          : ''
        }

        <div class="spell-card-header">
          <span class="spell-name">
            ${esc(spell.name)}
          </span>

          <span class="spell-cost">
            ${spell.cost ?? spell.manaCost ?? '?'} mana
          </span>
        </div>

        ${wellLine}

        <div class="spell-desc">
          ${esc(spell.desc || spell.description || '')}
        </div>

        ${scaling
          ? `<div class="spell-scaling">
               Scaling: ${esc(scaling)}
             </div>`
          : ''
        }
      `;

      grid.appendChild(card);
    });
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {

    window.onAuthReady(async () => {

      await loadCommunitySpells();

      renderFilterBar();
      renderGrid();

    });

  });

})();