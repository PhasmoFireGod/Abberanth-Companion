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
});
