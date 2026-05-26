/* ============================================================
   Abberanth Companion — DM-Editable Content Pages
   Set window.EP_PAGE_ID before including this script.
   Supports basic Markdown-lite formatting:
     ## Heading 2   ### Heading 3
     **bold**        *italic*
     - list item
     Blank line = new paragraph
   ============================================================ */

(function () {

  const PAGE_ID = window.EP_PAGE_ID || 'generic';

  function renderContent(raw) {
    if (!raw || !raw.trim()) {
      return `<p class="ep-content-empty">No content yet.</p>`;
    }

    // Split into blocks on blank lines
    const blocks = raw.split(/\n{2,}/);

    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';

      if (trimmed.startsWith('## '))  return `<h2>${md(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith('### ')) return `<h3>${md(trimmed.slice(4))}</h3>`;

      // List block (lines starting with - or *)
      if (/^[-*] /m.test(trimmed)) {
        const items = trimmed.split('\n')
          .filter(l => /^[-*] /.test(l.trim()))
          .map(l => `<li>${md(l.replace(/^[-*] /, '').trim())}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      // Regular paragraph
      return `<p>${md(trimmed.replace(/\n/g, '<br>'))}</p>`;
    }).join('');
  }

  // Inline markdown: **bold**, *italic*
  function md(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  async function loadContent() {
    try {
      const snap = await window._db.collection('siteContent').doc(PAGE_ID).get();
      const raw  = snap.data()?.content || '';
      setView(raw);
      const textarea = document.getElementById('ep-textarea');
      if (textarea) textarea.value = raw;
    } catch (e) {
      console.warn('Could not load page content:', e);
    }
  }

  function setView(raw) {
    const viewEl = document.getElementById('ep-content-view');
    if (viewEl) viewEl.innerHTML = renderContent(raw);
  }

  async function saveContent() {
    const textarea = document.getElementById('ep-textarea');
    const btn      = document.getElementById('ep-save-btn');
    if (!textarea) return;

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await window._db.collection('siteContent').doc(PAGE_ID).set({
        content:   textarea.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      setView(textarea.value);
      toggleEdit(false);
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Save'; }, 2000);
    } catch (e) {
      alert('Save failed: ' + e.message);
      btn.disabled = false; btn.textContent = 'Save';
    }
  }

  function toggleEdit(on) {
    document.getElementById('ep-view-wrap').style.display  = on ? 'none'  : 'block';
    document.getElementById('ep-edit-wrap').style.display  = on ? 'flex'  : 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async () => {
      await loadContent();

      if (window.isDM) {
        const tog = document.getElementById('ep-edit-toggle');
        if (tog) { tog.style.display = 'block'; tog.addEventListener('click', () => toggleEdit(true)); }
        document.getElementById('ep-save-btn')?.addEventListener('click', saveContent);
        document.getElementById('ep-cancel-btn')?.addEventListener('click', () => toggleEdit(false));
      }
    });
  });

})();
