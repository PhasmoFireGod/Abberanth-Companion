/* ============================================================
   Abberanth Companion — RPG Consent Checklist
   Players fill out once (updatable). DM views all responses.
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     Checklist schema — mirrors the image exactly
  ---------------------------------------------------------- */
  const SCHEMA = [
    {
      id: 'horror', title: 'Horror',
      items: [
        'Bugs','Blood','Demons','Eyeballs','Gore',
        'Harm to animals','Harm to children','Rats','Spiders',
      ],
      customCount: 3,
    },
    {
      id: 'relationships', title: 'Relationships',
      items: [
        { label: 'Romance', sub: true },
        { label: 'Fade to black', indent: true },
        { label: 'Explicit', indent: true },
        { label: 'Between PCs and NPCs', indent: true },
        { label: 'Between PCs', indent: true },
        { label: 'Sex', sub: true },
        { label: 'Fade to Black', indent: true },
        { label: 'Explicit', indent: true },
        { label: 'Between PCs and NPCs', indent: true },
        { label: 'Between PCs', indent: true },
      ],
      customCount: 4,
    },
    {
      id: 'social', title: 'Social and Cultural Issues',
      items: [
        'Homophobia','Racism','Real-world religion',
        'Sexism','Specific cultural issues',
      ],
      customCount: 4,
    },
    {
      id: 'health', title: 'Mental and Physical Health',
      items: [
        'Cancer','Claustrophobia','Freezing to death','Gaslighting',
        'Genocide','Heatstroke','Natural disasters (earthquakes, forest fires)',
        'Paralysis/physical restraint','Police, police aggression',
        'Pregnancy, miscarriage, or abortion','Self-harm',
        'Severe weather (hurricanes, tornados)','Sexual assault',
        'Starvation','Terrorism','Torture','Thirst',
      ],
      customCount: 3,
    },
  ];

  const ADDITIONAL_COUNT = 6;
  const RATINGS = ['G','Y','R'];

  let _user       = null;
  let _viewingUid = null;  // DM viewing a specific player's form
  let _viewOnly   = false;

  function _col() { return window._db.collection('consentForms'); }

  /* ----------------------------------------------------------
     Build form HTML
  ---------------------------------------------------------- */
  function buildForm(data = {}, viewOnly = false) {
    const main = document.getElementById('cf-main');
    if (!main) return;

    _viewOnly = viewOnly;
    if (viewOnly) main.classList.add('cf-view-only');
    else           main.classList.remove('cf-view-only');

    // Top fields
    const topHtml = `
      <div class="cf-top-fields">
        <div class="cf-field">
          <label>GM Name</label>
          <input class="cf-input" id="cf-gm-name" type="text" placeholder="GM name"
            value="${esc(data.gmName || '')}" ${viewOnly ? 'readonly' : ''} />
        </div>
        <div class="cf-field">
          <label>Player Name (or leave blank)</label>
          <input class="cf-input" id="cf-player-name" type="text" placeholder="Your name (optional)"
            value="${esc(data.playerName || '')}" ${viewOnly ? 'readonly' : ''} />
        </div>
        <div class="cf-field">
          <label>Planned Game Theme</label>
          <input class="cf-input" id="cf-theme" type="text" placeholder="e.g. Dark fantasy, political intrigue…"
            value="${esc(data.theme || '')}" ${viewOnly ? 'readonly' : ''} />
        </div>
        <div class="cf-rating-row">
          <span class="cf-rating-label">Movie Rating:</span>
          ${['G','PG','PG-13','R','NC-17','Other'].map(r => `
            <button class="cf-rating-btn${(data.rating === r) ? ' active' : ''}"
              data-rating="${r}" ${viewOnly ? 'disabled' : ''}>${r}</button>`
          ).join('')}
        </div>
      </div>
    `;

    // Legend
    const legendHtml = `
      <div class="cf-legend">
        <span class="cf-legend-item">
          <span class="cf-radio-label g selected" style="pointer-events:none;">G</span>
          Green = Enthusiastic consent; bring it on!
        </span>
        <span class="cf-legend-item">
          <span class="cf-radio-label y selected" style="width:18px;height:18px;clip-path:polygon(50% 0%,0% 100%,100% 100%);background:#cc9a00;pointer-events:none;font-size:0.5rem;color:#fff;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;">Y</span>
          Yellow = Okay offstage / needs discussion
        </span>
        <span class="cf-legend-item">
          <span class="cf-radio-label r selected" style="pointer-events:none;">R</span>
          Red = Hard line; do not include
        </span>
      </div>
    `;

    // Main 2-col grid
    const responses = data.responses || {};
    const customData = data.custom || {};

    const sectionsHtml = SCHEMA.map(section => `
      <div class="cf-section">
        <div class="cf-section-title">${esc(section.title)}</div>
        ${section.items.map((item, idx) => {
          const label  = typeof item === 'string' ? item : item.label;
          const isSub  = typeof item === 'object' && item.sub;
          const indent = typeof item === 'object' && item.indent;
          if (isSub) return `<div class="cf-sub-label">${esc(label)}</div>`;
          const key = `${section.id}.${label.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase()}`;
          const val = responses[key] || '';
          return buildRow(key, label, val, indent, viewOnly);
        }).join('')}
        ${buildCustomRows(section.id, section.customCount, customData, viewOnly)}
      </div>
    `).join('');

    // Additional topics (full width)
    const addData = data.additionalTopics || [];
    const additionalHtml = `
      <div class="cf-section cf-full-width">
        <div class="cf-section-title">Additional Topics</div>
        ${Array.from({ length: ADDITIONAL_COUNT }, (_, i) => {
          const topic = addData[i] || {};
          const key = `additional.${i}`;
          return `
            <div class="cf-row">
              <input class="cf-custom-input" data-add-idx="${i}" data-add-field="label"
                type="text" placeholder="Topic…"
                value="${esc(topic.label || '')}" ${viewOnly ? 'readonly' : ''} />
              ${buildGYR(key, topic.response || '', viewOnly)}
            </div>`;
        }).join('')}
      </div>
    `;

    // Follow-up
    const followHtml = `
      <div class="cf-section cf-full-width">
        <div class="cf-section-title" style="border:none;padding:0;margin-bottom:0.5rem;font-size:0.8rem;">
          Do you want the GM to follow up with you to clarify any of these responses? If so, which ones?
        </div>
        <textarea class="cf-follow-up-input" id="cf-follow-up"
          placeholder="List any topics you'd like to discuss further…"
          ${viewOnly ? 'readonly' : ''}>${esc(data.followUp || '')}</textarea>
      </div>
    `;

    main.innerHTML = topHtml + legendHtml + `<div class="cf-main-grid">${sectionsHtml}${additionalHtml}${followHtml}</div>`;

    if (!viewOnly) {
      // Rating buttons
      main.querySelectorAll('.cf-rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          main.querySelectorAll('.cf-rating-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // GYR radios — visual toggle
      main.querySelectorAll('.cf-radio-label').forEach(label => {
        label.addEventListener('click', () => {
          const key = label.dataset.key;
          main.querySelectorAll(`.cf-radio-label[data-key="${key}"]`).forEach(l => l.classList.remove('selected'));
          label.classList.add('selected');
        });
      });
    }
  }

  function buildRow(key, label, val, indent, viewOnly) {
    return `
      <div class="cf-row">
        <span class="cf-row-label${indent ? ' indent' : ''}">${esc(label)}</span>
        ${buildGYR(key, val, viewOnly)}
      </div>`;
  }

  function buildCustomRows(sectionId, count, customData, viewOnly) {
    return Array.from({ length: count }, (_, i) => {
      const d   = (customData[sectionId] || [])[i] || {};
      const key = `custom.${sectionId}.${i}`;
      return `
        <div class="cf-row">
          <input class="cf-custom-input" data-custom-section="${sectionId}" data-custom-idx="${i}"
            type="text" placeholder="Add topic…"
            value="${esc(d.label || '')}" ${viewOnly ? 'readonly' : ''} />
          ${buildGYR(key, d.response || '', viewOnly)}
        </div>`;
    }).join('');
  }

  function buildGYR(key, val, viewOnly) {
    return `
      <div class="cf-gyr">
        ${RATINGS.map(r => `
          <label class="cf-radio-label ${r.toLowerCase()}${val === r ? ' selected' : ''}"
            data-key="${esc(key)}" data-val="${r}" title="${rTitle(r)}">
            <input type="radio" name="${esc(key)}" value="${r}"
              ${val === r ? 'checked' : ''} ${viewOnly ? 'disabled' : ''} />
            ${r}
          </label>`
        ).join('')}
      </div>`;
  }

  function rTitle(r) {
    if (r === 'G') return 'Green — Enthusiastic consent';
    if (r === 'Y') return 'Yellow — Okay with discussion';
    return 'Red — Hard line, do not include';
  }

  /* ----------------------------------------------------------
     Collect form data
  ---------------------------------------------------------- */
  function collectFormData() {
    const main = document.getElementById('cf-main');
    const data = {
      gmName:     document.getElementById('cf-gm-name')?.value.trim() || '',
      playerName: document.getElementById('cf-player-name')?.value.trim() || '',
      theme:      document.getElementById('cf-theme')?.value.trim() || '',
      rating:     main.querySelector('.cf-rating-btn.active')?.dataset.rating || '',
      followUp:   document.getElementById('cf-follow-up')?.value.trim() || '',
      responses:  {},
      custom:     {},
      additionalTopics: [],
    };

    // Selected GYR radios
    main.querySelectorAll('.cf-radio-label.selected').forEach(label => {
      data.responses[label.dataset.key] = label.dataset.val;
    });

    // Custom topic text + response
    SCHEMA.forEach(section => {
      data.custom[section.id] = [];
      main.querySelectorAll(`[data-custom-section="${section.id}"]`).forEach((inp, i) => {
        const label = inp.value.trim();
        const respLabel = main.querySelector(`.cf-radio-label.selected[data-key="custom.${section.id}.${i}"]`);
        if (label || respLabel) {
          data.custom[section.id][i] = { label, response: respLabel?.dataset.val || '' };
        }
      });
    });

    // Additional topics
    data.additionalTopics = Array.from({ length: ADDITIONAL_COUNT }, (_, i) => {
      const labelInp = main.querySelector(`[data-add-idx="${i}"][data-add-field="label"]`);
      const respLabel = main.querySelector(`.cf-radio-label.selected[data-key="additional.${i}"]`);
      return { label: labelInp?.value.trim() || '', response: respLabel?.dataset.val || '' };
    });

    return data;
  }

  /* ----------------------------------------------------------
     Save
  ---------------------------------------------------------- */
  async function saveForm() {
    const btn = document.getElementById('cf-save-btn');
    const status = document.getElementById('cf-save-status');
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
      const data = collectFormData();
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      data.submittedByEmail = _user.email;
      data.submittedByUsername = window._username || null;

      const isNew = !(await _col().doc(_user.uid).get()).exists;
      if (isNew) data.submittedAt = firebase.firestore.FieldValue.serverTimestamp();

      await _col().doc(_user.uid).set(data, { merge: false });
      if (status) status.textContent = 'Saved ✓';
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Form'; if (status) status.textContent = ''; }, 2500);
    } catch (e) {
      alert('Save failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Save Form';
    }
  }

  /* ----------------------------------------------------------
     DM view — list of all submitted forms
  ---------------------------------------------------------- */
  async function loadDMView() {
    const listWrap = document.getElementById('cf-player-list');
    if (!listWrap) return;

    try {
      let snap;
      try { snap = await _col().orderBy('submittedAt', 'desc').get(); }
      catch (_) { snap = await _col().get(); }

      if (snap.empty) {
        listWrap.innerHTML = '<p style="color:var(--text-muted);">No consent forms submitted yet.</p>';
        return;
      }

      snap.forEach(doc => {
        const d    = doc.data();
        const name = d.submittedByUsername || d.submittedByEmail || doc.id;
        const when = d.updatedAt?.toDate
          ? d.updatedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Unknown date';

        const card = document.createElement('div');
        card.className = 'cf-player-card';
        card.innerHTML = `
          <span class="cf-player-name">${esc(name)}${d.playerName ? ` — "${esc(d.playerName)}"` : ''}</span>
          <span class="cf-player-date">${esc(when)}</span>
          <button class="cf-view-btn" data-uid="${esc(doc.id)}">View Form →</button>
        `;
        card.querySelector('.cf-view-btn').addEventListener('click', async e => {
          e.stopPropagation();
          await viewPlayerForm(doc.id, d, name);
        });
        card.addEventListener('click', async () => viewPlayerForm(doc.id, d, name));
        listWrap.appendChild(card);
      });
    } catch (e) {
      listWrap.innerHTML = `<p style="color:var(--text-muted);">Error: ${esc(e.message)}</p>`;
    }
  }

  async function viewPlayerForm(uid, data, name) {
    _viewingUid = uid;
    document.getElementById('cf-player-list-section').style.display = 'none';
    document.getElementById('cf-form-section').style.display = 'block';

    // Show a banner
    const banner = document.getElementById('cf-view-banner');
    if (banner) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <span>👁️ Viewing ${esc(name)}'s consent form (read-only)</span>
        <button class="cf-view-btn" id="cf-back-btn">← Back to list</button>
      `;
      document.getElementById('cf-back-btn').addEventListener('click', () => {
        document.getElementById('cf-player-list-section').style.display = 'block';
        document.getElementById('cf-form-section').style.display = 'none';
        banner.style.display = 'none';
        _viewingUid = null;
      });
    }

    buildForm(data, true);
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async user => {
      _user = user;

      if (window.isDM) {
        // DM: show player list
        document.getElementById('cf-player-list-section').style.display = 'block';
        document.getElementById('cf-form-section').style.display = 'none';
        document.getElementById('cf-own-form-link')?.addEventListener('click', () => {
          document.getElementById('cf-player-list-section').style.display = 'none';
          document.getElementById('cf-form-section').style.display = 'block';
          loadOwnForm();
        });
        await loadDMView();
      } else {
        // Player: show their own form
        document.getElementById('cf-form-section').style.display = 'block';
        await loadOwnForm();
      }

      document.getElementById('cf-save-btn')?.addEventListener('click', saveForm);
    });
  });

  async function loadOwnForm() {
    try {
      const snap = await _col().doc(_user.uid).get();
      buildForm(snap.exists ? snap.data() : {}, false);
    } catch (e) {
      buildForm({}, false);
    }
  }

})();
