/* ============================================================
   Abberanth Companion — Firebase Initialization
   Uses the compat SDK (loaded via CDN script tags).
   Sets window._auth and window._db for use across the site.
   ============================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyDAWQAK1smm9IqMghegjGfubFVthA7Yk5g",
  authDomain:        "abberanth-companion.firebaseapp.com",
  projectId:         "abberanth-companion",
  storageBucket:     "abberanth-companion.firebasestorage.app",
  messagingSenderId: "893144762322",
  appId:             "1:893144762322:web:1aa3b602828351a5c4aa0b",
};

firebase.initializeApp(firebaseConfig);

window._auth = firebase.auth();

// Firestore — only if CDN script was loaded
try { window._db      = firebase.firestore(); } catch (e) { window._db      = null; }

// Storage — only if CDN script was loaded
try { window._storage = firebase.storage(); } catch (e) { window._storage = null; console.error('Storage init failed:', e); }
window.firebaseReady = true;
