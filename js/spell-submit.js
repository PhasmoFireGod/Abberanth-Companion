/* ============================================================
   Abberanth Companion — Spell Submit + DM Review
   Players submit homebrew spells. DM approves or denies.
   ============================================================ */

(function () {

  const WELLS = ['None','Arcane','Chaos','Day','Death','Fortitude','Life','Night','Order','Time'];
  let _user = null;

  function _col() { return window._db.collection('spellSubmissions'); }

  /* ----------------------------------------------------------
     Load submissions
  ---------------------------------------------------------- */
  async function loadSubmissions() {
    const wrap = document.getElementById('ss-submissions');
    if (!wrap) return;
    wrap.innerHTML = '<p style="color:var(--text-muted);">Loading…</p>';

    try {
      let snap;
      if (window.isDM) {
        // DM sees all
        try { snap = await _col().orderBy('submittedAt', 'desc').get(); }
        catch (_) { snap = await _col().get(); }
      } else {
        // Players see only their own
        snap = await _col().where('submittedByUid', '==', _user.uid).get();
      }

      const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));

      renderSubmissions(subs, wrap);
    } catch (e) {
      wrap.innerHTML = `<p style="color:var(--text-muted);">Could not load submissions: ${esc(e.message)}</p>`;
    }
  }

  function renderSubmissions(subs, wrap) {
    wrap.innerHTML = '';

    if (subs.length === 0) {
      wrap.innerHTML = '<p style="color:var(--text-muted);">No submissions yet.</p>';
      return;
    }

    subs.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'ss-sub-card';

      const when = sub.submittedAt?.toDate
        ? sub.submittedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

      const byLine = sub.submittedByUsername || sub.submittedByEmail || '';

      card.innerHTML = `
        <div class="ss-sub-header">
          <span class="ss-sub-name">${esc(sub.name || 'Untitled Spell')}</span>
          ${byLine ? `<span class="ss-sub-by">by ${esc(byLine)}</span>` : ''}
          ${when ? `<span class="ss-sub-by">${esc(when)}</span>` : ''}
          <span class="ss-status-badge ${sub.status || 'pending'}">${sub.status || 'pending'}</span>
        </div>
        <div class="ss-sub-body" id="body-${esc(sub.id)}">
          ${sub.manaCost != null ? `<div class="ss-sub-field-label">Mana Cost</div><div class="ss-sub-field">${sub.manaCost}</div>` : ''}
          ${sub.wellRequired && sub.wellRequired !== 'None' ? `<div class="ss-sub-field-label">Well Required</div><div class="ss-sub-field">${esc(sub.wellRequired)}${sub.wellMinLevel ? ` (min level ${sub.wellMinLevel})` : ''}</div>` : ''}
          <div class="ss-sub-field-label">Description</div>
          <div class="ss-sub-field">${esc(sub.description || '')}</div>
          ${sub.lore ? `<div class="ss-sub-field-label">Lore / Notes</div><div class="ss-sub-field">${esc(sub.lore)}</div>` : ''}
          ${sub.dmNotes ? `<div class="ss-dm-notes-display">GM Notes: ${esc(sub.dmNotes)}</div>` : ''}
          ${window.isDM ? buildDMActions(sub) : ''}
        </div>
      `;

      // Toggle expand
      card.querySelector('.ss-sub-header').addEventListener('click', () => {
        const body = document.getElementById(`body-${sub.id}`);
        body.classList.toggle('open');
      });

      // DM action buttons
      if (window.isDM) {
        card.querySelector('.ss-approve-btn')?.addEventListener('click', () => setStatus(sub.id, 'approved', card));
        card.querySelector('.ss-deny-btn')?.addEventListener('click',   () => setStatus(sub.id, 'denied',   card));
      }

      wrap.appendChild(card);
    });
  }

  function buildDMActions(sub) {
    return `
      <div class="ss-dm-actions">
        <input class="ss-dm-notes-input" id="dm-notes-${esc(sub.id)}"
          type="text" placeholder="GM notes (optional)…"
          value="${esc(sub.dmNotes || '')}" />
        <button class="ss-approve-btn" data-id="${esc(sub.id)}">✓ Approve</button>
        <button class="ss-deny-btn"    data-id="${esc(sub.id)}">✗ Deny</button>
      </div>
    `;
  }

  async function setStatus(id, status, card) {
    const notesInput = card.querySelector(`#dm-notes-${id}`);
    const dmNotes    = notesInput?.value.trim() || '';
    try {
      await _col().doc(id).update({
        status,
        dmNotes,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      // Refresh
      await loadSubmissions();
    } catch (e) {
      alert('Could not update: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Submit form
  ---------------------------------------------------------- */
  async function submitSpell() {
    const name   = document.getElementById('ss-name').value.trim();
    const desc   = document.getElementById('ss-desc').value.trim();
    const cost   = parseInt(document.getElementById('ss-cost').value, 10) || 0;
    const well   = document.getElementById('ss-well').value;
    const wellLv = parseInt(document.getElementById('ss-well-level').value, 10) || 0;
    const lore   = document.getElementById('ss-lore').value.trim();
    const btn    = document.getElementById('ss-submit-btn');

    if (!name) { alert('Please give your spell a name.'); return; }
    if (!desc) { alert('Please describe what the spell does.'); return; }

    btn.disabled = true; btn.textContent = 'Submitting…';

    try {
      await _col().add({
        name,
        description:        desc,
        manaCost:           cost,
        wellRequired:       well,
        wellMinLevel:       wellLv,
        lore,
        submittedByUid:     _user.uid,
        submittedByEmail:   _user.email,
        submittedByUsername: window._username || null,
        status:             'pending',
        dmNotes:            '',
        submittedAt:        firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Clear form
      ['ss-name','ss-desc','ss-lore'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('ss-cost').value      = '1';
      document.getElementById('ss-well').value      = 'None';
      document.getElementById('ss-well-level').value = '0';

      btn.textContent = 'Submitted ✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Submit for Review'; }, 2500);

      // Reload list
      await loadSubmissions();
    } catch (e) {
      alert('Submit failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Submit for Review';
    }
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  function buildWellOptions() {
    const sel = document.getElementById('ss-well');
    if (!sel) return;
    sel.innerHTML = WELLS.map(w => `<option value="${w}">${w}</option>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async user => {
      _user = user;
      buildWellOptions();
      document.getElementById('ss-submit-btn')?.addEventListener('click', submitSpell);
      await loadSubmissions();
    });
  });

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
