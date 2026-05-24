/* ============================================================
   Abberanth Companion — Character Sheet Logic
   Handles point-buy tracking, dynamic skill/well rendering,
   autosave to localStorage, and dice roller integration.
   ============================================================ */

(function () {

  const BASE_POINTS = 50;
  const SAVE_KEY    = 'abberanth-char-sheet';

  /* ----------------------------------------------------------
     Grandparent Trait Registry
     Trait types:
       stat_bonus   → single free attribute change (value can be negative)
       multi_stat   → array of { attr, value } changes
       feature      → named ability with use tracking (restType: 'short'|'long')
       passive      → flavour/conditional ability, no use tracking
  ---------------------------------------------------------- */
  const GRANDPARENT_TRAITS = {

    Arachnis: {
      label: 'Arachnis (Arachne)',
      A: {
        type:  'stat_bonus',
        attr:  'Speed',
        value: 1,
      },
      B: {
        type:     'feature',
        name:     'Patient Hunter',
        restType: 'short',
        maxUses:  3,
        desc:     'This species is known for their patience in hunting and then exploding with speed. Three times per short rest, you may choose to stay still for one turn. After the turn of no motion, your speed increases by 10 for a turn.',
      },
      C: {
        type:  'stat_bonus',
        attr:  'Intelligence',
        value: 1,
      },
      D: {
        type:     'feature',
        name:     'Silk',
        restType: 'long',
        maxUses:  3,
        desc:     'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.',
      },
    },

    Arachnei: {
      label: 'Arachnei (Saltici)',
      A: {
        type:  'multi_stat',
        stats: [
          { attr: 'Wisdom',       value: -1 },
          { attr: 'Intelligence', value:  2 },
        ],
      },
      B: {
        type: 'passive',
        name: 'Predatory Leap',
        desc: 'These species are excellent jumpers. When jumping and attacking an enemy, add +1 per meter of jump to the damage.',
      },
      C: {
        type:  'stat_bonus',
        attr:  'Speed',
        value: 1,
      },
      D: {
        type:     'feature',
        name:     'Silk',
        restType: 'long',
        maxUses:  3,
        desc:     'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.',
      },
    },

    Baaphakin: {
      label: 'Baaphakin (Basic)',
      A: {
        type:  'stat_bonus',
        attr:  'Constitution',
        value: 1,
      },
      B: {
        type: 'passive',
        name: 'Headbutt',
        desc: 'When you headbutt a target, add +5 to the rolls and push back the target by as many meters you ran before headbutting.',
      },
      C: {
        type:  'stat_bonus',
        attr:  'Wisdom',
        value: 1,
      },
      D: {
        type: 'passive',
        name: 'Wall Climb',
        desc: 'You can climb surfaces at full speed that are no more than 90 degrees in angle.',
      },
    },

    Corvannis: {
      label: 'Corvannis (Ravann)',
      A: {
        type:  'multi_stat',
        stats: [
          { attr: 'Constitution', value: -1 },
          { attr: 'Intelligence', value:  2 },
        ],
      },
      B: {
        type:     'feature',
        name:     'Echo',
        restType: 'daily',
        maxUses:  3,
        desc:     'When you hear a sound or voice, you can repeat it perfectly for one hour, three times per day.',
      },
      C: {
        type:  'stat_bonus',
        attr:  'Wisdom',
        value: 1,
      },
      D: {
        type: 'passive',
        name: 'Flight',
        desc: 'You can fly at speed.',
      },
    },

  };

  /** Unique key for storing feature uses in state */
  function _featureKey(slot, featureName) {
    return `${slot}:${featureName}`;
  }

  /* ----------------------------------------------------------
     Point & EXP Scaling
  ---------------------------------------------------------- */
  function calcTotalPoints(level) {
    let total = BASE_POINTS;
    const lvl = Math.max(0, Math.min(100, Math.floor(Number(level)) || 0));
    for (let i = 1; i <= lvl; i++) {
      const bracket = Math.floor((i - 1) / 10);
      total += 10 + (bracket * 5);
    }
    return total;
  }

  function expPerLevel(level) {
    if (level < 1 || level > 100) return Infinity;
    const bracket = Math.floor((level - 1) / 10);
    return 10 + (bracket * 5);
  }

  function calcLevelFromExp(exp) {
    let level = 0;
    let cumulative = 0;
    while (level < 100) {
      const needed = expPerLevel(level + 1);
      if (cumulative + needed > exp) break;
      cumulative += needed;
      level++;
    }
    return level;
  }

  function calcExpToNext(exp, level) {
    if (level >= 100) return 0;
    let cumulative = 0;
    for (let i = 1; i <= level + 1; i++) cumulative += expPerLevel(i);
    return cumulative - exp;
  }

  /* ----------------------------------------------------------
     Named body armor slots
     tailOnly → only visible when tailedRace is true
     wingOnly → only visible when wingedRace is true
  ---------------------------------------------------------- */
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
    { key: 'tail',       label: 'Tail',         tailOnly: true },
    { key: 'leftWing',   label: 'Left Wing(s)',  wingOnly: true },
    { key: 'rightWing',  label: 'Right Wing(s)', wingOnly: true },
  ];

  const ARMOR_TYPES = new Set([
    'cloth',
    'hide', 'leather', 'ring mail', 'studded leather',
    'chain shirt', 'scale mail', 'breastplate', 'half plate',
    'chainmail', 'halfplate', 'splint', 'plate',
  ]);

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

  /* ----------------------------------------------------------
     Racial (grandparent) stat bonuses — free, don't cost points
     Handles stat_bonus and multi_stat types.
  ---------------------------------------------------------- */
  function calcRacialBonus(attr) {
    let bonus = 0;
    for (const slot of ['A', 'B', 'C', 'D']) {
      const race  = state.grandparents?.[slot];
      if (!race) continue;
      const trait = GRANDPARENT_TRAITS[race]?.[slot];
      if (!trait) continue;

      if (trait.type === 'stat_bonus' && trait.attr === attr) {
        bonus += trait.value;
      } else if (trait.type === 'multi_stat') {
        for (const s of trait.stats) {
          if (s.attr === attr) bonus += s.value;
        }
      }
    }
    return bonus;
  }

  function calcEffectiveAttr(attr) {
    return (state.attrs[attr] || 0) + calcRacialBonus(attr);
  }

  function calcAC() {
    const con      = calcEffectiveAttr('Constitution');
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
  ---------------------------------------------------------- */
  const STATUS_LEVELS = [
    { min: 100, label: 'Perfect',       color: '#60d8b0' },
    { min: 75,  label: 'Healthy',       color: '#80c8f0' },
    { min: 50,  label: 'Dazed',         color: '#9090f0' },
    { min: 25,  label: 'Injured',       color: '#c078e0' },
    { min: 10,  label: 'Badly Injured', color: '#d050b0' },
    { min: 1,   label: 'Critical',      color: '#e03880' },
    { min: 0,   label: 'Dying',         color: '#c01850' },
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
      charName:   '',
      playerName: '',
      age:        '',
      race:       '',
      level:      0,
      exp:        0,
      expToNext:  10,
      gpA: '', gpB: '', gpC: '', gpD: '',

      attrs,
      skills,
      wells,

      grandparents: { A: '', B: '', C: '', D: '' },
      featureUses:  {},

      hpMax:   0,
      manMax:  0,
      stamMax: 0,
      manaSpent: 0,
      stamSpent: 0,

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

      spells: [''],

      armor: Object.fromEntries(ARMOR_SLOT_DEFS.map(s => [s.key, { name: '', value: 0 }])),
      tailedRace: false,
      wingedRace: false,
    };
  }

  /* ----------------------------------------------------------
     State
  ---------------------------------------------------------- */
  let state        = makeDefault();
  let saveTimer    = null;
  let _activeUser  = null;
  let _targetUid   = null;
  let _targetEmail = null;

  /* ----------------------------------------------------------
     Persistence — Firestore primary, localStorage fallback
  ---------------------------------------------------------- */
  function _ref(uid) {
    return window._db.collection('users').doc(uid).collection('sheets').doc('main');
  }

  async function loadState(user) {
    _activeUser = user;

    if (window.isDM && user) {
      const params = new URLSearchParams(window.location.search);
      const urlUid = params.get('uid');
      if (urlUid && urlUid !== user.uid) {
        _targetUid = urlUid;
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

    if (!_targetUid) {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) state = deepMerge(makeDefault(), JSON.parse(raw));
      } catch (e) {}
    }
  }

  function showDMBanner() {
    if (!_targetUid) return;
    const banner = document.getElementById('dm-view-banner');
    const nameEl = document.getElementById('dm-view-player');
    if (banner) banner.style.display = 'flex';
    if (nameEl) nameEl.textContent   = _targetEmail || _targetUid;
  }

  function schedSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const plain = JSON.parse(JSON.stringify(state));
      const uid   = _targetUid || (_activeUser ? _activeUser.uid : null);

      if (uid && window._db) {
        try {
          await _ref(uid).set(plain);
          return;
        } catch (e) {
          console.warn('Firestore save failed, falling back to localStorage:', e);
        }
      }

      if (!_targetUid) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(plain));
      }
    }, 800);
  }

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
     Resource Max Formula:  5 + (pts x 5)
  ---------------------------------------------------------- */
  function calcResourceMax(pts) {
    return 5 + ((pts || 0) * 5);
  }

  function updateResourceCalc(key, pts) {
    const calcMax = calcResourceMax(pts);
    const calcIds = { hpMax: 'cs-hp-calc', manMax: 'cs-man-calc', stamMax: 'cs-stam-calc' };
    const calcEl  = document.getElementById(calcIds[key]);
    if (calcEl) calcEl.textContent = calcMax;
  }

  /* ----------------------------------------------------------
     Injury damage
     Common = 1 hp | Harsh = 2 hp | Critical = 3 hp | Fatal = 5 hp
  ---------------------------------------------------------- */
  function calcInjuryDamage() {
    return (
      (state.injCommon   || 0) * 1 +
      (state.injHarsh    || 0) * 2 +
      (state.injCritical || 0) * 3 +
      (state.injFatal    || 0) * 5
    );
  }

  /* ----------------------------------------------------------
     Derived current values — never stored, always computed
  ---------------------------------------------------------- */
  function calcHpCur()   { return Math.max(0, calcResourceMax(state.hpMax)   - calcInjuryDamage()); }
  function calcManCur()  { return Math.max(0, calcResourceMax(state.manMax)  - (state.manaSpent || 0)); }
  function calcStamCur() { return Math.max(0, calcResourceMax(state.stamMax) - (state.stamSpent || 0)); }

  function updateResourceDisplays() {
    const hpEl   = document.getElementById('cs-hp-cur');
    const manEl  = document.getElementById('cs-man-cur');
    const stamEl = document.getElementById('cs-stam-cur');

    if (hpEl)   hpEl.textContent   = calcHpCur();
    if (manEl)  manEl.textContent  = calcManCur();
    if (stamEl) stamEl.textContent = calcStamCur();

    updateStatusBadge();
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
    const { label, color } = calcStatus(calcHpCur(), calcResourceMax(state.hpMax));
    badge.textContent       = label;
    badge.style.color       = color;
    badge.style.borderColor = color;
    badge.style.background  = color + '1a';
  }

  /* ----------------------------------------------------------
     Points Calculation — racial bonuses are FREE, not counted
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
    const used  = calcUsed();
    const total = calcTotalPoints(state.level);
    const rem   = total - used;
    const over  = used > total;

    const usedEl = document.getElementById('points-used');
    const remEl  = document.getElementById('points-remaining');

    if (usedEl) {
      usedEl.textContent = `${used} / ${total}`;
      usedEl.classList.toggle('over-budget', over);
    }
    if (remEl) {
      remEl.textContent = over ? `⚠ ${-rem} over budget` : `${rem} left`;
      remEl.style.color = over ? '#e05050' : 'var(--text-muted)';
    }
  }

  /* ----------------------------------------------------------
     Build Dynamic Sections
  ---------------------------------------------------------- */
  function buildGrandparents() {
    const container = document.getElementById('grandparents-section');
    if (!container) return;
    container.innerHTML = '';

    const raceKeys    = Object.keys(GRANDPARENT_TRAITS);
    const raceOptions = ['', ...raceKeys];

    for (const slot of ['A', 'B', 'C', 'D']) {
      const selectedRace = state.grandparents?.[slot] || '';
      const trait        = selectedRace ? GRANDPARENT_TRAITS[selectedRace]?.[slot] : null;

      const block = document.createElement('div');
      block.className    = 'cs-grandparent-block';
      block.dataset.slot = slot;

      // Header: slot label + race dropdown
      const header = document.createElement('div');
      header.className = 'cs-grandparent-header';
      header.innerHTML = `
        <span class="cs-grandparent-label">Grandparent ${slot}</span>
        <select class="cs-select cs-grandparent-select"
          data-type="grandparent" data-slot="${slot}">
          ${raceOptions.map(r =>
            `<option value="${r}" ${r === selectedRace ? 'selected' : ''}>
              ${r ? GRANDPARENT_TRAITS[r].label : '— none —'}
            </option>`
          ).join('')}
        </select>
      `;
      block.appendChild(header);

      // Trait display
      if (trait) {
        const traitEl = document.createElement('div');

        if (trait.type === 'stat_bonus') {
          traitEl.className = 'cs-grandparent-trait cs-trait-bonus';
          traitEl.innerHTML = _renderStatChip(trait.attr, trait.value)
            + `<span class="cs-trait-bonus-note">(racial — free)</span>`;

        } else if (trait.type === 'multi_stat') {
          traitEl.className = 'cs-grandparent-trait cs-trait-bonus';
          traitEl.innerHTML = trait.stats
            .map(s => _renderStatChip(s.attr, s.value))
            .join('<span class="cs-trait-bonus-sep"> · </span>')
            + `<span class="cs-trait-bonus-note">(racial — free)</span>`;

        } else if (trait.type === 'passive') {
          traitEl.className = 'cs-grandparent-trait cs-trait-passive';
          traitEl.innerHTML = `
            <div class="cs-feature-name">
              ${trait.name}
              <span class="cs-feature-rest cs-feature-rest--passive">Passive</span>
            </div>
            <div class="cs-feature-desc">${trait.desc}</div>
          `;

        } else if (trait.type === 'feature') {
          const usesKey   = _featureKey(slot, trait.name);
          const maxUses   = trait.maxUses;
          const remaining = state.featureUses?.[usesKey] ?? maxUses;

          const pips = Array.from({ length: maxUses }, (_, i) =>
            `<span class="cs-use-pip ${i < remaining ? 'cs-use-pip--filled' : 'cs-use-pip--spent'}"></span>`
          ).join('');

          traitEl.className = 'cs-grandparent-trait cs-trait-feature';
          traitEl.innerHTML = `
            <div class="cs-feature-name">
              ${trait.name}
              <span class="cs-feature-rest cs-feature-rest--${trait.restType}">${trait.restType} rest</span>
            </div>
            <div class="cs-feature-desc">${trait.desc}</div>
            <div class="cs-feature-uses">
              <span class="cs-use-pips">${pips}</span>
              <button class="cs-use-btn"
                data-type="use-feature"
                data-slot="${slot}"
                data-feature="${trait.name}"
                data-uses-key="${usesKey}"
                ${remaining <= 0 ? 'disabled' : ''}>
                Use
              </button>
            </div>
          `;
        }

        block.appendChild(traitEl);
      }

      container.appendChild(block);
    }

    updateRacialBonusDisplays();
    updateAttrTotals();
  }

  /** Render a single coloured stat chip: "+2 Intelligence" or "−1 Wisdom" */
  function _renderStatChip(attr, value) {
    const sign  = value >= 0 ? '+' : '−';
    const abs   = Math.abs(value);
    const cls   = value >= 0 ? 'cs-trait-bonus-text' : 'cs-trait-bonus-text cs-trait-bonus-text--penalty';
    return `<span class="${cls}">${sign}${abs} ${attr}</span>`;
  }

  /**
   * Refresh the "= N" total column next to every attribute input.
   * Colour: teal for bonus, red for penalty, muted for no racial modifier.
   */
  function updateAttrTotals() {
    for (const attr of ATTRIBUTES) {
      const el = document.getElementById(`cs-attr-total-${attr}`);
      if (!el) continue;
      const base   = state.attrs[attr] || 0;
      const bonus  = calcRacialBonus(attr);
      const total  = base + bonus;
      el.textContent = total;
      el.classList.remove('cs-attr-total--bonus', 'cs-attr-total--penalty');
      if (bonus > 0) el.classList.add('cs-attr-total--bonus');
      if (bonus < 0) el.classList.add('cs-attr-total--penalty');
    }
  }

  function updateRacialBonusDisplays() {
    for (const attr of ATTRIBUTES) {
      const bonus = calcRacialBonus(attr);
      const id    = `cs-racial-${attr.toLowerCase()}`;
      const el    = document.getElementById(id);
      if (!el) continue;
      if (bonus === 0) {
        el.style.display = 'none';
        el.textContent   = '';
      } else {
        el.textContent   = bonus > 0 ? `+${bonus} racial` : `${bonus} racial`;
        el.style.display = 'inline';
        // Penalty turns the badge red
        el.classList.toggle('cs-racial-bonus--penalty', bonus < 0);
      }
    }
  }

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
            min="0" value="${val}"
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

    const visibleSlots = ARMOR_SLOT_DEFS.filter(s =>
      (!s.tailOnly || state.tailedRace) &&
      (!s.wingOnly || state.wingedRace)
    );

    for (const slotDef of visibleSlots) {
      const slot = state.armor[slotDef.key] || { name: '', value: 0 };

      const row = document.createElement('div');
      row.className = 'cs-armor-slot';
      if (slotDef.tailOnly) row.classList.add('cs-armor-slot--tail');
      if (slotDef.wingOnly) row.classList.add('cs-armor-slot--wing');
      row.dataset.slotKey = slotDef.key;

      row.innerHTML = `
        <span class="cs-armor-slot-label">${slotDef.label}</span>
        <select class="cs-select cs-armor-name"
          data-type="armor" data-slot="${slotDef.key}" data-field="name">
          ${optsHtml}
        </select>
        <input type="number" class="cs-num-input cs-armor-value" min="0" value="${slot.value || 0}"
          data-type="armor" data-slot="${slotDef.key}" data-field="value" />
      `;

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
            min="0" value="${val}"
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

    for (const attr of ATTRIBUTES) {
      const inp = document.querySelector(`[data-type="attr"][data-key="${attr}"]`);
      if (!inp) continue;
      inp.value = state.attrs[attr] ?? 0;
      const btn = inp.nextElementSibling;
      if (btn?.classList.contains('cs-dice-btn')) btn.dataset.level = inp.value;
    }

    set('cs-hp-pts',   state.hpMax);
    set('cs-man-pts',  state.manMax);
    set('cs-stam-pts', state.stamMax);
    updateResourceCalc('hpMax',   state.hpMax);
    updateResourceCalc('manMax',  state.manMax);
    updateResourceCalc('stamMax', state.stamMax);
    updateResourceDisplays();

    const tailedEl = document.getElementById('cs-tailed');
    if (tailedEl) tailedEl.checked = !!state.tailedRace;

    const wingedEl = document.getElementById('cs-winged');
    if (wingedEl) wingedEl.checked = !!state.wingedRace;

    set('cs-moves',        state.moves);
    set('cs-attacks',      state.attacks);
    set('cs-used-turn',    state.usedTurn);
    set('cs-per-turn',     state.perTurn);
    set('cs-inj-common',   state.injCommon);
    set('cs-inj-harsh',    state.injHarsh);
    set('cs-inj-critical', state.injCritical);
    set('cs-inj-fatal',    state.injFatal);
    set('cs-special',      state.specialFeature);

    updateAttrTotals();
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

    if (el.type === 'number') {
      const lo = el.min !== '' ? parseInt(el.min, 10) : 0;
      const hi = el.max !== '' ? parseInt(el.max, 10) : Infinity;
      numVal   = Math.max(lo, Math.min(hi, numVal));
      el.value = numVal;
    }

    switch (type) {
      case 'attr':
        state.attrs[el.dataset.key] = numVal;
        syncDiceBtn(el, numVal);
        updateAttrTotals();
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
        updateResourceDisplays();
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
        buildArmorSlots();
        updateACDisplay();
        break;

      case 'winged':
        state.wingedRace = el.checked;
        buildArmorSlots();
        updateACDisplay();
        break;

      case 'injury':
        state[el.dataset.key] = numVal;
        updateResourceDisplays();
        break;

      case 'grandparent': {
        const slot = el.dataset.slot;
        if (!state.grandparents) state.grandparents = {};
        state.grandparents[slot] = el.value;
        // Seed feature uses to max when a race is first selected
        const trait = el.value ? GRANDPARENT_TRAITS[el.value]?.[slot] : null;
        if (trait?.type === 'feature') {
          const key = _featureKey(slot, trait.name);
          if (state.featureUses[key] === undefined) {
            state.featureUses[key] = trait.maxUses;
          }
        }
        buildGrandparents();
        updateACDisplay();
        break;
      }

      case 'identity':
        state[el.dataset.key] = rawVal;
        if (el.dataset.key === 'exp') {
          const expNum    = Math.max(0, parseInt(rawVal, 10) || 0);
          state.exp       = expNum;
          const newLevel  = calcLevelFromExp(expNum);
          state.level     = newLevel;
          state.expToNext = calcExpToNext(expNum, newLevel);

          const levelEl   = document.getElementById('cs-level');
          const expNextEl = document.getElementById('cs-exp-next');
          if (levelEl)   levelEl.value   = newLevel;
          if (expNextEl) expNextEl.value = state.expToNext;
        }
        break;
    }

    schedSave();
    refreshPoints();
    updateResourceDisplays();
  }

  function syncDiceBtn(input, level) {
    const btn = input.nextElementSibling;
    if (btn?.classList.contains('cs-dice-btn')) {
      btn.dataset.level = level;
      btn.title = btn.title.replace(/skill \d+/, `skill ${level}`);
    }
  }

  function handleClick(e) {
    const useBtn = e.target.closest('[data-type="use-feature"]');
    if (useBtn) {
      const usesKey = useBtn.dataset.usesKey;
      const cur     = state.featureUses?.[usesKey] ?? 0;
      if (cur > 0) {
        if (!state.featureUses) state.featureUses = {};
        state.featureUses[usesKey] = cur - 1;
        buildGrandparents();
        schedSave();
      }
      return;
    }

    const diceBtn = e.target.closest('.cs-dice-btn');
    if (diceBtn) {
      const level = parseInt(diceBtn.dataset.level, 10) || 0;
      window.DiceUI?.openWithSkill(level);
    }
  }

  /* ----------------------------------------------------------
     Public API
     CharSheet.spendMana(cost)
     CharSheet.spendStam(cost)
     CharSheet.restoreAll()
     CharSheet.restoreMana()
     CharSheet.restoreStam()
     CharSheet.shortRest()   — resets short-rest feature uses
     CharSheet.longRest()    — resets all feature uses + mana + stam
  ---------------------------------------------------------- */
  window.CharSheet = {
    spendMana(cost) {
      const max = calcResourceMax(state.manMax);
      state.manaSpent = Math.min(max, (state.manaSpent || 0) + cost);
      updateResourceDisplays();
      schedSave();
    },
    spendStam(cost) {
      const max = calcResourceMax(state.stamMax);
      state.stamSpent = Math.min(max, (state.stamSpent || 0) + cost);
      updateResourceDisplays();
      schedSave();
    },
    restoreAll() {
      state.manaSpent = 0;
      state.stamSpent = 0;
      updateResourceDisplays();
      schedSave();
    },
    restoreMana() {
      state.manaSpent = 0;
      updateResourceDisplays();
      schedSave();
    },
    restoreStam() {
      state.stamSpent = 0;
      updateResourceDisplays();
      schedSave();
    },
    shortRest() {
      for (const slot of ['A', 'B', 'C', 'D']) {
        const race  = state.grandparents?.[slot];
        if (!race) continue;
        const trait = GRANDPARENT_TRAITS[race]?.[slot];
        if (trait?.type === 'feature' && trait.restType === 'short') {
          state.featureUses[_featureKey(slot, trait.name)] = trait.maxUses;
        }
      }
      buildGrandparents();
      schedSave();
    },
    longRest() {
      for (const slot of ['A', 'B', 'C', 'D']) {
        const race  = state.grandparents?.[slot];
        if (!race) continue;
        const trait = GRANDPARENT_TRAITS[race]?.[slot];
        // long rest resets both 'long' and 'daily' features
        if (trait?.type === 'feature' && (trait.restType === 'long' || trait.restType === 'daily')) {
          state.featureUses[_featureKey(slot, trait.name)] = trait.maxUses;
        }
      }
      state.manaSpent = 0;
      state.stamSpent = 0;
      buildGrandparents();
      updateResourceDisplays();
      schedSave();
    },
  };

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
      buildGrandparents();
      renderFields();
      bindEvents();
      refreshPoints();
      updateACDisplay();
    });
  });

})();