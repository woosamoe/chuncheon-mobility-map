'use strict';
// Performance and resilience enhancements for the Chuncheon mobility map.
// Loaded after the original app; shares its global Leaflet state.
(function () {
  if (!window.L || !state.map) return;
  const map = state.map;
  const oldDrawSpeeds = drawSpeeds;
  const bboxCache = new WeakMap();
  function bboxFor(feature) {
    if (bboxCache.has(feature)) return bboxCache.get(feature);
    const geometry = feature.geometry || {};
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] :
      geometry.type === 'MultiLineString' ? geometry.coordinates : [];
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const line of lines) for (const coord of line || []) {
      if (!Array.isArray(coord) || coord.length < 2) continue;
      const x = Number(coord[0]), y = Number(coord[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
    bboxCache.set(feature, b);
    return b;
  }
  let lastData = null, lastKey = '';
  drawSpeeds = function () {
    const features = Array.isArray(state.speed?.features) ? state.speed.features : [];
    const visible = document.querySelector('#speedToggle').checked;
    const viewport = map.getBounds().pad(0.12);
    const bb = [viewport.getWest(), viewport.getSouth(), viewport.getEast(), viewport.getNorth()];
    const key = String(visible) + '|' + bb.map(x => x.toFixed(3)).join('|');
    if (state.speed !== lastData || key !== lastKey) {
      lastData = state.speed; lastKey = key;
      state.layers.speed.clearLayers();
      if (visible && features.length) {
        const subset = features.filter(f => {
          const b = bboxFor(f);
          return b[0] <= bb[2] && b[2] >= bb[0] && b[1] <= bb[3] && b[3] >= bb[1];
        });
        if (subset.length) {
          // A single GeoJSON layer, restricted to visible roads, reduces map lag.
          L.geoJSON({type: 'FeatureCollection', features: subset}, {
            style: f => {
              const p = f.properties || {};
              return {color: speedColor(p.speed, p.observedAt), weight: 3,
                opacity: ageMinutes(p.observedAt) <= 60 ? 0.88 : 0.35};
            },
            onEachFeature: (f, layer) => {
              const p = f.properties || {};
              layer.on('click', () => {
                const fresh = ageMinutes(p.observedAt) <= 60;
                details('도로 주행속도', p.name || '도로 구간',
                  fresh && Number.isFinite(p.speed) ? count(p.speed, 1) + ' km/h' : '최신 속도 없음',
                  '도로 링크: ' + (p.id || '-') +
                  '\n관측시각: ' + (p.observedAt ? toKst(new Date(p.observedAt)) : '미확인') +
                  '\n수집: ' + (state.speed?.metadata?.collectedAt ?
                    toKst(new Date(state.speed.metadata.collectedAt)) : '미확인') +
                  '\n주행속도이며 차량 통행 대수가 아닙니다.');
              });
            }
          }).addTo(state.layers.speed);
        }
      }
    }
    document.querySelector('#roadCount').textContent = count(features.length);
    const collected = state.speed?.metadata?.collectedAt;
    document.querySelector('#speedTime').textContent = collected ? toKst(new Date(collected)) : '—';
    if (!features.length) return setStatus('도로속도 공개 데이터 미확보', 'bad');
    if (ageMinutes(collected) > 60) return setStatus('도로속도 자료 갱신 지연', 'warn');
    const freshCount = features.reduce((n, f) => {
      const p = f.properties || {};
      return n + (Number.isFinite(p.speed) && ageMinutes(p.observedAt) <= 60 ? 1 : 0);
    }, 0);
    if (!freshCount) return setStatus('최신 속도 없음 · 도로형상만 표시', 'warn');
    setStatus('최근 수집 완료 · 유효 속도 ' + count(freshCount) + '개 구간');
  };
  map.on('moveend', () => drawSpeeds());
  window.addEventListener('resize', () => map.invalidateSize({pan: false}));
  if (document.fonts?.ready) document.fonts.ready.then(() => map.invalidateSize({pan: false}));
  requestAnimationFrame(() => map.invalidateSize({pan: false}));

  // Use a globally cached base map with automatic OpenStreetMap fallback.
  const primary = L.tileLayer('https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    maxZoom: 18, keepBuffer: 2, updateWhenIdle: true
  });
  map.eachLayer(layer => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
  let fallback = false, tileErrors = 0;
  primary.on('tileerror', () => {
    if (fallback || ++tileErrors < 4) return;
    fallback = true;
    map.removeLayer(primary);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
      keepBuffer: 2, updateWhenIdle: true
    }).addTo(map);
  });
  primary.addTo(map);
})();