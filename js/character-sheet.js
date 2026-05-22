/* ============================================================
   Abberanth Companion — Character Sheet Logic
   Handles point-buy tracking, dynamic skill/well rendering,
   autosave to localStorage, and dice roller integration.
   ============================================================ */

(function () {

  const TOTAL_POINTS = 50;
  const SAVE_KEY     = 'abberanth-char-sheet';

  /* Named body armor slots — tailOnly slots only show when tailedRace is true */
  const ARMOR_SLOT_DEFS = [
    { key: 'head',       label: 'Head' },
    { key: 'torsoUnder', label: 'Torso (Under)' },
    { key: 'torsoOver',  label: 'Torso (Over)' },
    { key: 'rightHand',  label: 'Right Hand' },
    { key: 'leftHand',   label: 'Left Hand' },
    { key: 'pantsUnder', label: 'Pants (Under)' },
    { key: 'pantsOver',  label: 'Pants (Over)' },
    { key: 'leftFoot',   label: 'Left Foot' },
    { key: 'rightFoot',  label: 'Right Foot' },
    { key: 'tail',       label: 'Tail', tailOnly: true },
  ];

  /* Recognized armor types. Cloth is valid but adds ×0. */
  const ARMOR_TYPES = new Set([
    'cloth',
    'hide', 'leather', 'ring mail', 'studded leather',
    'chain shirt', 'scale mail', 'breastplate', 'half plate',
    'chainmail', 'halfplate', 'splint', 'plate',
  ]);

  /* Armor dropdown options grouped by weight */
  const ARMOR_OPTION_GROUPS = [
    { group: 'Clothing', items: ['Cloth'] },
    { group: 'Light',    items: ['Hide', 'Leather', 'Ring Mail', 'Studded Leather'] },
    { group: 'Medium',   items: ['Chain Shirt', 'Scale Mail', 'Breastplate', 'Half Plate'] },
    { group: 'Heavy',    items: ['Chainmail', 'Splint', 'Plate'] },
  ];

  function getArmorMultiplier(name) {
    const n = (name || '').toLowerCase().trim();
    if (!ARMOR_TYPES.has(n) || n === 'cloth') return 0;
    if (n === 'plate') return 2;
    if (n === 'chainmail' || n === 'halfplate' || n === 'half plate') return 1.5;
    return 1;
  }

  function calcAC() {
    const con      = state.attrs['Constitution'] || 0;
    const armorSum = Object.values(state.armor || {}).reduce((sum, slot) => {
      if (!slot.name) return sum;
      return sum + ((slot.value || 0) * getArmorMultiplier(slot.name));
    }, 0);
    return Math.round(10 + con + armorSum);
  }

  function updateACDisplay() {
    const el = document.getElementById('cs-ac-display');
    if (el) el.textContent = calcAC();
  }

  /* ----------------------------------------------------------
     Status thresholds (HP %)
     Checked highest-first; first match wins.
  ---------------------------------------------------------- */
  const STATUS_LEVELS = [
    { min: 100, label: 'Perfect',       color: '#60d8b0' },  /* teal-green — safe */
    { min: 75,  label: 'Healthy',       color: '#80c8f0' },  /* sky blue */
    { min: 50,  label: 'Dazed',         color: '#9090f0' },  /* periwinkle */
    { min: 25,  label: 'Injured',       color: '#c078e0' },  /* violet */
    { min: 10,  label: 'Badly Injured', color: '#d050b0' },  /* purple-pink */
    { min: 1,   label: 'Critical',      color: '#e03880' },  /* magenta-red */
    { min: 0,   label: 'Dying',         color: '#c01850' },  /* deep crimson */
  ];

  /* ----------------------------------------------------------
     Data Definitions
  ---------------------------------------------------------- */
  const ATTRIBUTES = [
    'Strength', 'Speed', 'Constitution',
    'Wisdom', 'Intelligence', 'Charisma', 'Willpower',
  ];

  const SKILLS = {
    Physical: [
      'Acrobatics', 'Archery', 'Athletics', 'Brawl', 'Drive',
      'Firearms', 'Melee', 'Stealth', 'Survival',
      'Weapon (One-Handed)', 'Weapon (Bastard)', 'Weapon (Two-Handed)',
    ],
    Social: [
      'Animal Handling', 'Etiquette', 'Insight', 'Intimidation',
      'Leadership', 'Performance', 'Persuasion', 'Religion',
      'Streetwise', 'Subterfuge',
    ],
    Mental: [
      'Academics', 'Awareness', 'Finance', 'History', 'Investigation',
      'Medicine', 'Nature', 'Occult', 'Politics', 'Science', 'Technology',
    ],
  };

  const WELLS = [
    'Arcane', 'Chaos', 'Day', 'Death',
    'Fortitude', 'Life', 'Night', 'Order', 'Time',
  ];

  /* ----------------------------------------------------------
     Default State Factory
  ---------------------------------------------------------- */
  function makeDefault() {
    const attrs = {};
    ATTRIBUTES.forEach(a => (attrs[a] = 0));

    const skills = {};
    for (const [cat, list] of Object.entries(SKILLS)) {
      skills[cat] = {};
      list.forEach(s => (skills[cat][s] = 0));
    }

    const wells = {};
    WELLS.forEach(w => (wells[w] = 0));

    return {
      // Identity
      charName:   '',
      playerName: '',
      age:        '',
      race:       '',
      level:      0,
      exp:        0,
      expToNext:  10,
      gpA: '', gpB: '', gpC: '', gpD: '',

      // Point-buy
      attrs,
      skills,
      wells,

      // Resources (max = point-buy; cur = play tracking)
      hpMax:   0, hpCur:   0,
      manMax:  0, manCur:  0,
      stamMax: 0, stamCur: 0,

      // Combat (play tracking — not point-buy)
      ac:         10,
      status:     'Perfect',
      moves:       1,
      attacks:     1,
      usedTurn:    0,
      perTurn:     1,
      injCommon:   0,
      injHarsh:    0,
      injCritical: 0,
      injFatal:    0,
      specialFeature: '',

      // Spells
      spells: [''],

      // Named armor slots
      armor: Object.fromEntries(ARMOR_SLOT_DEFS.map(s => [s.key, { name: '', value: 0 }])),
      tailedRace: false,
    };
  }

  /* ----------------------------------------------------------
     State
  ---------------------------------------------------------- */
  let state        = makeDefault();
  let saveTimer    = null;
  let _activeUser  = null;   // logged-in user
  let _targetUid   = null;   // who we're editing (differs from _activeUser when DM views a player)
  let _targetEmail = null;   // for the DM banner

  /* ----------------------------------------------------------
     Persistence — Firestore primary, localStorage fallback
  ---------------------------------------------------------- */
  function _ref(uid) {
    return window._db.collection('users').doc(uid).collection('sheets').doc('main');
  }

  async function loadState(user) {
    _activeUser = user;

    // DM: check if a player UID is in the URL
    if (window.isDM && user) {
      const params  = new URLSearchParams(window.location.search);
      const urlUid  = params.get('uid');
      if (urlUid && urlUid !== user.uid) {
        _targetUid = urlUid;
        // Fetch player email for the banner
        try {
          const pDoc = await window._db.collection('players').doc(urlUid).get();
          if (pDoc.exists) _targetEmail = pDoc.data().email;
        } catch (_) {}
      }
    }

    const uid = _targetUid || (user ? user.uid : null);

    if (uid && window._db) {
      try {
        const snap = await _ref(uid).get();
        if (snap.exists) {
          state = deepMerge(makeDefault(), snap.data());
          return;
        }
      } catch (e) {
        console.warn('Firestore load failed, falling back to localStorage:', e);
      }
    }

    // Fallback to localStorage (own data only, never a player's)
    if (!_targetUid) {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) state = deepMerge(makeDefault(), JSON.parse(raw));
      } catch (e) {}
    }
  }

  function showDMBanner() {
    if (!_targetUid) return;
    const banner  = document.getElementById('dm-view-banner');
    const nameEl  = document.getElementById('dm-view-player');
    if (banner)  banner.style.display = 'flex';
    if (nameEl)  nameEl.textContent   = _targetEmail || _targetUid;
  }

  function schedSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const plain  = JSON.parse(JSON.stringify(state));
      const uid    = _targetUid || (_activeUser ? _activeUser.uid : null);

      if (uid && window._db) {
        try {
          await _ref(uid).set(plain);
          return;
        } catch (e) {
          console.warn('Firestore save failed, falling back to localStorage:', e);
        }
      }

      // Only cache own data locally
      if (!_targetUid) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(plain));
      }
    }, 800);
  }

  /** Deep-merge source into target (target is the base with all keys) */
  function deepMerge(target, source) {
    const out = { ...target };
    for (const k of Object.keys(source)) {
      if (
        source[k] !== null &&
        typeof source[k] === 'object' &&
        !Array.isArray(source[k]) &&
        typeof target[k] === 'object'
      ) {
        out[k] = deepMerge(target[k], source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  /* ----------------------------------------------------------
     Resource Max Formula:  5 + (pts × 5)
  ---------------------------------------------------------- */
  function calcResourceMax(pts) {
    return 5 + ((pts || 0) * 5);
  }

  /** Refresh the calculated max display and update the current input's max attr */
  function updateResourceCalc(key, pts) {
    const calcMax = calcResourceMax(pts);
    const calcIds = { hpMax: 'cs-hp-calc',   manMax: 'cs-man-calc',  stamMax: 'cs-stam-calc' };
    const curIds  = { hpMax: 'cs-hp-cur',    manMax: 'cs-man-cur',   stamMax: 'cs-stam-cur'  };
    const calcEl = document.getElementById(calcIds[key]);
    const curEl  = document.getElementById(curIds[key]);
    if (calcEl) calcEl.textContent = calcMax;
    if (curEl)  curEl.max = calcMax;
  }

  /* ----------------------------------------------------------
     Status (derived from HP %)
  ---------------------------------------------------------- */
  function calcStatus(cur, max) {
    if (!max || max <= 0) return { label: '—', color: 'var(--text-muted)' };
    const pct = Math.max(0, Math.min(100, (cur / max) * 100));
    return (
      STATUS_LEVELS.find(s => pct >= s.min) ??
      STATUS_LEVELS[STATUS_LEVELS.length - 1]
    );
  }

  function updateStatusBadge() {
    const badge = document.getElementById('cs-status-badge');
    if (!badge) return;
    const { label, color } = calcStatus(state.hpCur, calcResourceMax(state.hpMax));
    badge.textContent       = label;
    badge.style.color       = color;
    badge.style.borderColor = color;
    badge.style.background  = color + '1a'; // 10% opacity tint
  }

  /* ----------------------------------------------------------
     Points Calculation
  ---------------------------------------------------------- */
  function calcUsed() {
    let n = 0;
    for (const v of Object.values(state.attrs)) n += v || 0;
    for (const cat of Object.values(state.skills))
      for (const v of Object.values(cat)) n += v || 0;
    for (const v of Object.values(state.wells)) n += v || 0;
    n += (state.hpMax || 0) + (state.manMax || 0) + (state.stamMax || 0);
    return n;
  }

  function refreshPoints() {
    const used = calcUsed();
    const rem  = TOTAL_POINTS - used;
    const over = used > TOTAL_POINTS;

    const usedEl = document.getElementById('points-used');
    const remEl  = document.getElementById('points-remaining');

    if (usedEl) {
      usedEl.textContent = `${used} / ${TOTAL_POINTS}`;
      usedEl.classList.toggle('over-budget', over);
    }
    if (remEl) {
      remEl.textContent  = over ? `⚠ ${-rem} over budget` : `${rem} left`;
      remEl.style.color  = over ? '#e05050' : 'var(--text-muted)';
    }
  }

  /* ----------------------------------------------------------
     Build Dynamic Sections
  ---------------------------------------------------------- */
  function buildSkills() {
    const cats = [
      { id: 'skills-physical', cat: 'Physical', cls: 'physical' },
      { id: 'skills-social',   cat: 'Social',   cls: 'social'   },
      { id: 'skills-mental',   cat: 'Mental',   cls: 'mental'   },
    ];

    for (const { id, cat, cls } of cats) {
      const container = document.getElementById(id);
      if (!container) continue;
      container.innerHTML = '';

      const title = document.createElement('div');
      title.className   = `cs-skill-category-title ${cls}`;
      title.textContent = cat;
      container.appendChild(title);

      for (const skill of SKILLS[cat]) {
        const val = (state.skills[cat]?.[skill]) ?? 0;
        const row = document.createElement('div');
        row.className = 'cs-skill-row';
        row.innerHTML = `
          <span class="cs-skill-name" title="${skill}">${skill}</span>
          <input type="number" class="cs-num-input"
            min="0" max="10" value="${val}"
            data-type="skill" data-cat="${cat}" data-skill="${skill}" />
          <button class="cs-dice-btn" data-level="${val}"
            title="Roll ${skill} (skill ${val})">🎲</button>
        `;
        container.appendChild(row);
      }
    }
  }

  function buildArmorSlots() {
    const container = document.getElementById('armor-slots');
    if (!container) return;
    container.innerHTML = '';

    const optsHtml = [
      '<option value="">— empty —</option>',
      ...ARMOR_OPTION_GROUPS.map(g => `
        <optgroup label="${g.group}">
          ${g.items.map(item =>
            `<option value="${item.toLowerCase()}">${item}</option>`
          ).join('')}
        </optgroup>
      `),
    ].join('');

    const visibleSlots = ARMOR_SLOT_DEFS.filter(s => !s.tailOnly || state.tailedRace);

    for (const slotDef of visibleSlots) {
      const slot = state.armor[slotDef.key] || { name: '', value: 0 };

      const row = document.createElement('div');
      row.className = 'cs-armor-slot';
      if (slotDef.tailOnly) row.classList.add('cs-armor-slot--tail');
      row.dataset.slotKey = slotDef.key;

      row.innerHTML = `
        <span class="cs-armor-slot-label">${slotDef.label}</span>
        <select class="cs-select cs-armor-name" data-type="armor" data-slot="${slotDef.key}" data-field="name">
          ${optsHtml}
        </select>
        <input type="number" class="cs-num-input cs-armor-value" min="0" value="${slot.value || 0}"
          data-type="armor" data-slot="${slotDef.key}" data-field="value" />
      `;

      // Restore saved selection
      row.querySelector('select').value = slot.name || '';

      container.appendChild(row);
    }
  }

  function buildWells() {
    const container = document.getElementById('wells-grid');
    if (!container) return;
    container.innerHTML = '';

    for (const well of WELLS) {
      const val = state.wells[well] ?? 0;
      const item = document.createElement('div');
      item.className = 'cs-well-item';
      item.innerHTML = `
        <div class="cs-well-label">${well}</div>
        <div class="cs-well-controls">
          <input type="number" class="cs-num-input"
            min="0" max="10" value="${val}"
            data-type="well" data-well="${well}" />
          <button class="cs-dice-btn" data-level="${val}"
            title="Roll ${well} well (skill ${val})">🎲</button>
        </div>
      `;
      container.appendChild(item);
    }
  }

  /* ----------------------------------------------------------
     Render Static Fields from State
  ---------------------------------------------------------- */
  function renderFields() {
    function set(id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    }

    // Identity
    set('cs-char-name',   state.charName);
    set('cs-player-name', state.playerName);
    set('cs-age',         state.age);
    set('cs-race',        state.race);
    set('cs-level',       state.level);
    set('cs-exp',         state.exp);
    set('cs-exp-next',    state.expToNext);
    set('cs-gp-a',        state.gpA);
    set('cs-gp-b',        state.gpB);
    set('cs-gp-c',        state.gpC);
    set('cs-gp-d',        state.gpD);

    // Attributes — also sync dice button
    for (const attr of ATTRIBUTES) {
      const inp = document.querySelector(`[data-type="attr"][data-key="${attr}"]`);
      if (!inp) continue;
      inp.value = state.attrs[attr] ?? 0;
      const btn = inp.nextElementSibling;
      if (btn?.classList.contains('cs-dice-btn')) btn.dataset.level = inp.value;
    }

    // Resources — pts inputs
    set('cs-hp-pts',   state.hpMax);
    set('cs-man-pts',  state.manMax);
    set('cs-stam-pts', state.stamMax);
    // Calculated maxes + current inputs
    updateResourceCalc('hpMax',   state.hpMax);
    updateResourceCalc('manMax',  state.manMax);
    updateResourceCalc('stamMax', state.stamMax);
    set('cs-hp-cur',   state.hpCur);
    set('cs-man-cur',  state.manCur);
    set('cs-stam-cur', state.stamCur);

    // Tailed race checkbox
    const tailedEl = document.getElementById('cs-tailed');
    if (tailedEl) tailedEl.checked = !!state.tailedRace;

    // Combat
    set('cs-moves',       state.moves);
    set('cs-attacks',     state.attacks);
    set('cs-used-turn',   state.usedTurn);
    set('cs-per-turn',    state.perTurn);
    set('cs-inj-common',   state.injCommon);
    set('cs-inj-harsh',    state.injHarsh);
    set('cs-inj-critical', state.injCritical);
    set('cs-inj-fatal',    state.injFatal);
    set('cs-special',     state.specialFeature);

    updateStatusBadge();
  }

  /* ----------------------------------------------------------
     Event Handling (delegation from #main)
  ---------------------------------------------------------- */
  function bindEvents() {
    const main = document.getElementById('main');
    if (!main) return;
    main.addEventListener('input',  handleChange);
    main.addEventListener('change', handleChange);
    main.addEventListener('click',  handleClick);
  }

  function handleChange(e) {
    const el = e.target;
    if (!['INPUT','SELECT','TEXTAREA'].includes(el.tagName)) return;

    const type   = el.dataset.type;
    const rawVal = el.value;
    let   numVal = parseInt(rawVal, 10);
    if (isNaN(numVal)) numVal = 0;

    // Clamp number inputs to their declared min/max
    if (el.type === 'number') {
      const lo = el.min !== '' ? parseInt(el.min, 10) : 0;
      const hi = el.max !== '' ? parseInt(el.max, 10) : Infinity;
      numVal   = Math.max(lo, Math.min(hi, numVal));
      el.value = numVal;
    }

    switch (type) {
      /* ---- Point-buy ---- */
      case 'attr':
        state.attrs[el.dataset.key] = numVal;
        syncDiceBtn(el, numVal);
        if (el.dataset.key === 'Constitution') updateACDisplay();
        break;

      case 'skill':
        if (!state.skills[el.dataset.cat]) state.skills[el.dataset.cat] = {};
        state.skills[el.dataset.cat][el.dataset.skill] = numVal;
        syncDiceBtn(el, numVal);
        break;

      case 'well':
        state.wells[el.dataset.well] = numVal;
        syncDiceBtn(el, numVal);
        break;

      case 'res-max':
        state[el.dataset.key] = numVal;
        updateResourceCalc(el.dataset.key, numVal);
        break;

      /* ---- Play tracking (not point-buy) ---- */
      case 'res-cur':
        state[el.dataset.key] = numVal;
        break;

      case 'combat':
        state[el.dataset.key] = el.type === 'number' ? numVal : rawVal;
        break;

      case 'armor': {
        const slotKey = el.dataset.slot;
        const field   = el.dataset.field;
        if (!state.armor[slotKey]) state.armor[slotKey] = { name: '', value: 0 };
        state.armor[slotKey][field] = field === 'value' ? numVal : rawVal;
        updateACDisplay();
        break;
      }

      case 'tailed':
        state.tailedRace = el.checked;
        buildArmorSlots();   // rebuild to show/hide tail slot
        updateACDisplay();
        break;

      case 'injury':
        state[el.dataset.key] = numVal;
        break;

      case 'identity':
        state[el.dataset.key] = rawVal;
        break;
    }

    schedSave();
    refreshPoints();
    updateStatusBadge();
  }

  /** Update the adjacent dice button's data-level when an input changes */
  function syncDiceBtn(input, level) {
    const btn = input.nextElementSibling;
    if (btn?.classList.contains('cs-dice-btn')) {
      btn.dataset.level = level;
      btn.title = btn.title.replace(/skill \d+/, `skill ${level}`);
    }
  }

  function handleClick(e) {
    const btn = e.target.closest('.cs-dice-btn');
    if (!btn) return;
    const level = parseInt(btn.dataset.level, 10) || 0;
    window.DiceUI?.openWithSkill(level);
  }

  /* ----------------------------------------------------------
     Init — waits for Firebase auth before loading data
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      await loadState(user);
      showDMBanner();
      buildSkills();
      buildWells();
      buildArmorSlots();
      renderFields();
      bindEvents();
      refreshPoints();
      updateACDisplay();
    });
  });

})();
