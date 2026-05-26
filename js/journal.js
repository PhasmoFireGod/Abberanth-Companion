/* ============================================================
   Abberanth Companion — Journal
   Personal journal (private per player) + shared group journal.
   ============================================================ */

(function () {

  let _user              = null;
  let _tab               = 'personal';   // 'personal' | 'group'
  let _entries           = [];
  let _currentId         = null;
  let _saveTimer         = null;
  let _dirty             = false;
  let _timelines         = [];
  let _currentTimelineId = null;   // null = all timelines

  /* ----------------------------------------------------------
     Firestore references
  ---------------------------------------------------------- */
  function personalRef() {
    return window._db.collection('users').doc(_user.uid).collection('journal');
  }
  function groupRef() {
    return window._db.collection('journal');
  }
  function activeRef() {
    return _tab === 'personal' ? personalRef() : groupRef();
  }

  /* ----------------------------------------------------------
     Timelines
  ---------------------------------------------------------- */
  async function loadTimelines() {
    try {
      let snap;
      try { snap = await window._db.collection('timelines').orderBy('createdAt').get(); }
      catch (_) { snap = await window._db.collection('timelines').get(); }

      let all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _timelines = window.isDM
        ? all
        : all.filter(t => (t.members || []).includes(_user?.uid));
    } catch (e) {
      console.warn('Could not load timelines:', e);
      _timelines = [];
    }
  }

  function renderTimelineFilter() {
    const bar = document.getElementById('journal-timeline-filter');
    if (!bar) return;

    const pills = [
      { id: null, name: 'All', color: null },
      ..._timelines,
    ].map(tl => {
      const active = _currentTimelineId === tl.id;
      const dotHtml = tl.color
        ? `<span class="tl-filter-dot" style="background:${esc(tl.color)};"></span>` : '';
      const style = (active && tl.color) ? `background:${esc(tl.color)};` : '';
      return `<button class="tl-filter-pill${active ? ' active' : ''}"
        data-tlid="${esc(tl.id || '')}" style="${style}">
        ${dotHtml}${esc(tl.name)}
      </button>`;
    }).join('');

    bar.innerHTML = `<span class="tl-filter-label">Campaign:</span>${pills}`;

    bar.querySelectorAll('.tl-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentTimelineId = btn.dataset.tlid || null;
        renderTimelineFilter();
        loadEntries();
      });
    });
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async (user) => {
      _user = user;
      // Check for ?tl= URL param (from timeline quick-link)
      const urlTl = new URLSearchParams(location.search).get('tl');
      if (urlTl) _currentTimelineId = urlTl;
      await loadTimelines();
      renderTimelineFilter();
      bindUI();
      await loadEntries();
    });
  });

  /* ----------------------------------------------------------
     Load
  ---------------------------------------------------------- */
  async function loadEntries() {
    const listEl = document.getElementById('journal-list');
    if (listEl) listEl.innerHTML = '<p class="journal-empty-list">Loading…</p>';

    try {
      const snap = await activeRef().orderBy('updatedAt', 'desc').get();
      let entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Client-side filter by timeline (avoids composite index requirement)
      if (_currentTimelineId) {
        entries = entries.filter(e => e.timelineId === _currentTimelineId);
      }
      _entries = entries;
    } catch (e) {
      // updatedAt index might not exist yet — fall back to unordered
      try {
        const snap = await activeRef().get();
        let entries = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const at = a.updatedAt?.toMillis?.() ?? 0;
            const bt = b.updatedAt?.toMillis?.() ?? 0;
            return bt - at;
          });
        if (_currentTimelineId) {
          entries = entries.filter(e => e.timelineId === _currentTimelineId);
        }
        _entries = entries;
      } catch (e2) {
        _entries = [];
        console.warn('Journal load failed:', e2);
      }
    }

    _currentId = null;
    renderList();
    showEmptyEditor();
  }

  /* ----------------------------------------------------------
     Render list
  ---------------------------------------------------------- */
  function renderList() {
    const list = document.getElementById('journal-list');
    if (!list) return;
    list.innerHTML = '';

    if (_entries.length === 0) {
      list.innerHTML = '<p class="journal-empty-list">No entries yet.</p>';
      return;
    }

    _entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'journal-entry-item' + (entry.id === _currentId ? ' active' : '');
      item.dataset.id = entry.id;

      const when = entry.updatedAt?.toDate
        ? entry.updatedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      const authorDisplay = entry.authorUsername || entry.authorEmail;
      const author = _tab === 'group' && authorDisplay
        ? `<br/>${authorDisplay}` : '';

      item.innerHTML = `
        <div class="journal-entry-title">${esc(entry.title || 'Untitled')}</div>
        <div class="journal-entry-meta">${when}${author}</div>
      `;
      item.addEventListener('click', () => openEntry(entry));
      list.appendChild(item);
    });
  }

  /* ----------------------------------------------------------
     Open entry
  ---------------------------------------------------------- */
  function openEntry(entry) {
    if (_dirty) commitSave();   // flush unsaved changes before switching
    _currentId = entry.id;

    document.querySelectorAll('.journal-entry-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === entry.id);
    });

    const editorWrap = document.getElementById('journal-editor-wrap');
    const noEntry    = document.getElementById('journal-no-entry');
    if (editorWrap) editorWrap.style.display = 'flex';
    if (noEntry)    noEntry.style.display    = 'none';

    document.getElementById('journal-title').value   = entry.title   || '';
    document.getElementById('journal-content').value = entry.content || '';

    // Author tag (group only)
    const authorEl = document.getElementById('journal-author-tag');
    if (authorEl) {
      if (_tab === 'group' && (entry.authorUsername || entry.authorEmail)) {
        authorEl.textContent = `by ${entry.authorUsername || entry.authorEmail}`;
        authorEl.style.display = 'block';
      } else {
        authorEl.style.display = 'none';
      }
    }

    setSaveStatus('');
    _dirty = false;
  }

  function showEmptyEditor() {
    const editorWrap = document.getElementById('journal-editor-wrap');
    const noEntry    = document.getElementById('journal-no-entry');
    if (editorWrap) editorWrap.style.display = 'none';
    if (noEntry)    noEntry.style.display    = 'flex';
  }

  /* ----------------------------------------------------------
     New entry
  ---------------------------------------------------------- */
  async function newEntry() {
    const data = {
      title:      '',
      content:    '',
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      timelineId: _currentTimelineId || null,
      ..._tab === 'group' ? {
        authorUid:      _user.uid,
        authorEmail:    _user.email,
        authorUsername: window._username || null,
      } : {},
    };

    try {
      const ref = await activeRef().add(data);
      const entry = { id: ref.id, ...data, updatedAt: null };
      _entries.unshift(entry);
      renderList();
      openEntry(entry);
      document.getElementById('journal-title').focus();
    } catch (e) {
      alert('Could not create entry: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Auto-save (debounced)
  ---------------------------------------------------------- */
  function onEditorChange() {
    _dirty = true;
    setSaveStatus('Unsaved…');
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(commitSave, 1200);
  }

  async function commitSave() {
    if (!_currentId || !_dirty) return;
    const title   = document.getElementById('journal-title').value;
    const content = document.getElementById('journal-content').value;

    const update = {
      title,
      content,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await activeRef().doc(_currentId).update(update);
      // Patch local cache
      const local = _entries.find(e => e.id === _currentId);
      if (local) { local.title = title; local.content = content; }
      renderList();
      setSaveStatus('Saved');
      _dirty = false;
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      setSaveStatus('Save failed');
      console.warn('Journal save failed:', e);
    }
  }

  function setSaveStatus(msg) {
    const el = document.getElementById('journal-save-status');
    if (el) el.textContent = msg;
  }

  /* ----------------------------------------------------------
     Delete
  ---------------------------------------------------------- */
  async function deleteEntry() {
    if (!_currentId) return;
    const entry = _entries.find(e => e.id === _currentId);
    const title = entry?.title || 'this entry';
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
      await activeRef().doc(_currentId).delete();
      _entries = _entries.filter(e => e.id !== _currentId);
      _currentId = null;
      _dirty = false;
      renderList();
      showEmptyEditor();
    } catch (e) {
      alert('Could not delete: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Bind UI
  ---------------------------------------------------------- */
  function bindUI() {
    // Tab switches
    document.getElementById('tab-personal')?.addEventListener('click', () => switchTab('personal'));
    document.getElementById('tab-group')?.addEventListener('click',    () => switchTab('group'));

    // New entry
    document.getElementById('journal-new-btn')?.addEventListener('click', newEntry);

    // Editor events
    document.getElementById('journal-title')?.addEventListener('input',  onEditorChange);
    document.getElementById('journal-content')?.addEventListener('input', onEditorChange);

    // Delete
    document.getElementById('journal-delete-btn')?.addEventListener('click', deleteEntry);
  }

  function switchTab(tab) {
    if (tab === _tab) return;
    if (_dirty) commitSave();
    _tab = tab;

    document.getElementById('tab-personal')?.classList.toggle('active', tab === 'personal');
    document.getElementById('tab-group')?.classList.toggle('active',    tab === 'group');

    loadEntries();
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
