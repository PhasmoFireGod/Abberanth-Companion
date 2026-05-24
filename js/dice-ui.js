/* ============================================================
   Abberanth Companion — Dice UI
   Injects the dice modal into the page and handles all UI.
   Depends on dice.js being loaded first.
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     Modal markup — injected once into <body>
  ---------------------------------------------------------- */
  const MODAL_HTML = `
<div id="dice-modal">
  <div id="dice-panel">

    <div class="dp-header">
      <h2>🎲 Abberanth Dice</h2>
    </div>

    <!-- Skill slider -->
    <div class="dp-skill-row">
      <span class="dp-skill-label">Skill</span>
      <input type="range" id="skill-slider" min="0" max="70" value="0" step="1" />
      <span id="skill-value" class="dp-skill-badge">0</span>
    </div>

    <!-- Pool summary chips -->
    <div class="dp-pool-info" id="pool-info">
      <span class="dp-chip" id="pi-pool">1d10</span>
      <span class="dp-chip-sep">·</span>
      <span class="dp-chip" id="pi-keep">Keep 1</span>
      <span class="dp-chip-sep">·</span>
      <span class="dp-chip" id="pi-bonus">No bonus</span>
      <span class="dp-chip-sep">·</span>
      <span class="dp-chip dp-chip-explode" id="pi-explode">No explosions</span>
    </div>

    <!-- Roll button -->
    <button id="roll-pool-btn" class="dp-roll-btn">Roll the Pool</button>

    <!-- Results — hidden until first roll -->
    <div id="dice-results-area" class="dp-results hidden">

      <div id="dice-results-grid" class="dp-grid"></div>

      <div class="dp-autoselect-row">
        <span class="dp-autoselect-label">Auto-keep:</span>
        <button id="keep-high-btn" class="dp-keep-btn">Highest</button>
        <button id="keep-low-btn" class="dp-keep-btn">Lowest</button>
        <span class="dp-keep-hint" id="keep-hint"></span>
      </div>

      <div class="dp-total-row">
        <span class="dp-breakdown" id="total-breakdown"></span>
        <span class="dp-total-num" id="total-number">—</span>
      </div>

    </div>

    <!-- Roll history -->
    <ul id="roll-history" class="dp-history"></ul>

    <button id="close-dice" class="dp-close-btn">Close</button>
  </div>
</div>
`;

  /* ----------------------------------------------------------
     State
  ---------------------------------------------------------- */
  let currentDice  = [];
  let currentStats = null;
  let keptIndices  = new Set();
  const history    = [];
  const MAX_HIST   = 6;

  /* ----------------------------------------------------------
     Init
  ---------------------------------------------------------- */
  function init() {
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

    // Open triggers
    document.querySelectorAll('#dice-trigger, .dice-trigger').forEach(el =>
      el.addEventListener('click', openModal)
    );

    // Close
    const modal = document.getElementById('dice-modal');
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.getElementById('close-dice').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Slider
    document.getElementById('skill-slider').addEventListener('input', refreshPoolInfo);
    refreshPoolInfo();

    // Roll
    document.getElementById('roll-pool-btn').addEventListener('click', doRoll);

    // Auto-keep
    document.getElementById('keep-high-btn').addEventListener('click', () => applyAutoSelect('high'));
    document.getElementById('keep-low-btn').addEventListener('click',  () => applyAutoSelect('low'));
  }

  /* ----------------------------------------------------------
     Modal open / close
  ---------------------------------------------------------- */
  function openModal()  { document.getElementById('dice-modal').classList.add('open'); }
  function closeModal() { document.getElementById('dice-modal').classList.remove('open'); }

  /* ----------------------------------------------------------
     Pool info chips
  ---------------------------------------------------------- */
  function getSkill() {
    return parseInt(document.getElementById('skill-slider').value, 10);
  }

  function refreshPoolInfo() {
    const s     = getSkill();
    const stats = Dice.getPoolStats(s);

    document.getElementById('skill-value').textContent = s;

    // Pool chip — note when pool is capped
    const poolLabel = stats.poolSize === 10 && s > 10
      ? `10d10 (capped)`
      : `${stats.poolSize}d10`;
    document.getElementById('pi-pool').textContent = poolLabel;

    // Keep chip
    const keepLabel = stats.keepCount === stats.poolSize
      ? `Keep all ${stats.keepCount}`
      : `Keep ${stats.keepCount} of ${stats.poolSize}`;
    document.getElementById('pi-keep').textContent = keepLabel;

    // Bonus chip
    document.getElementById('pi-bonus').textContent =
      stats.bonus > 0 ? `+${stats.bonus} flat bonus` : 'No bonus';

    // Explode chip
    const explodeChip = document.getElementById('pi-explode');
    explodeChip.textContent = stats.canExplode ? '10s explode 💥' : 'No explosions';
    explodeChip.classList.toggle('dp-chip-explode--on', stats.canExplode);
  }

  /* ----------------------------------------------------------
     Roll
  ---------------------------------------------------------- */
  function doRoll() {
    const skill           = getSkill();
    const { dice, stats } = Dice.rollPool(skill);

    currentDice  = dice;
    currentStats = stats;
    keptIndices  = new Set();

    renderGrid();
    applyAutoSelect('high');   // default keep-high; also calls renderTotal

    // Record history after auto-select
    const total = Dice.calcTotal(currentDice, keptIndices, currentStats.bonus);
    pushHistory(skill, total);

    document.getElementById('dice-results-area').classList.remove('hidden');
  }

  /* ----------------------------------------------------------
     Die grid rendering
  ---------------------------------------------------------- */
  function renderGrid() {
    const grid = document.getElementById('dice-results-grid');
    grid.innerHTML = '';

    currentDice.forEach((die, i) => {
      const card = document.createElement('div');
      card.className   = 'dp-die';
      card.dataset.idx = i;
      card.addEventListener('click', () => toggleKeep(i));

      // Chain display: exploding 10s shown in orange, final roll in normal colour
      const chainHtml = die.chain.map((n, ci) => {
        const isExplodingTen = (n === 10 && ci < die.chain.length - 1);
        return `<span class="${isExplodingTen ? 'chain-ten' : 'chain-n'}">${n}</span>`;
      }).join('<span class="chain-sep">+</span>');

      card.innerHTML = `
        <div class="dp-die-total">${die.total}</div>
        <div class="dp-die-chain">${chainHtml}</div>
        ${die.exploded
          ? '<div class="dp-die-boom">💥</div>'
          : '<div class="dp-die-boom dp-die-boom--hidden"></div>'}
        <div class="dp-die-tick">✓ kept</div>
      `;

      grid.appendChild(card);
    });

    refreshKept();
    updateKeepHint();
  }

  /* ----------------------------------------------------------
     Keep toggling
  ---------------------------------------------------------- */
  function toggleKeep(idx) {
    if (keptIndices.has(idx)) {
      keptIndices.delete(idx);
    } else if (keptIndices.size < currentStats.keepCount) {
      keptIndices.add(idx);
    }
    // At max-kept, clicking an unkept die does nothing until one is deselected
    refreshKept();
    renderTotal();
    updateKeepHint();
  }

  function applyAutoSelect(pref) {
    keptIndices = new Set(Dice.autoSelect(currentDice, currentStats.keepCount, pref));
    refreshKept();
    renderTotal();
    updateKeepHint();
  }

  function refreshKept() {
    document.querySelectorAll('.dp-die').forEach(card => {
      const i = parseInt(card.dataset.idx, 10);
      card.classList.toggle('kept', keptIndices.has(i));
    });
  }

  function updateKeepHint() {
    if (!currentStats) return;
    const rem  = currentStats.keepCount - keptIndices.size;
    const hint = document.getElementById('keep-hint');
    if (rem === 0) {
      hint.textContent = 'All kept';
      hint.style.color = 'var(--accent-gold)';
    } else {
      hint.textContent = `${rem} more to keep`;
      hint.style.color = 'var(--text-muted)';
    }
  }

  /* ----------------------------------------------------------
     Total display
  ---------------------------------------------------------- */
  function renderTotal() {
    const kept  = [...keptIndices];
    const parts = kept.map(i => currentDice[i].total);
    const sum   = parts.reduce((a, b) => a + b, 0);
    const bonus = currentStats.bonus;
    const total = sum + bonus;

    let breakdown = '';
    if (kept.length === 0) {
      breakdown = 'Select dice to keep…';
    } else {
      breakdown = parts.join(' + ');
      if (bonus > 0) breakdown += ` + ${bonus} (flat bonus)`;
      breakdown += ' =';
    }

    document.getElementById('total-breakdown').textContent = breakdown;
    document.getElementById('total-number').textContent    = kept.length ? total : '—';
  }

  /* ----------------------------------------------------------
     History
  ---------------------------------------------------------- */
  function pushHistory(skill, total) {
    const entry = `Skill ${skill} → <strong>${total}</strong>`;
    history.unshift(entry);
    if (history.length > MAX_HIST) history.pop();

    document.getElementById('roll-history').innerHTML =
      history.map(h => `<li class="dp-hist-entry">${h}</li>`).join('');
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  /* ----------------------------------------------------------
     Public API — used by character-sheet.js dice buttons
  ---------------------------------------------------------- */
  window.DiceUI = {
    open: openModal,
    /**
     * Open the roller pre-set to a specific skill level.
     * No upper cap — skills can exceed 10 with wells, buffs, etc.
     */
    openWithSkill(level) {
      const slider = document.getElementById('skill-slider');
      if (!slider) return;
      // Clamp to slider range but don't cap at 10 anymore
      const max = parseInt(slider.max, 10);
      slider.value = Math.max(0, Math.min(max, Math.floor(Number(level) || 0)));
      refreshPoolInfo();
      openModal();
    },
  };

})();