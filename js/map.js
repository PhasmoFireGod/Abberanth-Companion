/* ============================================================
   Abberanth Companion — Interactive Maps
   Hierarchical drilldown: World → Continent → Kingdom →
                           City Limits → City / POI
   Uses Leaflet with CRS.Simple for pan/zoom on a custom image.
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     Constants
  ---------------------------------------------------------- */
  const LEVELS = [
    'World',
    'Continent',
    'Kingdom',
    'City Limits',
    'City / Village / Hamlet / Point of Interest',
  ];

  const REGION_COLORS = [
    '#6650d8', '#5898e8', '#2a8a8a', '#50d880',
    '#e07030', '#b870e8', '#e05080', '#c9923a',
  ];

  /* ----------------------------------------------------------
     State
  ---------------------------------------------------------- */
  let _user         = null;
  let _players      = [];
  let _currentMap   = null;
  let _leafMap      = null;
  let _regionLayers = {};
  let _tokenLayers  = {};
  let _mapListener  = null; // Handle real-time disconnects

  // Drawing & Placement state
  let _drawing      = false;
  let _placingToken = false;
  let _drawPoints   = [];   // [[lat, lng], ...]
  let _previewLine  = null;
  let _previewPoly  = null;
  let _drawMarkers  = [];

  /* ----------------------------------------------------------
     Firestore helper
  ---------------------------------------------------------- */
  function _col() { return window._db.collection('maps'); }

  /* ----------------------------------------------------------
     Load players (DM only, for visibility UI)
  ---------------------------------------------------------- */
  async function loadPlayers() {
    if (!window.isDM) return;
    try {
      const dmEmails = (SITE_CONFIG.dmEmails || []).map(e => e.toLowerCase());
      const snap = await window._db.collection('players').orderBy('email').get();
      _players = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!dmEmails.includes((d.email || '').toLowerCase()))
          _players.push({ uid: d.uid || doc.id, email: d.email || doc.id, username: d.username || null });
      });
    } catch (e) { console.warn('Could not load players:', e); }
  }

  /* ----------------------------------------------------------
     Load a specific map (Real-Time Snapshot Engine)
  ---------------------------------------------------------- */
  async function loadMap(mapId) {
    // Unsubscribe from previous map channels
    if (_mapListener) {
      _mapListener();
      _mapListener = null;
    }

    try {
      if (mapId) {
        _mapListener = _col().doc(mapId).onSnapshot(doc => {
          if (!doc.exists) { showError('Map not found.'); return; }
          handleMapUpdate({ id: doc.id, ...doc.data() });
        }, e => console.error("Sync channel error:", e));
      } else {
        const snap = await _col()
          .where('level',    '==', 0)
          .where('parentId', '==', null)
          .limit(1)
          .get();
          
        if (snap.empty) { _currentMap = null; showEmptyState(); return; }
        const initialDoc = snap.docs[0];
        
        _mapListener = _col().doc(initialDoc.id).onSnapshot(doc => {
          if (doc.exists) handleMapUpdate({ id: doc.id, ...doc.data() });
        });
      }
    } catch (e) {
      console.warn('Map initialization failed:', e);
      showError('Could not link data feeds: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Process Real-time Updates Safely
  ---------------------------------------------------------- */
  function handleMapUpdate(mapData) {
    if (!window.isDM) {
      const vis = mapData.visibility || {};
      const uid = _user?.uid;
      if (!vis.all && !(uid && vis[uid])) {
        showError('This map has not been revealed yet.');
        return;
      }
    }

    const standardDisplayRequired = !_currentMap || _currentMap.id !== mapData.id || _currentMap.imageUrl !== mapData.imageUrl;
    _currentMap = mapData;

    if (standardDisplayRequired) {
      displayMap(_currentMap);
    } else {
      document.getElementById('map-name').textContent = _currentMap.name || 'Unnamed Map';
      renderRegions(_currentMap.regions || []);
      renderTokens(_currentMap.tokens || []);
    }
  }

  /* ----------------------------------------------------------
     Display a loaded map
  ---------------------------------------------------------- */
  async function displayMap(mapData) {
    document.getElementById('map-empty').style.display     = 'none';
    document.getElementById('map-container').style.display = 'block';
    document.getElementById('map-name').textContent = mapData.name || 'Unnamed Map';

    await buildBreadcrumb(mapData);
    if (window.isDM) renderToolbar();

    if (mapData.imageUrl && mapData.imageWidth && mapData.imageHeight) {
      setupLeaflet(mapData.imageUrl, mapData.imageWidth, mapData.imageHeight);
      renderRegions(mapData.regions || []);
      renderTokens(mapData.tokens || []);
    } else {
      showNoImageState(mapData);
    }
  }

  /* ----------------------------------------------------------
     Breadcrumb (traces parent chain)
  ---------------------------------------------------------- */
  async function buildBreadcrumb(mapData) {
    const el = document.getElementById('map-breadcrumb');
    if (!el) return;

    const chain = [mapData];
    let cur = mapData;
    for (let i = 0; i < 5 && cur.parentId; i++) {
      try {
        const snap = await _col().doc(cur.parentId).get();
        if (!snap.exists) break;
        cur = { id: snap.id, ...snap.data() };
        chain.unshift(cur);
      } catch (_) { break; }
    }

    el.innerHTML = chain.map((m, i) => {
      const isLast = i === chain.length - 1;
      const label  = esc(m.name || 'Unnamed');
      if (isLast) return `<span class="map-crumb-current">${label}</span>`;
      return `<a class="map-crumb-link" href="#" data-mapid="${esc(m.id)}">${label}</a>
              <span class="map-crumb-sep">›</span>`;
    }).join('');

    el.querySelectorAll('.map-crumb-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(link.dataset.mapid);
      });
    });
  }

  /* ----------------------------------------------------------
     Leaflet setup
  ---------------------------------------------------------- */
  function setupLeaflet(imgUrl, w, h) {
    if (_leafMap) { _leafMap.off(); _leafMap.remove(); _leafMap = null; }

    _leafMap = L.map('map-container', {
      crs:              L.CRS.Simple,
      minZoom:         -4,
      maxZoom:          4,
      zoomSnap:         0.25,
      attributionControl: false,
      doubleClickZoom:  false,
    });

    const bounds = [[0, 0], [h, w]];
    L.imageOverlay(imgUrl, bounds).addTo(_leafMap);
    _leafMap.fitBounds(bounds);

    if (window.isDM) {
      _leafMap.on('click',     onMapClick);
      _leafMap.on('mousemove', onMapMouseMove);
    }
  }

  /* ----------------------------------------------------------
     Render regions
  ---------------------------------------------------------- */
  function renderRegions(regions) {
    Object.values(_regionLayers).forEach(l => l.remove());
    _regionLayers = {};
    if (!_leafMap) return;

    (regions || []).forEach(region => {
      if (!window.isDM && region.visible === false) return;
      if (!region.points || region.points.length < 3) return;

      const hasChild = !!region.childMapId;
      const color    = region.color || REGION_COLORS[0];

      const poly = L.polygon(fromFirestorePoints(region.points), {
        color,
        fillColor:   color,
        fillOpacity: 0.12,
        weight:      hasChild ? 2 : 1.5,
        opacity:     hasChild ? 0.8 : 0.5,
        dashArray:   hasChild ? null : '8 5',
      });

      const tip = region.name + (hasChild
        ? ' ↗'
        : window.isDM ? ' (no child map — right-click to edit)' : '');
      poly.bindTooltip(tip, { sticky: true, className: 'map-tooltip' });

      poly.on('click', e => {
        if (_drawing || _placingToken) return;
        if (region.childMapId) {
          navigateTo(region.childMapId);
        } else if (window.isDM) {
          openRegionEditDialog(region);
        }
      });

      poly.on('mouseover', () => poly.setStyle({ fillOpacity: 0.28, weight: 3 }));
      poly.on('mouseout',  () => poly.setStyle({ fillOpacity: 0.12, weight: hasChild ? 2 : 1.5 }));

      if (window.isDM) {
        poly.on('contextmenu', e => {
          L.DomEvent.stop(e);
          openRegionEditDialog(region);
        });
      }

      poly.addTo(_leafMap);
      _regionLayers[region.id] = poly;
    });
  }
  
  /* ----------------------------------------------------------
     Render Tokens / Markers
  ---------------------------------------------------------- */
  function renderTokens(tokens) {
    Object.values(_tokenLayers).forEach(t => t.remove());
    _tokenLayers = {};

    if (!_leafMap) return;

    (tokens || []).forEach(token => {
      if (!token.position) return;

      const userTokenImg = token.imageUrl || 'https://via.placeholder.com/48?text=Hero';

      const icon = L.divIcon({
        className: 'map-token',
        html: `
          <div class="map-token-wrap">
            <img src="${userTokenImg}" alt="${esc(token.name)}" />
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker(
        [token.position.lat, token.position.lng],
        { icon, draggable: window.isDM }
      );

      marker.bindTooltip(token.name || 'Player', {
        permanent: false,
        direction: 'top',
        className: 'map-tooltip',
      });

      if (window.isDM) {
        marker.on('dragend', async e => {
          const pos = e.target.getLatLng();
          await updateTokenPosition(token.id, pos);
        });

        marker.on('contextmenu', async e => {
          L.DomEvent.stop(e);
          if (confirm(`Remove token "${token.name}"?`)) {
            await deleteToken(token.id);
          }
        });
      }

      marker.addTo(_leafMap);
      _tokenLayers[token.id] = marker;
    });
  }

  /* ----------------------------------------------------------
     Navigation
  ---------------------------------------------------------- */
  function navigateTo(mapId) {
    const url = new URL(location.href);
    url.searchParams.set('id', mapId);
    history.pushState({ mapId }, '', url.toString());
    loadMap(mapId);
  }

  window.addEventListener('popstate', () => {
    const mapId = new URLSearchParams(location.search).get('id');
    loadMap(mapId || null);
  });

  /* ----------------------------------------------------------
     DM Toolbar
  ---------------------------------------------------------- */
  function renderToolbar() {
    const tb = document.getElementById('map-toolbar');
    if (!tb) return;
    tb.style.display = 'flex';
    tb.innerHTML = `
      <button class="map-tool-btn" id="tb-edit">✏️ Edit Map</button>
      <button class="map-tool-btn" id="tb-draw">⬡ Draw Region</button>
      <button class="map-tool-btn map-tool-btn--cancel" id="tb-cancel" style="display:none;">✕ Cancel Draw</button>
      <button class="map-tool-btn" id="tb-token">📍 Place Token</button>
    `;
    document.getElementById('tb-edit').addEventListener('click',   () => openMapEditor(_currentMap));
    document.getElementById('tb-draw').addEventListener('click',   startDrawing);
    document.getElementById('tb-cancel').addEventListener('click', cancelDrawing);
    document.getElementById('tb-token').addEventListener('click',  startTokenPlacement);
  }

  /* ----------------------------------------------------------
     Drawing mode
  ---------------------------------------------------------- */
  function startDrawing() {
    if (!_leafMap) { alert('Upload a map image first.'); return; }
    if (_placingToken) cancelTokenPlacement();
    _drawing    = true;
    _drawPoints = [];
    document.getElementById('map-container').classList.add('map-drawing-mode');
    document.getElementById('tb-draw').style.display   = 'none';
    document.getElementById('tb-cancel').style.display = '';
    showHint('Click to place points · Click the first point to close the region · Min 3 points');
  }

  function cancelDrawing() {
    _drawing    = false;
    _drawPoints = [];
    clearPreview();
    document.getElementById('map-container').classList.remove('map-drawing-mode');
    document.getElementById('tb-draw').style.display   = '';
    document.getElementById('tb-cancel').style.display = 'none';
    hideHint();
  }

  function onMapClick(e) {
    if (_placingToken) {
      placeToken(e.latlng);
      return;
    }
    if (!_drawing) return;

    if (_drawPoints.length >= 3) {
      const firstLatLng = L.latLng(_drawPoints[0][0], _drawPoints[0][1]);
      const clickPx     = _leafMap.latLngToContainerPoint(e.latlng);
      const firstPx     = _leafMap.latLngToContainerPoint(firstLatLng);

      if (clickPx.distanceTo(firstPx) <= 15) {
        const points = [..._drawPoints];
        cancelDrawing();
        openRegionCreateDialog(points);
        return;
      }
    }

    _drawPoints.push([e.latlng.lat, e.latlng.lng]);
    updatePreview(_drawPoints);
  }

  function onMapMouseMove(e) {
    if (!_drawing || _drawPoints.length === 0) return;
    updatePreviewWithCursor(_drawPoints, e.latlng);
  }

  function updatePreview(pts) {
    clearPreview();
    if (pts.length >= 3) {
      _previewPoly = L.polygon(pts, previewStyle()).addTo(_leafMap);
    } else if (pts.length >= 2) {
      _previewLine = L.polyline(pts, previewStyle()).addTo(_leafMap);
    }
    pts.forEach((pt, i) => {
      const isFirst = i === 0;
      const canClose = isFirst && pts.length >= 3;
      const m = L.circleMarker(pt, {
        radius:      isFirst ? 10 : 5,
        color:       isFirst ? '#c9923a' : '#8ba4f8',
        fillColor:   isFirst ? '#c9923a' : '#8ba4f8',
        fillOpacity: 1,
        weight:      isFirst ? 3 : 2,
      }).addTo(_leafMap);
      if (canClose) {
        m.bindTooltip('Click to close region', { permanent: false, className: 'map-tooltip' });
      }
      _drawMarkers.push(m);
    });
  }

  function updatePreviewWithCursor(pts, cursor) {
    if (_previewLine) { _previewLine.remove(); _previewLine = null; }
    if (_previewPoly) { _previewPoly.remove(); _previewPoly = null; }
    const all = [...pts, [cursor.lat, cursor.lng]];
    if (all.length >= 3) {
      _previewPoly = L.polygon(all, previewStyle()).addTo(_leafMap);
    } else {
      _previewLine = L.polyline(all, previewStyle()).addTo(_leafMap);
    }
  }

  function clearPreview() {
    if (_previewLine) { _previewLine.remove(); _previewLine = null; }
    if (_previewPoly) { _previewPoly.remove(); _previewPoly = null; }
    _drawMarkers.forEach(m => m.remove());
    _drawMarkers = [];
  }

  function previewStyle() {
    return { color: '#8ba4f8', fillColor: '#8ba4f8', fillOpacity: 0.15, weight: 2, dashArray: '6 3' };
  }

  function showHint(text) {
    let h = document.getElementById('map-draw-hint');
    if (!h) {
      h = document.createElement('div');
      h.id = 'map-draw-hint';
      h.className = 'map-draw-hint';
      document.body.appendChild(h);
    }
    h.textContent = text;
    h.style.display = 'block';
  }
  
  function hideHint() {
    const h = document.getElementById('map-draw-hint');
    if (h) h.style.display = 'none';
  }

  /* ----------------------------------------------------------
     Token Placement Mode
  ---------------------------------------------------------- */
  function startTokenPlacement() {
    if (_drawing) cancelDrawing();
    _placingToken = true;
    showHint('Click anywhere on the map to place a token.');
  }

  function cancelTokenPlacement() {
    _placingToken = false;
    hideHint();
  }

  async function placeToken(latlng) {
    const name = prompt('Token name?');
    if (!name) {
      cancelTokenPlacement();
      return;
    }

    const avatarUrl = prompt('Custom Avatar Image URL? (Leave empty for fallback style layout)');

    const token = {
      id: `t${Date.now()}`,
      name,
      imageUrl: avatarUrl || '',
      position: {
        lat: latlng.lat,
        lng: latlng.lng,
      },
    };

    _placingToken = false;
    hideHint();

    await saveToken(token);
  }

  /* ----------------------------------------------------------
     Region dialogs
  ---------------------------------------------------------- */
  function openRegionCreateDialog(points) {
    fetchAllMaps().then(maps => showRegionDialog(points, null, maps));
  }

  function openRegionEditDialog(region) {
    fetchAllMaps().then(maps => showRegionDialog(region.points, region, maps));
  }

  async function fetchAllMaps() {
    try {
      const snap = await _col().get();
      return snap.docs
        .filter(d => d.id !== _currentMap?.id)
        .map(d => ({ id: d.id, name: d.data().name, level: d.data().level }));
    } catch (_) { return []; }
  }

  function showRegionDialog(points, existing, allMaps) {
    removeEl('map-region-dialog');

    const nextLevel     = Math.min((_currentMap?.level ?? 0) + 1, LEVELS.length - 1);
    const nextLevelName = LEVELS[nextLevel];

    const colorBtns = REGION_COLORS.map(c => {
      const active = (existing?.color || REGION_COLORS[0]) === c ? ' active' : '';
      return `<button class="map-color-btn${active}" data-color="${c}" style="background:${c};"></button>`;
    }).join('');

    const mapOpts = allMaps.map(m =>
      `<option value="${esc(m.id)}" ${existing?.childMapId === m.id ? 'selected' : ''}>
        ${esc(m.name)} (${LEVELS[m.level] || 'Level ' + m.level})
      </option>`
    ).join('');

    const wrap = document.createElement('div');
    wrap.id = 'map-region-dialog';
    wrap.className = 'map-dialog-overlay';
    wrap.innerHTML = `
      <div class="map-dialog">
        <div class="map-dialog-title">${existing ? 'Edit Region' : 'New Region'}</div>

        <div class="map-dialog-field">
          <label>Region Name *</label>
          <input class="map-dialog-input" id="rd-name" type="text"
            placeholder="${nextLevelName} name…" value="${esc(existing?.name || '')}" />
        </div>

        <div class="map-dialog-field">
          <label>Colour</label>
          <div class="map-color-row" id="rd-colors">${colorBtns}</div>
          <input type="hidden" id="rd-color" value="${esc(existing?.color || REGION_COLORS[0])}" />
        </div>

        <div class="map-dialog-field">
          <label style="text-transform:none;letter-spacing:0;font-size:0.82rem;display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
            <input type="checkbox" id="rd-visible" ${existing?.visible === false ? '' : 'checked'} />
            Visible to players
          </label>
        </div>

        <div class="map-dialog-field">
          <label>Links to child map</label>
          <select class="map-dialog-select" id="rd-link">
            <option value="">— None (drawn boundary only) —</option>
            <option value="__new__">+ Create new ${esc(nextLevelName)} map</option>
            ${mapOpts}
          </select>
          ${existing?.childMapId ? `<p class="map-dialog-hint">Currently linked — change to re-link.</p>` : ''}
        </div>

        <div class="map-dialog-actions">
          ${existing ? `<button class="map-dialog-delete-btn" id="rd-delete">Delete Region</button>` : ''}
          <button class="map-dialog-cancel-btn" id="rd-cancel">Cancel</button>
          <button class="map-dialog-save-btn"   id="rd-save">Save Region</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('rd-name').focus();

    wrap.querySelectorAll('.map-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.map-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('rd-color').value = btn.dataset.color;
      });
    });

    document.getElementById('rd-cancel').addEventListener('click', () => removeEl('map-region-dialog'));

    document.getElementById('rd-save').addEventListener('click', async () => {
      const name = document.getElementById('rd-name').value.trim();
      if (!name) { alert('Please enter a region name.'); return; }

      const color   = document.getElementById('rd-color').value;
      const visible = document.getElementById('rd-visible').checked;
      const link    = document.getElementById('rd-link').value;

      const btn = document.getElementById('rd-save');
      btn.disabled = true; btn.textContent = 'Saving…';

      let childMapId = existing?.childMapId ?? null;
      if      (link === '__new__') childMapId = await createChildMap(nextLevelName, name);
      else if (link)               childMapId = link;
      else                         childMapId = null;

      const regionData = {
        id: existing?.id || `r${Date.now()}`,
        name, color, visible, childMapId, points,
      };

      await saveRegion(regionData, existing);
      removeEl('map-region-dialog');
      if (link === '__new__' && childMapId) navigateTo(childMapId);
    });
	
    if (existing) {
      document.getElementById('rd-delete').addEventListener('click', async () => {
        if (!confirm(`Delete region "${existing.name}"?`)) return;
        await deleteRegion(existing.id);
        removeEl('map-region-dialog');
      });
    }
  }

  /* ----------------------------------------------------------
     Tokens Data Operations
  ---------------------------------------------------------- */
  async function saveToken(tokenData) {
    const tokens = [...(_currentMap.tokens || [])];
    tokens.push(tokenData);

    try {
      await _col().doc(_currentMap.id).update({ tokens });
      _currentMap.tokens = tokens;
      renderTokens(tokens);
    } catch (e) {
      alert('Failed to save token: ' + e.message);
    }
  }

  async function updateTokenPosition(tokenId, latlng) {
    const tokens = [...(_currentMap.tokens || [])];
    const idx = tokens.findIndex(t => t.id === tokenId);
    if (idx < 0) return;

    tokens[idx].position = {
      lat: latlng.lat,
      lng: latlng.lng,
    };

    try {
      await _col().doc(_currentMap.id).update({ tokens });
      _currentMap.tokens = tokens;
    } catch (e) {
      alert('Failed to move token: ' + e.message);
    }
  }

  async function deleteToken(tokenId) {
    const tokens = (_currentMap.tokens || []).filter(t => t.id !== tokenId);

    try {
      await _col().doc(_currentMap.id).update({ tokens });
      _currentMap.tokens = tokens;
      renderTokens(tokens);
    } catch (e) {
      alert('Failed to delete token: ' + e.message);
    }
  }

  /* ----------------------------------------------------------
     Point format helpers
  ---------------------------------------------------------- */
  function toFirestorePoints(pts) {
    return (pts || []).map(p =>
      Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng }
    );
  }
  
  function fromFirestorePoints(pts) {
    return (pts || []).map(p =>
      Array.isArray(p) ? p : [p.lat, p.lng]
    );
  }

  async function saveRegion(regionData, existing) {
    const firestoreRegion = {
      ...regionData,
      points: toFirestorePoints(regionData.points),
    };

    const regions = [...(_currentMap.regions || [])];
    const idx = existing ? regions.findIndex(r => r.id === regionData.id) : -1;
    if (idx >= 0) regions[idx] = firestoreRegion;
    else          regions.push(firestoreRegion);
    try {
      await _col().doc(_currentMap.id).update({ regions });
      _currentMap.regions = regions;
      renderRegions(regions);
    } catch (e) { alert('Save failed: ' + e.message); }
  }

  async function deleteRegion(regionId) {
    const regions = (_currentMap.regions || []).filter(r => r.id !== regionId);
    try {
      await _col().doc(_currentMap.id).update({ regions });
      _currentMap.regions = regions;
      renderRegions(regions);
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  async function createChildMap(levelName, regionName) {
    const level = Math.min((_currentMap?.level ?? 0) + 1, LEVELS.length - 1);
    try {
      const ref = await _col().add({
        name:        `${regionName}`,
        level,
        parentId:    _currentMap.id,
        imageUrl:    null,
        imageWidth:  null,
        imageHeight: null,
        description: '',
        visibility:  { all: false },
        regions:     [],
        tokens:      []
      });
      return ref.id;
    } catch (e) { alert('Could not create child map: ' + e.message); return null; }
  }

  /* ----------------------------------------------------------
     Map Editor Dialog (Integrated Cloudinary Client)
  ---------------------------------------------------------- */
  function openMapEditor(mapData) {
    removeEl('map-editor-dialog');

    const isNew = !mapData;
    let _imgW = mapData?.imageWidth || null;
    let _imgH = mapData?.imageHeight || null;

    const visToggles = _players.map(p => {
      const on = mapData?.visibility?.[p.uid] === true;
      return `<label class="map-vis-toggle ${on ? 'active' : ''}" data-uid="${esc(p.uid)}">
        <input type="checkbox" ${on ? 'checked' : ''} /> ${esc(p.username || p.email)}
      </label>`;
    }).join('');

    const wrap = document.createElement('div');
    wrap.id = 'map-editor-dialog';
    wrap.className = 'map-dialog-overlay';
    wrap.innerHTML = `
      <div class="map-dialog map-dialog--wide">
        <div class="map-dialog-title">${isNew ? 'Create World Map' : 'Edit Map'}</div>

        <div class="map-dialog-field">
          <label>Map Name *</label>
          <input class="map-dialog-input" id="me-name" type="text"
            placeholder="The World of Abberanth" value="${esc(mapData?.name || '')}" />
        </div>

        <div class="map-dialog-field">
          <label>Description</label>
          <textarea class="map-dialog-textarea" id="me-desc"
            placeholder="Notes about this area…">${esc(mapData?.description || '')}</textarea>
        </div>

        <div class="map-dialog-field">
          <label>Map Image</label>
          <div class="map-upload-row">
            <input class="map-dialog-input" id="me-url" type="url"
              placeholder="Paste an image URL, or upload →"
              value="${esc(mapData?.imageUrl || '')}" />
            <label class="map-upload-btn" for="me-img-file">📁 Upload</label>
            <input type="file" id="me-img-file" accept="image/*" style="display:none;" />
          </div>
          <p class="map-dialog-hint" id="me-dims">
            ${mapData?.imageWidth ? `${mapData.imageWidth}×${mapData.imageHeight}px detected` : 'Dimensions auto-detected when image loads'}
          </p>
          <div id="me-preview">
            ${mapData?.imageUrl ? `<img src="${esc(mapData.imageUrl)}" style="max-height:80px;border-radius:6px;margin-top:0.4rem;" />` : ''}
          </div>
        </div>

        <div class="map-dialog-field">
          <label>Visible to</label>
          <div class="map-vis-row">
            <label class="map-vis-toggle ${mapData?.visibility?.all ? 'active' : ''}" id="me-vis-all-wrap">
              <input type="checkbox" id="me-vis-all" ${mapData?.visibility?.all ? 'checked' : ''} />
              All Players
            </label>
            ${visToggles}
          </div>
        </div>

        <div class="map-dialog-actions">
          ${mapData ? `<button class="map-dialog-delete-btn" id="me-delete">Delete Map</button>` : ''}
          <button class="map-dialog-cancel-btn" id="me-cancel">Cancel</button>
          <button class="map-dialog-save-btn"   id="me-save">${isNew ? 'Create Map' : 'Save Map'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('me-name').focus();

    function detectDims(url) {
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        _imgW = img.naturalWidth;
        _imgH = img.naturalHeight;
        document.getElementById('me-dims').textContent    = `${_imgW}×${_imgH}px detected`;
        document.getElementById('me-preview').innerHTML  =
          `<img src="${esc(url)}" style="max-height:80px;border-radius:6px;margin-top:0.4rem;" />`;
      };
      img.src = url;
    }

    document.getElementById('me-url').addEventListener('blur', e => detectDims(e.target.value.trim()));

    document.getElementById('me-img-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;

      const uploadHint = document.getElementById('me-dims');
      uploadHint.textContent = "Uploading to Cloudinary...";

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'abberanth_uploads');

      try {
        const res = await fetch('https://api.cloudinary.com/v1_1/dwvp6we4c/image/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Network server upload failed.');
        
        const data = await res.json();
        const url = data.secure_url;
        
        document.getElementById('me-url').value = url;
        detectDims(url);
      } catch (err) {
        alert("Upload failed: " + err.message);
        uploadHint.textContent = "Upload rejected. Try copy-pasting an image URL directly.";
      }
    });

    wrap.querySelectorAll('.map-vis-toggle').forEach(label => {
      label.querySelector('input')?.addEventListener('change', e => {
        label.classList.toggle('active', e.target.checked);
      });
    });

    document.getElementById('me-cancel').addEventListener('click', () => removeEl('map-editor-dialog'));

    document.getElementById('me-save').addEventListener('click', async () => {
      const name = document.getElementById('me-name').value.trim();
      const url  = document.getElementById('me-url').value.trim();
      if (!name) { alert('Please enter a map name.'); return; }

      const vis = {};
      const allCb = document.getElementById('me-vis-all');
      if (allCb) vis.all = allCb.checked;
      wrap.querySelectorAll('.map-vis-toggle[data-uid]').forEach(label => {
        vis[label.dataset.uid] = label.querySelector('input').checked;
      });

      const data = {
        name,
        description: document.getElementById('me-desc').value.trim(),
        imageUrl:    url || null,
        imageWidth:  _imgW  || null,
        imageHeight: _imgH  || null,
        visibility:  vis,
        level:       mapData?.level    ?? 0,
        parentId:    mapData?.parentId ?? null,
        regions:     mapData?.regions  ?? [],
        tokens:      mapData?.tokens   ?? []
      };

      const btn = document.getElementById('me-save');
      btn.disabled = true; btn.textContent = 'Saving…';

      try {
        if (mapData?.id) {
          await _col().doc(mapData.id).update(data);
        } else {
          const ref = await _col().add(data);
          const u = new URL(location.href);
          u.searchParams.set('id', ref.id);
          history.replaceState({ mapId: ref.id }, '', u.toString());
          loadMap(ref.id);
        }
        removeEl('map-editor-dialog');
      } catch (e) {
        alert('Save failed: ' + e.message);
        btn.disabled = false; btn.textContent = mapData ? 'Save Map' : 'Create Map';
      }
    });

    if (mapData) {
      document.getElementById('me-delete').addEventListener('click', async () => {
        if (!confirm(`Delete "${mapData.name}"? Any regions linking to this map will be broken.`)) return;
        try {
          if (_mapListener) _mapListener(); 
          await _col().doc(mapData.id).delete();
          removeEl('map-editor-dialog');
          if (mapData.parentId) {
            navigateTo(mapData.parentId);
          } else {
            history.replaceState({}, '', location.pathname);
            _currentMap = null;
            showEmptyState();
          }
        } catch (e) { alert('Delete failed: ' + e.message); }
      });
    }
  }

  /* ----------------------------------------------------------
     Empty / error states
  ---------------------------------------------------------- */
  function showEmptyState() {
    document.getElementById('map-container').style.display = 'none';
    const el = document.getElementById('map-empty');
    el.style.display = 'flex';

    if (window.isDM) {
      el.innerHTML = `
        <div class="map-empty-content">
          <div style="font-size:3.5rem;margin-bottom:1rem;">🗺️</div>
          <h2 style="font-family:var(--font-heading);color:var(--accent-gold);margin-bottom:0.5rem;">No World Map Yet</h2>
          <p style="color:var(--text-muted);margin-bottom:1.5rem;">Upload a world map image to get started, then draw clickable regions.</p>
          <button class="map-tool-btn" id="empty-create-btn">+ Create World Map</button>
        </div>`;
      document.getElementById('empty-create-btn').addEventListener('click', () => openMapEditor(null));
    } else {
      el.innerHTML = `
        <div class="map-empty-content">
          <div style="font-size:3.5rem;margin-bottom:1rem;">🗺️</div>
          <p style="color:var(--text-muted);">No maps have been revealed to you yet.</p>
        </div>`;
    }
  }

  function showNoImageState(mapData) {
    if (!window.isDM) {
      document.getElementById('map-container').innerHTML =
        '<div class="map-empty-content"><p style="color:var(--text-muted);">Map image not uploaded yet.</p></div>';
      return;
    }
    document.getElementById('map-container').innerHTML = `
      <div class="map-empty-content">
        <p style="color:var(--text-muted);margin-bottom:1rem;">No image uploaded for this map yet.</p>
        <button class="map-tool-btn" id="no-img-btn">Upload Map Image</button>
      </div>`;
    document.getElementById('no-img-btn').addEventListener('click', () => openMapEditor(mapData));
  }

  function showError(msg) {
    document.getElementById('map-container').style.display = 'none';
    const el = document.getElementById('map-empty');
    el.style.display = 'flex';
    el.innerHTML = `<div class="map-empty-content"><p style="color:var(--text-muted);">${esc(msg)}</p></div>`;
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */
  function removeEl(id) { document.getElementById(id)?.remove(); }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    window.onAuthReady(async user => {
      _user = user;
      if (window.isDM) await loadPlayers();
      const mapId = new URLSearchParams(location.search).get('id') || null;
      await loadMap(mapId);
    });
  });

})();