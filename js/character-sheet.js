/* ============================================================
   Abberanth Companion — Character Sheet Logic
   ============================================================ */

(function () {

  const BASE_POINTS = 50;
  const SAVE_KEY    = 'abberanth-char-sheet';

  /* ----------------------------------------------------------
     Grandparent Trait Registry
  ---------------------------------------------------------- */
const GRANDPARENT_TRAITS = {
	
	'Arachnis (Ageleni)':{
		
		label: 'Arachnis (Ageleni)',
		
		A: {
			type: 'stat_bonus',
			attr: 'Charisma',
			value: 1
		},
		B: {
			type: 'feature',
			name: 'Trap Artist',
			restType: 'short',
			maxUses: 3,
			desc: 'This species is known for building sit and wait traps. When arming a trap that you will be leaving, activate this to roll +5 more for the setup 3 times per short rest.'
		},
		C: {
			type: 'stat_bonus',
			attr: 'Intelligence',
			value: 1
		},
		D: {
      type: 'feature',
      name: 'Silk',
      restType: 'long',
      maxUses: 3,
      desc: 'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.'
    }
	},

  'Arachnis (Arachne)': {

    label: 'Arachnis (Arachne)',

    A: {
      type: 'stat_bonus',
      attr: 'Speed',
      value: 1
    },

    B: {
      type: 'feature',
      name: 'Patient Hunter',
      restType: 'short',
      maxUses: 3,
      desc: 'This species is known for their patience in hunting and then exploding with speed. Three times per short rest, you may choose to stay still for one turn. After the turn of no motion, your speed increases by 10 for a turn.'
    },

    C: {
      type: 'stat_bonus',
      attr: 'Intelligence',
      value: 1
    },

    D: {
      type: 'feature',
      name: 'Silk',
      restType: 'long',
      maxUses: 3,
      desc: 'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.'
    }

  },
  
  'Arachnis (Lycosi)': {
	  
	  label: 'Arachnis Lycosi',
	  
	  A: {
		  type: 'multi_stat',
		  stats: [
		  {attr: 'Constitution', value: -1 },
			  {attr: 'Speed', value: 2 }
			  ]
	  },
	  B: {
		  type: 'feature',
		  name: 'Hunter`s Grasp',
		  restType: 'short',
		  maxUses: 3,
		  desc: 'These species are excellent at holding their prey. By using this, you may increase your grapple challenge by +5 3 times per short rest.',
	  },
	  C: {
		  type: 'stat_bonus',
		  attr: 'Intelligence',
		  value: 1
	  },
	  D: {
      type: 'feature',
      name: 'Silk',
      restType: 'long',
      maxUses: 3,
      desc: 'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.'
    }
  },
  
  'Arachnis (Mygalomorph)': {
	  
	  label: 'Arachnis (Mygalomorph)',
	  
	  A: {
		  type: 'multi_stat',
		  stats: [
		  {attr: 'Intelligence', value: -1 },
			  {attr: 'Strength', value: 2 },
	  ]
	  },
	  B: {
		  type: 'passive',
		  name: 'Gentle Giant',
		  desc; 'This species is capable of handling things delicately while also being firm. Do not take penalties for being too far over a strength check.'			
	  },
	C: {	
		type: 'stat_bonus',	
		attr: 'Constitution',
		value: 1
	},
	D: {
		 type: 'feature',
      name: 'Silk',
      restType: 'long',
      maxUses: 3,
      desc: 'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.'
    }
  },

  'Arachnis (Saltici)': {

    label: 'Arachnis (Saltici)',

    A: {
      type: 'multi_stat',
      stats: [
        { attr: 'Wisdom', value: -1 },
        { attr: 'Intelligence', value: 2 }
      ]
    },

    B: {
      type: 'passive',
      name: 'Predatory Leap',
      desc: 'These species are excellent jumpers. When jumping and attacking an enemy, add +1 per meter of jump to the damage.'
    },

    C: {
      type: 'stat_bonus',
      attr: 'Speed',
      value: 1
    },

    D: {
      type: 'feature',
      name: 'Silk',
      restType: 'long',
      maxUses: 3,
      desc: 'You can create 50 meters of silk rope and 25 meters of sticky silk rope 3 times per long rest.'
    }

  },

    'Baaphakin (Basic)': {
      label: 'Baaphakin (Basic)',
      A: { type: 'stat_bonus', attr: 'Constitution', value: 1 },
      B: { type: 'passive', name: 'Headbutt',
           desc: 'When you headbutt a target, add +5 to the rolls and push back the target by as many meters you ran before headbutting.' },
      C: { type: 'stat_bonus', attr: 'Wisdom', value: 1 },
      D: { type: 'passive', name: 'Wall Climb',
           desc: 'You can climb surfaces at full speed that are no more than 90 degrees in angle.' },
    },

    'Corvannis (Ravann)': {
      label: 'Corvannis (Ravann)',
      A: { type: 'multi_stat', stats: [{ attr: 'Constitution', value: -1 }, { attr: 'Intelligence', value: 2 }] },
      B: { type: 'feature', name: 'Echo', restType: 'daily', maxUses: 3,
           desc: 'When you hear a sound or voice, you can repeat it perfectly for one hour, three times per day.' },
      C: { type: 'stat_bonus', attr: 'Wisdom', value: 1 },
      D: { type: 'passive', name: 'Flight', desc: 'You can fly at speed.' },
    },

    'Felinataur (Maine Coon)': {
      label: 'Felinataur (Maine Coon)',
      A: { type: 'stat_bonus', attr: 'Willpower', value: 1 },
      B: { type: 'passive', name: 'One with the Forest',
           desc: 'You thrive in the forest. You roll, keep, or add 5 to rolls made in the forest. Nature rolls are auto-won — no roll needed.' },
      C: { type: 'stat_bonus', attr: 'Speed', value: 1 },
      D: { type: 'passive', name: 'Claws',
           desc: 'You have claws and can use them as a Melee attack in addition to Brawl.' },
    },

    Gearkind: {
      label: 'Gearkind',
      A: { type: 'stat_bonus', attr: 'Intelligence', value: 1 },
      B: { type: 'passive', name: 'Sensory Deprivation',
           desc: 'You do not physically feel pain. You do not gain penalties when injured.' },
      C: { type: 'stat_bonus', attr: 'Strength', value: 1 },
      D: { type: 'feature', name: 'Adaptability', restType: 'long', maxUses: 3,
           desc: 'Reroll any skill check. Can be used up to 3 times per long rest.' },
    },

    Human: {
      label: 'Human',
      A: { type: 'multi_stat', stats: [{ attr: 'Strength', value: -1 }, { attr: 'Willpower', value: 2 }] },
      B: { type: 'feature', name: 'Resolve', restType: 'combat', maxUses: 1,
           desc: 'Reroll a failed Willpower check once per combat.' },
      C: { type: 'stat_bonus', attr: 'Constitution', value: 1 },
      D: { type: 'feature', name: 'Adaptability', restType: 'long', maxUses: 3,
           desc: 'Reroll any skill check. Can be used up to 3 times per long rest.' },
    },

    Mimic: {
      label: 'Mimic',
      A: { type: 'stat_bonus', attr: 'Speed', value: 1 },
      B: { type: 'feature', name: 'Abberkin', restType: 'short', maxUses: 1,
           desc: 'This species thrives on survival by tendrils. These tendrils can reach up to 5 meters per 1 Constitution and can be used as extra limbs. Tendrils form once per short rest.' },
      C: { type: 'stat_bonus', attr: 'Intelligence', value: 1 },
      D: { type: 'dual_feature', name: 'Shift',
           maxUsesLong: 3, maxUsesShort: 3,
           desc: 'You can transform into something or someone perfectly (3 times per long rest) or perform an imperfect shift with tells (3 times per short rest). Staying in a shift longer than 24 hours may cause you to develop a shell.' },
    },

Not: {
  label: 'Not',
  A: { type: 'stat_bonus', attr: 'Constitution', value: 1 },
  B: {
    type: 'feature',
    name: 'Abberkin',
    restType: 'short',
    maxUses: 1,
    desc: 'This species thrives on survival by tendrils. These tendrils can reach up to 5 meters per 1 Constitution and can be used as extra limbs. Tendrils form once per short rest.',
  }, // <-- Added comma
  C: { type: 'stat_bonus', attr: 'Intelligence', value: 1 },
  D: {
    type: 'feature',
    name: 'A Little Off',
    restType: 'daily',
    maxUses: 3,
    desc: 'You are a shapeshifter but your form, finalized or otherwise, always has tells — a second mouth, an extra eye — always hidden somewhere. You can shift what bits you can shift 3 times per day.',
  }, // <-- Added comma
},

    Unicorn: {
      label: 'Unicorn',
      A: { type: 'multi_stat', stats: [{ attr: 'Speed', value: 2 }, { attr: 'Wisdom', value: -1 }] },
      B: { type: 'passive', name: 'Stab',
           desc: 'You have a natural stabbing implement rolled with your Weapon (One-Handed) skill with advantage (+1 rolled die).' },
      C: { type: 'stat_bonus', attr: 'Willpower', value: 1 },
      D: { type: 'feature', name: 'Vibe Check', restType: 'daily', maxUses: 3,
           desc: 'Boost your Insight check by +5. Usable 3 times per day.' },
    },

  };

  /* ----------------------------------------------------------
     Spell Registry
     well: null = universal (no well requirement)
     well: { name, minLevel } = requires that many points in that well
  ---------------------------------------------------------- */
  function getSpells() { return window.SPELL_DATA || []; }

  /** Spell slots = floor(manMax / 3) + 1 */
  function calcSpellSlots() {
    return Math.floor((state.manMax || 0) / 3) + 1;
  }

  /** Return spells the player currently qualifies to use */
  function availableSpells() {
    return getSpells().filter(spell => {
      if (!spell.wells || spell.wells.length === 0) return true;
      return spell.wells.every(req => {
        const pts = state.wells?.[req.name] || 0;
        return pts >= req.minLevel;
      });
    });
  }

  /** Human-readable well requirement label */
  function wellsLabel(spell) {
    if (!spell.wells || spell.wells.length === 0) return 'Universal';
    return spell.wells.map(w => `${w.name} ${w.minLevel}+`).join(' + ');
  }

  /** Spells already equipped (by id) */
  function equippedSpells() {
    return (state.spells || []).filter(id => getSpells().find(s => s.id === id));
  }

  function _featureKey(slot, featureName) { return `${slot}:${featureName}`; }

  /* ----------------------------------------------------------
     Point & EXP Scaling
  ---------------------------------------------------------- */
  function calcTotalPoints(level) {
    let total = BASE_POINTS;
    const lvl = Math.max(0, Math.min(100, Math.floor(Number(level)) || 0));
    for (let i = 1; i <= lvl; i++) total += 10 + (Math.floor((i - 1) / 10) * 5);
    return total;
  }

  function expPerLevel(level) {
    if (level < 1 || level > 100) return Infinity;
    return 10 + (Math.floor((level - 1) / 10) * 5);
  }

  function calcLevelFromExp(exp) {
    let level = 0, cumulative = 0;
    while (level < 100) {
      const needed = expPerLevel(level + 1);
      if (cumulative + needed > exp) break;
      cumulative += needed; level++;
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
     Armor slot definitions
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
    'cloth', 'hide', 'leather', 'ring mail', 'studded leather',
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
     Racial bonuses
  ---------------------------------------------------------- */
  function calcRacialBonus(attr) {
    let bonus = 0;
    for (const slot of ['A', 'B', 'C', 'D']) {
      const race  = state.grandparents?.[slot];
      if (!race) continue;
      const trait = GRANDPARENT_TRAITS[race]?.[slot];
      if (!trait) continue;
      if (trait.type === 'stat_bonus' && trait.attr === attr) bonus += trait.value;
      else if (trait.type === 'multi_stat') {
        for (const s of trait.stats) if (s.attr === attr) bonus += s.value;
      }
    }
    return bonus;
  }

  function calcEffectiveAttr(attr) { return (state.attrs[attr] || 0) + calcRacialBonus(attr); }

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

  function updateBattleStats() {
    const moves   = Math.floor(calcEffectiveAttr('Speed')    / 4);
    const attacks = Math.floor(calcEffectiveAttr('Strength') / 4);
    const movesEl   = document.getElementById('cs-moves');
    const attacksEl = document.getElementById('cs-attacks');
    if (movesEl)   movesEl.textContent   = moves;
    if (attacksEl) attacksEl.textContent = attacks;
    // Keep state in sync for saves
    state.moves   = moves;
    state.attacks = attacks;
  }

  /* ----------------------------------------------------------
     Status thresholds
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

  const ATTRIBUTES = ['Strength', 'Speed', 'Constitution', 'Wisdom', 'Intelligence', 'Charisma', 'Willpower'];

  const SKILLS = {
    Physical: ['Acrobatics', 'Archery', 'Athletics', 'Brawl', 'Drive', 'Firearms', 'Melee', 'Stealth', 'Survival', 'Weapon (One-Handed)', 'Weapon (Bastard)', 'Weapon (Two-Handed)'],
    Social:   ['Animal Handling', 'Etiquette', 'Insight', 'Intimidation', 'Leadership', 'Performance', 'Persuasion', 'Religion', 'Streetwise', 'Subterfuge'],
    Mental:   ['Academics', 'Awareness', 'Finance', 'History', 'Investigation', 'Medicine', 'Nature', 'Occult', 'Politics', 'Science', 'Technology'],
  };

  const WELLS = ['Arcane', 'Chaos', 'Day', 'Death', 'Fortitude', 'Life', 'Night', 'Order', 'Time'];

  /* ----------------------------------------------------------
     Default State Factory
  ---------------------------------------------------------- */
  function makeDefault() {
    const attrs = {}; ATTRIBUTES.forEach(a => (attrs[a] = 0));
    const skills = {};
    for (const [cat, list] of Object.entries(SKILLS)) { skills[cat] = {}; list.forEach(s => (skills[cat][s] = 0)); }
    const wells = {}; WELLS.forEach(w => (wells[w] = 0));

    return {
      charName: '', playerName: '', age: '', race: '',
      level: 0, exp: 0, expToNext: 10,
      gpA: '', gpB: '', gpC: '', gpD: '',
      attrs, skills, wells,
      grandparents: { A: '', B: '', C: '', D: '' },
      featureUses: {},
      hpMax: 0, manMax: 0, stamMax: 0,
      manaSpent: 0, stamSpent: 0, willSpent: 0,
      ac: 10, status: 'Perfect',
      moves: 1, attacks: 1, usedTurn: 0, perTurn: 1,
      injCommon: 0, injHarsh: 0, injCritical: 0, injFatal: 0,
      specialFeature: '',
      arcaneVampirism: false,
      spells: [],
      effortSkills: {},   // { 'Acrobatics': true, ... }
      inventory: [],      // [{ id, name, qty, notes }, ...]
      armor: Object.fromEntries(ARMOR_SLOT_DEFS.map(s => [s.key, { name: '', value: 0 }])),
      tailedRace: false, wingedRace: false,
      portrait: '',
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
  let _charId      = null;   // current character document ID — null until first explicit save
  let _npcId       = null;   // set when sheet is opened in NPC mode (?npc=id)

  /* ----------------------------------------------------------
     Firestore reference helpers
  ---------------------------------------------------------- */
  function _sheetsCol(uid) {
    return window._db.collection('users').doc(uid).collection('sheets');
  }

  function _ref(uid, id) {
    return _sheetsCol(uid).doc(id);
  }

  function _npcRef(npcId) {
    return window._db.collection('npc-sheets').doc(npcId);
  }

  /** Generate a URL-safe ID from character name + random suffix */
  function _makeCharId(name) {
    const slug = (name || 'character')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'character';
    const rand = Math.random().toString(36).slice(2, 6);
    return `${slug}-${rand}`;
  }

  function _updateURL(charId) {
    const url = new URL(window.location);
    url.searchParams.set('char', charId);
    url.searchParams.delete('new');
    history.replaceState(null, '', url);
  }

  /* ----------------------------------------------------------
     Load State
  ---------------------------------------------------------- */
  async function loadState(user) {
    _activeUser = user;
    const params = new URLSearchParams(window.location.search);

    // NPC mode — DM opening a sheet for an NPC
    const npcParam = params.get('npc');
    if (npcParam && window.isDM) {
      _npcId = npcParam;
      try {
        const snap = await _npcRef(npcParam).get();
        if (snap.exists) state = deepMerge(makeDefault(), snap.data());
        // else blank sheet — saves on first explicit save
      } catch (e) { console.warn('NPC sheet load failed:', e); }
      return;
    }

    // DM: check if viewing a specific player
    if (window.isDM && user) {
      const urlUid = params.get('uid');
      if (urlUid && urlUid !== user.uid) {
        _targetUid = urlUid;
        try {
          const pDoc = await window._db.collection('players').doc(urlUid).get();
          if (pDoc.exists) _targetEmail = pDoc.data().email;
        } catch (_) {}
      }
    }

    const uid       = _targetUid || (user ? user.uid : null);
    const charParam = params.get('char');
    const isNew     = params.get('new') === '1';

    if (uid && window._db) {
      try {
        if (charParam) {
          // Load specific character by ID
          const snap = await _ref(uid, charParam).get();
          if (snap.exists) {
            _charId = charParam;
            state   = deepMerge(makeDefault(), snap.data());
            return;
          }
          // ID not found — fall through to fresh sheet
        } else if (!isNew) {
          // Load the most recently saved character for this user
          const snap = await _sheetsCol(uid)
            .orderBy('savedAt', 'desc')
            .limit(1)
            .get();
          if (!snap.empty) {
            _charId = snap.docs[0].id;
            state   = deepMerge(makeDefault(), snap.docs[0].data());
            _updateURL(_charId);
            return;
          }
        }
        // Fresh sheet (no saves found, ?new=1, or unknown charParam)
      } catch (e) {
        console.warn('Firestore load failed, falling back to localStorage:', e);
      }
    }

    // localStorage fallback (own data only, no DM, no specific char)
    if (!_targetUid && !charParam) {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) state = deepMerge(makeDefault(), JSON.parse(raw));
      } catch (e) {}
    }
  }

  function showDMBanner() {
    const banner = document.getElementById('dm-view-banner');
    const nameEl = document.getElementById('dm-view-player');
    if (!banner) return;

    if (_npcId) {
      // NPC sheet mode
      banner.style.display = 'flex';
      if (nameEl) nameEl.textContent = `NPC Sheet — ${state.charName || _npcId}`;
      return;
    }

    if (!_targetUid) return;
    banner.style.display = 'flex';
    if (nameEl) nameEl.textContent = _targetEmail || _targetUid;
  }

  /* ----------------------------------------------------------
     Auto-save (debounced) — only fires after first explicit save
  ---------------------------------------------------------- */
  function schedSave() {
    if (_npcId) {
      // NPC mode — always auto-save since there's no charId gating
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try { await _npcRef(_npcId).set(JSON.parse(JSON.stringify(state))); }
        catch (e) { console.warn('NPC auto-save failed:', e); }
      }, 800);
      return;
    }
    if (!_charId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const plain = JSON.parse(JSON.stringify(state));
      const uid   = _targetUid || (_activeUser ? _activeUser.uid : null);
      if (uid && window._db) {
        try { await _ref(uid, _charId).set(plain); return; }
        catch (e) { console.warn('Auto-save failed:', e); }
      }
      if (!_targetUid) localStorage.setItem(SAVE_KEY, JSON.stringify(plain));
    }, 800);
  }

  /* ----------------------------------------------------------
     Manual Save — creates new charId if needed, writes summary
  ---------------------------------------------------------- */
  async function saveNow() {
    const btn = document.getElementById('cs-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    const plain   = JSON.parse(JSON.stringify(state));
    plain.savedAt = firebase.firestore.FieldValue.serverTimestamp();

    // NPC mode — save to npc-sheets/{npcId}
    if (_npcId) {
      try {
        await _npcRef(_npcId).set(plain);
        // Also update the NPC name in the npcs collection for the banner
        await window._db.collection('npcs').doc(_npcId).update({
          'dmSheet.charName': state.charName || '',
        }).catch(() => {});
        if (btn) {
          btn.textContent = 'Saved ✓'; btn.style.background = 'var(--accent-teal)';
          setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; btn.disabled = false; }, 2000);
        }
      } catch (e) {
        console.error('NPC sheet save failed:', e);
        if (btn) {
          btn.textContent = 'Save Failed'; btn.style.background = '#c02850';
          setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; btn.disabled = false; }, 2500);
        }
      }
      return;
    }

    // Normal character save
    if (!_charId) {
      _charId = _makeCharId(state.charName);
      _updateURL(_charId);
    }

    const uid = _targetUid || (_activeUser ? _activeUser.uid : null);

    try {
      if (uid && window._db) {
        await _ref(uid, _charId).set(plain);
        await window._db.collection('players').doc(uid).set({
          charName:  state.charName || '',
          race:      state.race     || '',
          level:     state.level    || 0,
          lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else if (!_targetUid) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(plain));
      }
      if (btn) {
        btn.textContent = 'Saved ✓'; btn.style.background = 'var(--accent-teal)';
        setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; btn.disabled = false; }, 2000);
      }
    } catch (e) {
      console.error('Save failed:', e);
      if (btn) {
        btn.textContent = 'Save Failed'; btn.style.background = '#c02850';
        setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; btn.disabled = false; }, 2500);
      }
    }
  }

  function deepMerge(target, source) {
    const out = { ...target };
    for (const k of Object.keys(source)) {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k]) && typeof target[k] === 'object') {
        out[k] = deepMerge(target[k], source[k]);
      } else { out[k] = source[k]; }
    }
    return out;
  }

  /* ----------------------------------------------------------
     Resource calculations
  ---------------------------------------------------------- */
  function calcResourceMax(pts)     { return 5 + ((pts || 0) * 5); }
  function calcInjuryDamage()       { return (state.injCommon||0)*1 + (state.injHarsh||0)*2 + (state.injCritical||0)*3 + (state.injFatal||0)*4; }

  /* Arcane Vampirism: HP pts + Mana pts merge into one combined Mana pool */
  function calcArcaneManaMax()      { return calcResourceMax(state.hpMax) + calcResourceMax(state.manMax); }

  function calcHpCur() {
    if (state.arcaneVampirism) {
      /* Combined pool — injuries AND mana spend drain the same pool */
      return Math.max(0, calcArcaneManaMax() - calcInjuryDamage() - (state.manaSpent||0));
    }
    return Math.max(0, calcResourceMax(state.hpMax) - calcInjuryDamage());
  }

  function calcManCur() {
    if (state.arcaneVampirism) return calcHpCur();   /* same pool as HP */
    return Math.max(0, calcResourceMax(state.manMax) - (state.manaSpent||0));
  }
  function calcStamCur()            { return Math.max(0, calcResourceMax(state.stamMax) - (state.stamSpent||0)); }
  function calcWillCur()            { return (state.attrs?.Willpower || 0) + calcRacialBonus('Willpower') - (state.willSpent||0); }

  function updateResourceCalc(key, pts) {
    if (state.arcaneVampirism && (key === 'hpMax' || key === 'manMax')) {
      /* Both HP and Mana show the combined Arcane pool max */
      const combined = calcArcaneManaMax();
      const hpEl  = document.getElementById('cs-hp-calc');
      const manEl = document.getElementById('cs-man-calc');
      if (hpEl)  hpEl.textContent  = combined;
      if (manEl) manEl.textContent = combined;
      return;
    }
    const calcIds = { hpMax: 'cs-hp-calc', manMax: 'cs-man-calc', stamMax: 'cs-stam-calc' };
    const el = document.getElementById(calcIds[key]);
    if (el) el.textContent = calcResourceMax(pts);
  }

  function updateResourceDisplays() {
    const hpEl   = document.getElementById('cs-hp-cur');
    const manEl  = document.getElementById('cs-man-cur');
    const stamEl = document.getElementById('cs-stam-cur');
    const willEl = document.getElementById('cs-will-cur');
    if (hpEl)   hpEl.textContent   = calcHpCur();
    if (manEl)  manEl.textContent  = calcManCur();
    if (stamEl) stamEl.textContent = calcStamCur();
    if (willEl) willEl.textContent = calcWillCur();

    /* Sync Arcane Vampirism combined pool max displays */
    if (state.arcaneVampirism) {
      updateResourceCalc('hpMax',  state.hpMax);
      updateResourceCalc('manMax', state.manMax);
    }

    /* Show / hide AV indicator + hit button */
    const avRow = document.getElementById('av-active-row');
    if (avRow) avRow.style.display = state.arcaneVampirism ? 'flex' : 'none';

    /* Visual tint on HP/Mana labels when AV is active */
    const hpLabel  = document.getElementById('cs-hp-label');
    const manLabel = document.getElementById('cs-man-label');
    if (hpLabel)  hpLabel.classList.toggle('av-active', !!state.arcaneVampirism);
    if (manLabel) manLabel.classList.toggle('av-active', !!state.arcaneVampirism);

    updateStatusBadge();
  }

  function calcStatus(cur, max) {
    if (!max || max <= 0) return { label: '—', color: 'var(--text-muted)' };
    const pct = Math.max(0, Math.min(100, (cur / max) * 100));
    return STATUS_LEVELS.find(s => pct >= s.min) ?? STATUS_LEVELS[STATUS_LEVELS.length - 1];
  }

  function updateStatusBadge() {
    const badge = document.getElementById('cs-status-badge');
    if (!badge) return;
    const hpMax = state.arcaneVampirism ? calcArcaneManaMax() : calcResourceMax(state.hpMax);
    const { label, color } = calcStatus(calcHpCur(), hpMax);
    badge.textContent       = label;
    badge.style.color       = color;
    badge.style.borderColor = color;
    badge.style.background  = color + '1a';
  }

  /* ----------------------------------------------------------
     Points
  ---------------------------------------------------------- */
  function calcUsed() {
    let n = 0;
    for (const v of Object.values(state.attrs)) n += v || 0;
    for (const cat of Object.values(state.skills)) for (const v of Object.values(cat)) n += v || 0;
    for (const v of Object.values(state.wells)) n += v || 0;
    n += (state.hpMax||0) + (state.manMax||0) + (state.stamMax||0);
    return n;
  }

  function refreshPoints() {
    const used  = calcUsed();
    const total = calcTotalPoints(state.level);
    const rem   = total - used;
    const over  = used > total;
    const usedEl = document.getElementById('points-used');
    const remEl  = document.getElementById('points-remaining');
    if (usedEl) { usedEl.textContent = `${used} / ${total}`; usedEl.classList.toggle('over-budget', over); }
    if (remEl)  { remEl.textContent = over ? `⚠ ${-rem} over budget` : `${rem} left`; remEl.style.color = over ? '#e05050' : 'var(--text-muted)'; }
  }

  /* ----------------------------------------------------------
     Attr totals
  ---------------------------------------------------------- */
  function updateAttrTotals() {
    for (const attr of ATTRIBUTES) {
      const el = document.getElementById(`cs-attr-total-${attr}`);
      if (!el) continue;
      const total = (state.attrs[attr] || 0) + calcRacialBonus(attr);
      el.textContent = total;
      el.classList.remove('cs-attr-total--bonus', 'cs-attr-total--penalty');
      if (calcRacialBonus(attr) > 0) el.classList.add('cs-attr-total--bonus');
      if (calcRacialBonus(attr) < 0) el.classList.add('cs-attr-total--penalty');
    }
  }

  function updateRacialBonusDisplays() {
    for (const attr of ATTRIBUTES) {
      const bonus = calcRacialBonus(attr);
      const el    = document.getElementById(`cs-racial-${attr.toLowerCase()}`);
      if (!el) continue;
      if (bonus === 0) { el.style.display = 'none'; el.textContent = ''; }
      else { el.textContent = bonus > 0 ? `+${bonus} racial` : `${bonus} racial`; el.style.display = 'inline'; el.classList.toggle('cs-racial-bonus--penalty', bonus < 0); }
    }
  }

  /* ----------------------------------------------------------
     Build dynamic sections
  ---------------------------------------------------------- */
  function buildGrandparents() {
    const container = document.getElementById('grandparents-section');
    if (!container) return;
    container.innerHTML = '';

    const raceOptions = ['', ...Object.keys(GRANDPARENT_TRAITS)];

    for (const slot of ['A', 'B', 'C', 'D']) {
      const selectedRace = state.grandparents?.[slot] || '';
      const trait        = selectedRace ? GRANDPARENT_TRAITS[selectedRace]?.[slot] : null;

      const block = document.createElement('div');
      block.className    = 'cs-grandparent-block';
      block.dataset.slot = slot;

      const header = document.createElement('div');
      header.className = 'cs-grandparent-header';
      header.innerHTML = `
        <span class="cs-grandparent-label">Grandparent ${slot}</span>
        <select class="cs-select cs-grandparent-select" data-type="grandparent" data-slot="${slot}">
          ${raceOptions.map(r => `<option value="${r}" ${r === selectedRace ? 'selected' : ''}>${r ? GRANDPARENT_TRAITS[r].label : '— none —'}</option>`).join('')}
        </select>
      `;
      block.appendChild(header);

      if (trait) {
        const traitEl = document.createElement('div');

        if (trait.type === 'stat_bonus') {
          traitEl.className = 'cs-grandparent-trait cs-trait-bonus';
          traitEl.innerHTML = _renderStatChip(trait.attr, trait.value) + `<span class="cs-trait-bonus-note">(racial — free)</span>`;

        } else if (trait.type === 'multi_stat') {
          traitEl.className = 'cs-grandparent-trait cs-trait-bonus';
          traitEl.innerHTML = trait.stats.map(s => _renderStatChip(s.attr, s.value)).join('<span class="cs-trait-bonus-sep"> · </span>')
            + `<span class="cs-trait-bonus-note">(racial — free)</span>`;

        } else if (trait.type === 'passive') {
          traitEl.className = 'cs-grandparent-trait cs-trait-passive';
          traitEl.innerHTML = `
            <div class="cs-feature-name">${trait.name}<span class="cs-feature-rest cs-feature-rest--passive">Passive</span></div>
            <div class="cs-feature-desc">${trait.desc}</div>
          `;

        } else if (trait.type === 'feature') {
          const usesKey   = _featureKey(slot, trait.name);
          const remaining = state.featureUses?.[usesKey] ?? trait.maxUses;
          const pips      = Array.from({ length: trait.maxUses }, (_, i) =>
            `<span class="cs-use-pip ${i < remaining ? 'cs-use-pip--filled' : 'cs-use-pip--spent'}"></span>`
          ).join('');

          traitEl.className = 'cs-grandparent-trait cs-trait-feature';
          traitEl.innerHTML = `
            <div class="cs-feature-name">${trait.name}<span class="cs-feature-rest cs-feature-rest--${trait.restType}">${trait.restType}</span></div>
            <div class="cs-feature-desc">${trait.desc}</div>
            <div class="cs-feature-uses">
              <span class="cs-use-pips">${pips}</span>
              <button class="cs-use-btn" data-type="use-feature" data-slot="${slot}" data-feature="${trait.name}" data-uses-key="${usesKey}" ${remaining <= 0 ? 'disabled' : ''}>Use</button>
            </div>
          `;

        } else if (trait.type === 'dual_feature') {
          // Two independent use pools — one long rest, one short rest
          const keyA = _featureKey(slot, trait.name + ':long');
          const keyB = _featureKey(slot, trait.name + ':short');
          const remA = state.featureUses?.[keyA] ?? trait.maxUsesLong;
          const remB = state.featureUses?.[keyB] ?? trait.maxUsesShort;

          const pipsA = Array.from({ length: trait.maxUsesLong }, (_, i) =>
            `<span class="cs-use-pip ${i < remA ? 'cs-use-pip--filled' : 'cs-use-pip--spent'}"></span>`
          ).join('');
          const pipsB = Array.from({ length: trait.maxUsesShort }, (_, i) =>
            `<span class="cs-use-pip cs-use-pip--short ${i < remB ? 'cs-use-pip--filled' : 'cs-use-pip--spent'}"></span>`
          ).join('');

          traitEl.className = 'cs-grandparent-trait cs-trait-feature';
          traitEl.innerHTML = `
            <div class="cs-feature-name">${trait.name}</div>
            <div class="cs-feature-desc">${trait.desc}</div>
            <div class="cs-feature-uses" style="margin-bottom:0.3rem;">
              <span class="cs-feature-rest cs-feature-rest--long" style="margin-right:0.4rem;">long rest</span>
              <span class="cs-use-pips">${pipsA}</span>
              <button class="cs-use-btn" data-type="use-feature" data-slot="${slot}" data-feature="${trait.name}:long" data-uses-key="${keyA}" ${remA <= 0 ? 'disabled' : ''}>Use</button>
            </div>
            <div class="cs-feature-uses">
              <span class="cs-feature-rest cs-feature-rest--short" style="margin-right:0.4rem;">short rest</span>
              <span class="cs-use-pips">${pipsB}</span>
              <button class="cs-use-btn" data-type="use-feature" data-slot="${slot}" data-feature="${trait.name}:short" data-uses-key="${keyB}" ${remB <= 0 ? 'disabled' : ''}>Use</button>
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

  function _renderStatChip(attr, value) {
    const sign = value >= 0 ? '+' : '−';
    const cls  = value >= 0 ? 'cs-trait-bonus-text' : 'cs-trait-bonus-text cs-trait-bonus-text--penalty';
    return `<span class="${cls}">${sign}${Math.abs(value)} ${attr}</span>`;
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
      title.className = `cs-skill-category-title ${cls}`;
      title.textContent = cat;
      container.appendChild(title);

      const isPhysical = cat === 'Physical';

      for (const skill of SKILLS[cat]) {
        const val    = (state.skills[cat]?.[skill]) ?? 0;
        const effort = isPhysical && !!(state.effortSkills?.[skill]);
        const row    = document.createElement('div');
        row.className = 'cs-skill-row';
        row.innerHTML = `
          <span class="cs-skill-name" title="${skill}">${skill}</span>
          <input type="number" class="cs-num-input" value="${val}"
            data-type="skill" data-cat="${cat}" data-skill="${skill}" />
          ${isPhysical ? `
            <label class="cs-effort-label" title="Effort: adds +⌈STR/2⌉ to roll, costs 1 stamina">
              <input type="checkbox" class="cs-effort-cb" data-skill="${skill}" ${effort ? 'checked' : ''} />
              <span class="cs-effort-tag">Effort</span>
            </label>
          ` : ''}
          <button class="cs-dice-btn ${effort ? 'cs-dice-btn--effort' : ''}"
            data-level="${val}"
            data-skill="${isPhysical ? skill : ''}"
            data-physical="${isPhysical}"
            title="Roll ${skill} (skill ${val})${effort ? ' + Effort' : ''}">🎲</button>
        `;
        container.appendChild(row);

        // Effort checkbox handler
        if (isPhysical) {
          const cb = row.querySelector('.cs-effort-cb');
          cb.addEventListener('change', () => {
            if (!state.effortSkills) state.effortSkills = {};
            state.effortSkills[skill] = cb.checked;
            // Update dice button style
            const btn = row.querySelector('.cs-dice-btn');
            btn.classList.toggle('cs-dice-btn--effort', cb.checked);
            btn.title = `Roll ${skill} (skill ${val})${cb.checked ? ' + Effort' : ''}`;
            schedSave();
          });
        }
      }
    }
  }

  /* ----------------------------------------------------------
     Spells
  ---------------------------------------------------------- */
  let _spellPickerSlot = null;   // which slot index is being filled

  function buildSpells() {
    const container  = document.getElementById('cs-equipped-spells');
    const noteEl     = document.getElementById('cs-spell-slot-note');
    const addBtn     = document.getElementById('cs-spell-add-btn');
    if (!container) return;

    const slots    = calcSpellSlots();
    const equipped = equippedSpells();

    if (noteEl) noteEl.textContent = `— ${equipped.length} / ${slots} slots`;

    container.innerHTML = '';

    // Render one row per slot
    for (let i = 0; i < slots; i++) {
      const spellId = equipped[i] || null;
      const spell   = spellId ? getSpells().find(s => s.id === spellId) : null;

      const row = document.createElement('div');
      row.className = 'cs-spell-slot' + (spell ? ' filled' : '');

      if (spell) {
        const costLabel = `${spell.cost} mana`;
        const wellLabel = wellsLabel(spell);
        row.innerHTML = `
          <div class="cs-spell-info">
            <div class="cs-spell-name">${spell.name}</div>
            <div class="cs-spell-meta">
              <span class="cs-spell-tag">${costLabel}</span>
              <span class="cs-spell-tag cs-spell-tag--well">${wellLabel}</span>
            </div>
            <div class="cs-spell-desc">${spell.desc.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="cs-spell-actions">
            <button class="cs-spell-use-btn" data-spell-id="${spell.id}" data-slot="${i}">Cast</button>
            <button class="cs-spell-unequip-btn" data-slot="${i}">✕</button>
          </div>
        `;

        row.querySelector('.cs-spell-use-btn').addEventListener('click', () => castSpell(spell));
        row.querySelector('.cs-spell-unequip-btn').addEventListener('click', () => unequipSpell(i));

      } else {
        row.innerHTML = `
          <span class="cs-spell-name" style="font-style:italic;color:var(--text-muted);">Empty slot</span>
          <button class="cs-spell-equip-btn" data-slot="${i}">＋ Equip</button>
        `;
        row.querySelector('.cs-spell-equip-btn').addEventListener('click', () => openSpellPicker(i));
      }

      container.appendChild(row);
    }

    // Show add button only when all slots filled (shouldn't happen but safety)
    if (addBtn) addBtn.style.display = 'none';
  }

  let _castingSpell = null;

  function castSpell(spell) {
    _castingSpell = spell;
    const modal      = document.getElementById('cs-cast-modal');
    const nameEl     = document.getElementById('cs-cast-name');
    const descEl     = document.getElementById('cs-cast-desc');
    const scalingRow = document.getElementById('cs-cast-scaling-row');
    const scalingEl  = document.getElementById('cs-cast-scaling');
    const baseCostEl = document.getElementById('cs-cast-base-cost');
    const extraEl    = document.getElementById('cs-cast-extra');
    const totalEl    = document.getElementById('cs-cast-total');
    const manaEl     = document.getElementById('cs-cast-mana-cur');
    const confirmBtn = document.getElementById('cs-cast-confirm');

    nameEl.textContent    = spell.name;
    descEl.innerHTML      = spell.desc.replace(/\n/g, '<br>');
    baseCostEl.textContent = spell.cost;
    extraEl.value         = 0;
    manaEl.textContent    = calcManCur();

    if (spell.scaling) {
      scalingRow.style.display = 'flex';
      scalingEl.textContent    = spell.scaling;
    } else {
      scalingRow.style.display = 'none';
    }

    _updateCastTotal();
    modal.style.display = 'flex';
  }

  function _updateCastTotal() {
    if (!_castingSpell) return;
    const extra    = Math.max(0, parseInt(document.getElementById('cs-cast-extra').value, 10) || 0);
    const total    = _castingSpell.cost + extra;
    const manaCur  = calcManCur();
    const totalEl  = document.getElementById('cs-cast-total');
    const confirmBtn = document.getElementById('cs-cast-confirm');

    totalEl.textContent  = total;
    totalEl.style.color  = total > manaCur ? '#c02850' : 'var(--accent-gold)';
    confirmBtn.disabled  = total > manaCur;
    confirmBtn.title     = total > manaCur ? 'Not enough mana' : '';
  }

  function closeCastModal() {
    document.getElementById('cs-cast-modal').style.display = 'none';
    _castingSpell = null;
  }

  function confirmCast() {
    if (!_castingSpell) return;
    const extra = Math.max(0, parseInt(document.getElementById('cs-cast-extra').value, 10) || 0);
    const total = _castingSpell.cost + extra;
    CharSheet_spendMana(total);
    closeCastModal();
  }

  function unequipSpell(slotIdx) {
    const equipped = equippedSpells();
    equipped.splice(slotIdx, 1);
    state.spells = equipped;
    buildSpells();
    schedSave();
  }

  function openSpellPicker(slotIdx) {
    _spellPickerSlot = slotIdx;
    const list    = document.getElementById('spell-picker-list');
    const modal   = document.getElementById('spell-picker-modal');
    const equipped = equippedSpells();
    const available = availableSpells();

    list.innerHTML = '';

    if (available.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No spells available. Invest points in magical wells to unlock more.</p>';
    } else {
      available.forEach(spell => {
        const alreadyEquipped = equipped.includes(spell.id);
        const wellLabel = wellsLabel(spell);
        const row = document.createElement('div');
        row.style.cssText = `
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          margin-bottom: 0.5rem;
          background: var(--bg-surface);
          opacity: ${alreadyEquipped ? '0.4' : '1'};
          cursor: ${alreadyEquipped ? 'not-allowed' : 'pointer'};
          transition: all 0.18s ease;
        `;
        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">
            <span style="font-weight:700;font-size:0.88rem;color:var(--text-primary);">${spell.name}</span>
            <span style="font-size:0.62rem;background:rgba(102,80,216,0.15);border:1px solid rgba(102,80,216,0.3);border-radius:99px;padding:0.1rem 0.45rem;color:#a090f0;">${spell.cost} mana</span>
            <span style="font-size:0.62rem;background:rgba(88,152,232,0.12);border:1px solid rgba(88,152,232,0.3);border-radius:99px;padding:0.1rem 0.45rem;color:var(--accent-teal);">${wellLabel}</span>
            ${alreadyEquipped ? '<span style="font-size:0.62rem;color:var(--text-muted);margin-left:auto;">Already equipped</span>' : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.4;">${spell.desc.replace(/\n/g, '<br>')}</div>
        `;

        if (!alreadyEquipped) {
          row.addEventListener('mouseenter', () => row.style.borderColor = 'var(--accent-purple)');
          row.addEventListener('mouseleave', () => row.style.borderColor = 'var(--border)');
          row.addEventListener('click', () => equipSpell(spell.id));
        }
        list.appendChild(row);
      });
    }

    modal.style.display = 'flex';
  }

  function equipSpell(spellId) {
    const equipped = equippedSpells();
    const slots    = calcSpellSlots();
    if (_spellPickerSlot === null || _spellPickerSlot >= slots) return;

    // Place into the correct slot, padding with nulls if needed
    const arr = [...equipped];
    while (arr.length <= _spellPickerSlot) arr.push(null);
    arr[_spellPickerSlot] = spellId;

    state.spells = arr.filter(Boolean);
    closeSpellPicker();
    buildSpells();
    schedSave();
  }

  function closeSpellPicker() {
    document.getElementById('spell-picker-modal').style.display = 'none';
    _spellPickerSlot = null;
  }

  // Internal reference so castSpell can call spendMana before CharSheet is exposed
  function CharSheet_spendMana(cost) {
    const max = calcResourceMax(state.manMax);
    state.manaSpent = Math.min(max, (state.manaSpent || 0) + cost);
    updateResourceDisplays();
    schedSave();
  }

  /* ----------------------------------------------------------
     Inventory
  ---------------------------------------------------------- */
  function buildInventory() {
    const container = document.getElementById('cs-inventory-list');
    if (!container) return;
    container.innerHTML = '';

    const items = state.inventory || [];
    if (items.length === 0) {
      container.innerHTML = '<p class="cs-inventory-empty">No items. Add one below.</p>';
    } else {
      items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'cs-inv-row';
        row.innerHTML = `
          <input class="cs-inv-name" type="text" placeholder="Item name"
            value="${escHtml(item.name || '')}" data-inv-idx="${idx}" data-inv-field="name" />
          <div class="cs-inv-qty-wrap">
            <button class="cs-inv-qty-btn" data-inv-idx="${idx}" data-inv-action="dec">−</button>
            <span class="cs-inv-qty">${item.qty ?? 1}</span>
            <button class="cs-inv-qty-btn" data-inv-idx="${idx}" data-inv-action="inc">＋</button>
          </div>
          <input class="cs-inv-notes" type="text" placeholder="Notes"
            value="${escHtml(item.notes || '')}" data-inv-idx="${idx}" data-inv-field="notes" />
          <button class="cs-inv-remove-btn" data-inv-idx="${idx}" title="Remove item">✕</button>
        `;

        // Name / notes change
        row.querySelectorAll('[data-inv-field]').forEach(inp => {
          inp.addEventListener('input', () => {
            const i = parseInt(inp.dataset.invIdx, 10);
            state.inventory[i][inp.dataset.invField] = inp.value;
            schedSave();
          });
        });

        // Qty buttons
        row.querySelectorAll('.cs-inv-qty-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const i      = parseInt(btn.dataset.invIdx, 10);
            const action = btn.dataset.invAction;
            const cur    = state.inventory[i].qty ?? 1;
            state.inventory[i].qty = Math.max(0, action === 'inc' ? cur + 1 : cur - 1);
            buildInventory();
            schedSave();
          });
        });

        // Remove
        row.querySelector('.cs-inv-remove-btn').addEventListener('click', () => {
          const i = parseInt(row.querySelector('.cs-inv-remove-btn').dataset.invIdx, 10);
          state.inventory.splice(i, 1);
          buildInventory();
          schedSave();
        });

        container.appendChild(row);
      });
    }
  }

  function addInventoryItem() {
    if (!state.inventory) state.inventory = [];
    state.inventory.push({ id: Date.now().toString(36), name: '', qty: 1, notes: '' });
    buildInventory();
    schedSave();
    // Focus the new name input
    const rows = document.querySelectorAll('.cs-inv-row');
    const last = rows[rows.length - 1];
    last?.querySelector('.cs-inv-name')?.focus();
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function buildArmorSlots() {
    const container = document.getElementById('armor-slots');
    if (!container) return;
    container.innerHTML = '';
    const optsHtml = ['<option value="">— empty —</option>', ...ARMOR_OPTION_GROUPS.map(g => `
      <optgroup label="${g.group}">${g.items.map(item => `<option value="${item.toLowerCase()}">${item}</option>`).join('')}</optgroup>
    `)].join('');
    const visibleSlots = ARMOR_SLOT_DEFS.filter(s => (!s.tailOnly || state.tailedRace) && (!s.wingOnly || state.wingedRace));
    for (const slotDef of visibleSlots) {
      const slot = state.armor[slotDef.key] || { name: '', value: 0 };
      const row  = document.createElement('div');
      row.className = 'cs-armor-slot';
      if (slotDef.tailOnly) row.classList.add('cs-armor-slot--tail');
      if (slotDef.wingOnly) row.classList.add('cs-armor-slot--wing');
      row.dataset.slotKey = slotDef.key;
      row.innerHTML = `
        <span class="cs-armor-slot-label">${slotDef.label}</span>
        <select class="cs-select cs-armor-name" data-type="armor" data-slot="${slotDef.key}" data-field="name">${optsHtml}</select>
        <input type="number" class="cs-num-input cs-armor-value" value="${slot.value || 0}"
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
      const val  = state.wells[well] ?? 0;
      const item = document.createElement('div');
      item.className = 'cs-well-item';
      item.innerHTML = `
        <div class="cs-well-label">${well}</div>
        <div class="cs-well-controls">
          <input type="number" class="cs-num-input" value="${val}"
            data-type="well" data-well="${well}" />
          <button class="cs-dice-btn" data-level="${val}" title="Roll ${well} well (skill ${val})">🎲</button>
        </div>
      `;
      container.appendChild(item);
    }
  }

  /* ----------------------------------------------------------
     Render fields
  ---------------------------------------------------------- */
  function renderFields() {
    function set(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }

    set('cs-char-name',   state.charName);   set('cs-player-name', state.playerName);
    set('cs-age',         state.age);        set('cs-race',        state.race);
    set('cs-level',       state.level);      set('cs-exp',         state.exp);
    set('cs-exp-next',    state.expToNext);  set('cs-gp-a',        state.gpA);
    set('cs-gp-b',        state.gpB);        set('cs-gp-c',        state.gpC);
    set('cs-gp-d',        state.gpD);

    for (const attr of ATTRIBUTES) {
      const inp = document.querySelector(`[data-type="attr"][data-key="${attr}"]`);
      if (!inp) continue;
      inp.value = state.attrs[attr] ?? 0;
      const btn = inp.nextElementSibling;
      if (btn?.classList.contains('cs-dice-btn')) btn.dataset.level = inp.value;
    }

    set('cs-hp-pts',   state.hpMax);   set('cs-man-pts',  state.manMax);  set('cs-stam-pts', state.stamMax);
    updateResourceCalc('hpMax', state.hpMax); updateResourceCalc('manMax', state.manMax); updateResourceCalc('stamMax', state.stamMax);
    updateResourceDisplays();

    const tailedEl = document.getElementById('cs-tailed'); if (tailedEl) tailedEl.checked = !!state.tailedRace;
    const wingedEl = document.getElementById('cs-winged'); if (wingedEl) wingedEl.checked = !!state.wingedRace;
    const avEl     = document.getElementById('cs-arcane-vamp'); if (avEl) avEl.checked = !!state.arcaneVampirism;

    updateBattleStats();

    set('cs-inj-common',   state.injCommon); set('cs-inj-harsh',   state.injHarsh);
    set('cs-inj-critical', state.injCritical); set('cs-inj-fatal', state.injFatal);
    set('cs-special',      state.specialFeature);

    updateAttrTotals();

    // Portrait
    const portraitImg = document.getElementById('cs-portrait-img');
    const portraitPh  = document.getElementById('cs-portrait-placeholder');
    if (portraitImg && portraitPh) {
      if (state.portrait) {
        portraitImg.src           = state.portrait;
        portraitImg.style.display = 'block';
        portraitPh.style.display  = 'none';
      } else {
        portraitImg.style.display = 'none';
        portraitPh.style.display  = 'flex';
      }
    }
  }

  /* ----------------------------------------------------------
     Portrait upload (Cloudinary)
  ---------------------------------------------------------- */
  async function handlePortraitUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const label = document.querySelector('label[for="cs-portrait-file"]');
    if (label) label.textContent = 'Uploading…';
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'Abberanth');
      const res  = await fetch('https://api.cloudinary.com/v1_1/dwvp6we4c/image/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      state.portrait = data.secure_url;
      schedSave();
      const img = document.getElementById('cs-portrait-img');
      const ph  = document.getElementById('cs-portrait-placeholder');
      if (img) { img.src = data.secure_url; img.style.display = 'block'; }
      if (ph)  { ph.style.display = 'none'; }
      if (label) label.textContent = '✓ Done';
      setTimeout(() => { if (label) label.textContent = '📁 Portrait'; }, 2000);
    } catch (err) {
      console.error('Portrait upload failed:', err);
      if (label) label.textContent = '✗ Failed';
      setTimeout(() => { if (label) label.textContent = '📁 Portrait'; }, 2500);
    }
  }

  /* ----------------------------------------------------------
     Events
  ---------------------------------------------------------- */
  function bindEvents() {
    const main = document.getElementById('main');
    if (!main) return;
    main.addEventListener('input',  handleChange);
    main.addEventListener('change', handleChange);
    main.addEventListener('click',  handleClick);

    const saveBtn = document.getElementById('cs-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveNow);

    document.getElementById('cs-inv-add-btn')?.addEventListener('click', addInventoryItem);
    document.getElementById('cs-portrait-file')?.addEventListener('change', handlePortraitUpload);

    // Willpower spend button
    document.getElementById('cs-will-spend')?.addEventListener('click', () => {
      const cur = calcWillCur();
      if (cur <= 0) return;
      state.willSpent = (state.willSpent || 0) + 1;
      updateResourceDisplays();
      schedSave();
    });

    // Cast modal
    document.getElementById('cs-cast-cancel')?.addEventListener('click',  closeCastModal);
    document.getElementById('cs-cast-confirm')?.addEventListener('click', confirmCast);
    document.getElementById('cs-cast-extra')?.addEventListener('input',   _updateCastTotal);
    document.getElementById('cs-cast-modal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('cs-cast-modal')) closeCastModal();
    });

    // Rest buttons
    document.getElementById('cs-short-rest-btn')?.addEventListener('click', () => openRestModal('short'));
    document.getElementById('cs-long-rest-btn')?.addEventListener('click',  () => openRestModal('long'));
    document.getElementById('cs-rest-cancel')?.addEventListener('click',    closeRestModal);
    document.getElementById('cs-rest-confirm')?.addEventListener('click',   confirmRest);
    document.getElementById('cs-rest-modal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('cs-rest-modal')) closeRestModal();
    });

    // Enforce max selections per rest type
    document.getElementById('cs-rest-options')?.addEventListener('change', e => {
      if (e.target.type !== 'checkbox') return;
      const max      = _restType === 'short' ? 1 : 2;
      const checked  = document.querySelectorAll('#cs-rest-options input:checked');
      if (checked.length > max) e.target.checked = false;
    });
  }

  function handleChange(e) {
    const el     = e.target;
    if (!['INPUT','SELECT','TEXTAREA'].includes(el.tagName)) return;
    const type   = el.dataset.type;
    const rawVal = el.value;
    let   numVal = parseInt(rawVal, 10);
    if (isNaN(numVal)) numVal = 0;
    if (el.type === 'number') {
      const lo = el.min !== '' ? parseInt(el.min, 10) : -Infinity;
      const hi = el.max !== '' ? parseInt(el.max, 10) : Infinity;
      numVal = Math.max(lo, Math.min(hi, numVal));
      el.value = numVal;
    }

    switch (type) {
      case 'attr':
        state.attrs[el.dataset.key] = numVal;
        syncDiceBtn(el, numVal); updateAttrTotals();
        if (el.dataset.key === 'Constitution') updateACDisplay();
        if (el.dataset.key === 'Speed' || el.dataset.key === 'Strength') updateBattleStats();
        if (el.dataset.key === 'Willpower') updateResourceDisplays();
        break;
      case 'skill':
        if (!state.skills[el.dataset.cat]) state.skills[el.dataset.cat] = {};
        state.skills[el.dataset.cat][el.dataset.skill] = numVal;
        syncDiceBtn(el, numVal); break;
      case 'well':
        state.wells[el.dataset.well] = numVal; syncDiceBtn(el, numVal); buildSpells(); break;
      case 'res-max':
        state[el.dataset.key] = numVal; updateResourceCalc(el.dataset.key, numVal); updateResourceDisplays(); buildSpells(); break;
      case 'combat':
        state[el.dataset.key] = el.type === 'number' ? numVal : rawVal; break;
      case 'armor': {
        const slotKey = el.dataset.slot, field = el.dataset.field;
        if (!state.armor[slotKey]) state.armor[slotKey] = { name: '', value: 0 };
        state.armor[slotKey][field] = field === 'value' ? numVal : rawVal;
        updateACDisplay(); break;
      }
      case 'tailed': state.tailedRace = el.checked; buildArmorSlots(); updateACDisplay(); break;
      case 'winged': state.wingedRace = el.checked; buildArmorSlots(); updateACDisplay(); break;
      case 'condition':
        state[el.dataset.key] = el.checked;
        if (el.dataset.key === 'arcaneVampirism') {
          /* Refresh both calc displays immediately */
          updateResourceCalc('hpMax',  state.hpMax);
          updateResourceCalc('manMax', state.manMax);
          updateResourceDisplays();
        }
        break;
      case 'injury':
        state[el.dataset.key] = numVal; updateResourceDisplays(); break;
      case 'grandparent': {
        if (!state.grandparents) state.grandparents = {};
        state.grandparents[el.dataset.slot] = el.value;
        const trait = el.value ? GRANDPARENT_TRAITS[el.value]?.[el.dataset.slot] : null;
        if (trait?.type === 'feature') {
          const key = _featureKey(el.dataset.slot, trait.name);
          if (state.featureUses[key] === undefined) state.featureUses[key] = trait.maxUses;
        }
        if (trait?.type === 'dual_feature') {
          const keyA = _featureKey(el.dataset.slot, trait.name + ':long');
          const keyB = _featureKey(el.dataset.slot, trait.name + ':short');
          if (state.featureUses[keyA] === undefined) state.featureUses[keyA] = trait.maxUsesLong;
          if (state.featureUses[keyB] === undefined) state.featureUses[keyB] = trait.maxUsesShort;
        }
        buildGrandparents(); updateACDisplay(); updateBattleStats(); break;
      }
      case 'identity':
        state[el.dataset.key] = rawVal;
        if (el.dataset.key === 'exp') {
          const expNum = Math.max(0, parseInt(rawVal, 10) || 0);
          state.exp = expNum;
          const newLevel = calcLevelFromExp(expNum);
          state.level    = newLevel;
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
      if (cur > 0) { state.featureUses[usesKey] = cur - 1; buildGrandparents(); schedSave(); }
      return;
    }

    const diceBtn = e.target.closest('.cs-dice-btn');
    if (diceBtn) {
      const level      = parseInt(diceBtn.dataset.level, 10) || 0;
      const isPhysical = diceBtn.dataset.physical === 'true';
      const skill      = diceBtn.dataset.skill || '';
      const hasEffort  = isPhysical && !!(state.effortSkills?.[skill]);

      if (hasEffort) {
        const stamCur = calcStamCur();
        if (stamCur < 1) {
          alert('Not enough stamina to use Effort!');
          return;
        }
        // Spend 1 stamina
        state.stamSpent = (state.stamSpent || 0) + 1;
        updateResourceDisplays();
        schedSave();

        // Effort bonus = ceil(effective Strength / 2)
        const effStr     = calcEffectiveAttr('Strength');
        const effortBonus = Math.ceil(effStr / 2);
        window.DiceUI?.openWithSkill(level, effortBonus);
      } else {
        window.DiceUI?.openWithSkill(level);
      }
    }
  }

  /* ----------------------------------------------------------
     Rest Modal
  ---------------------------------------------------------- */
  let _restType = 'short';

  function openRestModal(type) {
    _restType = type;
    const modal   = document.getElementById('cs-rest-modal');
    const title   = document.getElementById('cs-rest-panel-title');
    const hint    = document.getElementById('cs-rest-panel-hint');
    const confirm = document.getElementById('cs-rest-confirm');
    const willOpt = document.querySelector('.cs-rest-option--long-only');

    title.textContent   = type === 'short' ? '🌙 Short Rest' : '☀️ Long Rest';
    hint.innerHTML      = type === 'short'
      ? 'Choose <strong>1</strong> resource to restore:'
      : 'Choose up to <strong>2</strong> resources to restore:';
    confirm.textContent = type === 'short' ? 'Take Short Rest' : 'Take Long Rest';

    // Show Willpower only on long rest
    if (willOpt) willOpt.style.display = type === 'long' ? 'flex' : 'none';

    // Clear previous selections
    document.querySelectorAll('#cs-rest-options input').forEach(cb => cb.checked = false);
    document.querySelectorAll('.cs-rest-option').forEach(opt => opt.classList.remove('selected'));

    modal.style.display = 'flex';
  }

  function closeRestModal() {
    document.getElementById('cs-rest-modal').style.display = 'none';
  }

  function confirmRest() {
    const checked = [...document.querySelectorAll('#cs-rest-options input:checked')]
      .map(cb => cb.value);

    const max = _restType === 'short' ? 1 : 2;
    if (checked.length === 0) {
      alert('Please choose at least one resource to restore.');
      return;
    }
    if (checked.length > max) {
      alert(`You can only restore ${max} resource${max > 1 ? 's' : ''} on a ${_restType} rest.`);
      return;
    }

    // Restore chosen resources
    if (checked.includes('hp')) {
      state.injCommon   = 0;
      state.injHarsh    = 0;
      state.injCritical = 0;
      state.injFatal    = 0;
      // Update injury inputs
      ['cs-inj-common','cs-inj-harsh','cs-inj-critical','cs-inj-fatal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
      });
    }
    if (checked.includes('mana'))  state.manaSpent = 0;
    if (checked.includes('stam'))  state.stamSpent = 0;
    if (checked.includes('will'))  state.willSpent = 0;

    // Reset grandparent features based on rest type
    if (_restType === 'short') {
      window.CharSheet.shortRest();
    } else {
      window.CharSheet.longRest();
    }

    updateResourceDisplays();
    schedSave();
    closeRestModal();
  }

  /* ----------------------------------------------------------
     Public API
  ---------------------------------------------------------- */
  window.CharSheet = {
    spendMana(cost)  { CharSheet_spendMana(cost); },
    spendStam(cost)  { state.stamSpent = Math.min(calcResourceMax(state.stamMax), (state.stamSpent||0)+cost); updateResourceDisplays(); schedSave(); },
    spendWill(cost)  {
      const max = (state.attrs?.Willpower || 0) + calcRacialBonus('Willpower');
      state.willSpent = Math.min(max, (state.willSpent||0)+cost);
      updateResourceDisplays(); schedSave();
    },
    restoreAll()     { state.manaSpent = 0; state.stamSpent = 0; state.willSpent = 0; updateResourceDisplays(); schedSave(); },
    restoreMana()    { state.manaSpent = 0; updateResourceDisplays(); schedSave(); },
    gainMana(n = 1)  { state.manaSpent = Math.max(0, (state.manaSpent||0) - n); updateResourceDisplays(); schedSave(); },
    restoreStam()    { state.stamSpent = 0; updateResourceDisplays(); schedSave(); },
    restoreWill()    { state.willSpent = 0; updateResourceDisplays(); schedSave(); },
    shortRest() {
      for (const slot of ['A','B','C','D']) {
        const race = state.grandparents?.[slot]; if (!race) continue;
        const trait = GRANDPARENT_TRAITS[race]?.[slot];
        if (trait?.type === 'feature' && (trait.restType === 'short' || trait.restType === 'combat'))
          state.featureUses[_featureKey(slot, trait.name)] = trait.maxUses;
        if (trait?.type === 'dual_feature')
          state.featureUses[_featureKey(slot, trait.name + ':short')] = trait.maxUsesShort;
      }
      buildGrandparents(); schedSave();
    },
    longRest() {
      for (const slot of ['A','B','C','D']) {
        const race = state.grandparents?.[slot]; if (!race) continue;
        const trait = GRANDPARENT_TRAITS[race]?.[slot];
        if (trait?.type === 'feature' && (trait.restType === 'long' || trait.restType === 'daily'))
          state.featureUses[_featureKey(slot, trait.name)] = trait.maxUses;
        if (trait?.type === 'dual_feature') {
          state.featureUses[_featureKey(slot, trait.name + ':long')]  = trait.maxUsesLong;
          state.featureUses[_featureKey(slot, trait.name + ':short')] = trait.maxUsesShort;
        }
      }
      buildGrandparents(); schedSave();
    },
  };

  /* ----------------------------------------------------------
     Init
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      await loadState(user);
      showDMBanner();
      buildSkills(); buildWells(); buildArmorSlots(); buildGrandparents(); buildSpells(); buildInventory();
      renderFields(); bindEvents(); refreshPoints(); updateACDisplay(); updateBattleStats();

      // Spell picker close
      document.getElementById('spell-picker-close')?.addEventListener('click', closeSpellPicker);
      document.getElementById('spell-picker-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('spell-picker-modal')) closeSpellPicker();
      });
    });
  });

})();