/* ============================================================
   Abberanth Companion — Main JS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Mark the current nav link as active
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#sidebar nav a').forEach(link => {
    const href = link.getAttribute('href').split('/').pop();
    if (href === currentPath) link.classList.add('active');
  });

  // Set up collapsible sidebar sections
  setupNavCollapse();
});

function setupNavCollapse() {
  const nav = document.querySelector('#sidebar nav');
  if (!nav) return;

  const labels    = [...nav.querySelectorAll('.nav-section-label')];
  const savedState = JSON.parse(localStorage.getItem('nav-collapse-v1') || '{}');

  labels.forEach(label => {
    const key = label.textContent.trim();

    // Collect all <a> siblings until the next .nav-section-label
    const links = [];
    let el = label.nextElementSibling;
    while (el && !el.classList.contains('nav-section-label')) {
      if (el.tagName === 'A') links.push(el);
      el = el.nextElementSibling;
    }
    if (!links.length) return;

    // The section containing the active link must never be collapsed
    const hasActive = links.some(l => l.classList.contains('active'));

    // Add the collapse arrow indicator
    const arrow = document.createElement('span');
    arrow.className = 'nav-collapse-arrow';
    label.appendChild(arrow);
    label.style.cursor = 'pointer';

    // Apply saved state (active section always stays open)
    const collapsed = !hasActive && (savedState[key] === true);
    applyCollapsed(links, arrow, collapsed);

    // Click to toggle
    label.addEventListener('click', () => {
      const isNowCollapsed = links[0].classList.contains('nav-link-hidden');
      const next = !isNowCollapsed;
      applyCollapsed(links, arrow, next);
      savedState[key] = next;
      localStorage.setItem('nav-collapse-v1', JSON.stringify(savedState));
    });
  });
}

function applyCollapsed(links, arrow, collapsed) {
  links.forEach(l => l.classList.toggle('nav-link-hidden', collapsed));
  arrow.textContent = collapsed ? '▶' : '▾';
}
