/* ============================================================
   Abberanth Companion — Auth Guard
   Include on every protected page AFTER config.js + firebase-init.js.

   - Redirects unauthenticated users to login.html
   - Sets window.isDM based on SITE_CONFIG.dmEmails
   - Registers every login in the players/ Firestore collection
   - Exposes window.onAuthReady(callback) for pages that need
     the user object before initialising (e.g. character-sheet.js)
   - Populates sidebar footer with email, DM badge, Sign Out
   ============================================================ */

(function () {

  /* ---- Helpers ---- */
  function getLoginUrl() {
    const inPages = window.location.pathname.toLowerCase().includes('/pages/');
    return inPages ? 'login.html' : 'pages/login.html';
  }

  function checkIsDM(user) {
    const emails = (window.SITE_CONFIG && window.SITE_CONFIG.dmEmails) || [];
    return emails.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
  }

  function populateSidebar(user) {
    const footer  = document.getElementById('sidebar-footer');
    const emailEl = document.getElementById('sidebar-user-email');
    const logoutEl = document.getElementById('logout-btn');

    if (window.isDM && footer && !document.getElementById('sidebar-dm-badge')) {
      const badge = document.createElement('span');
      badge.id        = 'sidebar-dm-badge';
      badge.className = 'sidebar-dm-badge';
      badge.textContent = '🎭 Game Master';
      footer.insertBefore(badge, footer.firstChild);
    }

    if (emailEl) emailEl.textContent = user.email;

    if (logoutEl && !logoutEl.dataset.bound) {
      logoutEl.dataset.bound = '1';
      logoutEl.addEventListener('click', () => {
        window._auth.signOut().then(() => window.location.replace(getLoginUrl()));
      });
    }
  }

  function registerPlayer(user) {
    if (!window._db) return;
    try {
      const timestamp = firebase.firestore
        ? firebase.firestore.FieldValue.serverTimestamp()
        : null;

      window._db.collection('players').doc(user.uid).set({
        email:    user.email,
        uid:      user.uid,
        isDM:     !!window.isDM,
        lastSeen: timestamp,
      }, { merge: true }).catch(() => {});
    } catch (e) { /* firestore may not be loaded on some pages */ }
  }

  /* ---- onAuthReady callback queue ---- */
  let _resolved  = false;
  let _user      = null;
  let _callbacks = [];

  window.onAuthReady = function (cb) {
    if (_resolved) { cb(_user); }
    else           { _callbacks.push(cb); }
  };

  /* ---- Auth state listener ---- */
  if (window.firebaseReady) {
    window._auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.replace(getLoginUrl());
        return;
      }

      window.isDM = checkIsDM(user);
      _user       = user;
      _resolved   = true;

      populateSidebar(user);
      registerPlayer(user);

      _callbacks.forEach(cb => cb(user));
      _callbacks = [];
    });
  } else {
    _resolved = true;
    _callbacks.forEach(cb => cb(null));
    _callbacks = [];
  }

})();
