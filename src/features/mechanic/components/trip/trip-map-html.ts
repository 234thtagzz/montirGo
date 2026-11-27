import type { AppTheme } from '@/theme';
import { LEAFLET_CSS, LEAFLET_JS } from './leaflet-bundle';

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

export interface TripMapTiles {
  url: string;
  darkUrl: string | null;
  attribution: string;
}

export interface MapThemeTokens {
  isDark: boolean;
  canvas: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentFg: string;
  routeCasing: string;
  pinBg: string;
  pinBorder: string;
  halo: string;
  scrim: string;
}

export function getTripMapTiles(): TripMapTiles {
  return {
    url: process.env.EXPO_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL,
    darkUrl: process.env.EXPO_PUBLIC_MAP_TILE_URL_DARK?.trim() || null,
    attribution:
      process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_TILE_ATTRIBUTION,
  };
}

export function getMapThemeTokens(theme: AppTheme): MapThemeTokens {
  return {
    isDark: theme.isDark,
    canvas: theme.colors.bgCanvas,
    surface: theme.colors.bgSurface,
    border: theme.colors.borderDefault,
    text: theme.colors.textPrimary,
    textMuted: theme.colors.textSecondary,
    accent: theme.colors.actionPrimaryAltBg,
    accentFg: theme.colors.actionPrimaryFg,
    routeCasing: theme.colors.bgSurface,
    pinBg: theme.colors.bgSurface,
    pinBorder: theme.colors.actionPrimaryAltBg,
    halo: theme.colors.statusInfoBg,
    scrim: theme.colors.shadowColor,
  };
}

function sharedMapStyles(tokens: MapThemeTokens): string {
  return `
  :root {
    --map-bg: ${tokens.canvas};
    --map-surface: ${tokens.surface};
    --map-border: ${tokens.border};
    --map-text: ${tokens.text};
    --map-text-muted: ${tokens.textMuted};
    --map-accent: ${tokens.accent};
    --map-accent-fg: ${tokens.accentFg};
    --map-pin-bg: ${tokens.pinBg};
    --map-pin-border: ${tokens.pinBorder};
    --map-halo: ${tokens.halo};
  }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--map-bg); overflow: hidden; }
  #map { position: absolute; inset: 0; background: var(--map-bg); }
  .leaflet-container { background: var(--map-bg); font-family: -apple-system, Roboto, sans-serif; }
  #map.map-dark-tiles .leaflet-tile-pane {
    filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(88%);
  }
  .leaflet-control-attribution {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--map-surface);
    color: var(--map-text-muted);
    opacity: 0.88;
  }
  .leaflet-control-attribution a { color: var(--map-accent); }
`;
}

/**
 * HTML peta perjalanan berbasis Leaflet 1.9.4 terbundel lokal + dukungan Dark Mode dinamis
 * melalui `window.TripMap.setTheme(tokens)` tanpa memuat ulang WebView.
 */
export function buildTripMapHtml(initialTokens: MapThemeTokens): string {
  const tiles = getTripMapTiles();

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
${sharedMapStyles(initialTokens)}
  .pin-client {
    width: 36px; height: 36px; border-radius: 18px;
    background: var(--map-pin-bg); border: 2px solid var(--map-pin-border);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
  }
  .pin-client svg { stroke: var(--map-accent); }
  .pin-me {
    width: 44px; height: 44px; border-radius: 22px;
    background: var(--map-halo);
    display: flex; align-items: center; justify-content: center;
    opacity: 0.96;
  }
  .pin-me-dot {
    width: 28px; height: 28px; border-radius: 14px;
    background: var(--map-accent); border: 2px solid var(--map-pin-bg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
    box-sizing: border-box;
  }
  .pin-me-arrow { display: block; transition: transform 0.25s linear; fill: var(--map-accent-fg); }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  var TILES = ${JSON.stringify(tiles)};
  var tokens = ${JSON.stringify(initialTokens)};
  var FOLLOW_ZOOM = 16;
  var TOP_INSET = 120;
  var BOTTOM_INSET = 300;

  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  if (typeof L === 'undefined') {
    post({ type: 'error', code: 'leaflet' });
    return;
  }

  var mapEl = document.getElementById('map');
  var follow = true;
  var hasFitted = false;
  var hasCentered = false;
  var arrowEl = null;
  var MODE = 'mechanic';
  var viewerPanned = false;

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    zoomSnap: 0.5,
    fadeAnimation: true,
  });

  function tileUrlFor(isDark) {
    return isDark && TILES.darkUrl ? TILES.darkUrl : TILES.url;
  }

  var activeTileUrl = tileUrlFor(tokens.isDark);
  var tileLayer = L.tileLayer(activeTileUrl, {
    maxZoom: 19,
    attribution: TILES.attribution,
    crossOrigin: true,
  }).addTo(map);

  map.setView([-6.2, 106.816666], 12, { animate: false });

  var casing = L.polyline([], {
    color: tokens.routeCasing, weight: 9, opacity: 0.95,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(map);
  var line = L.polyline([], {
    color: tokens.accent, weight: 5, opacity: 1,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(map);

  function applyTheme(next) {
    tokens = next || tokens;
    var root = document.documentElement.style;
    root.setProperty('--map-bg', tokens.canvas);
    root.setProperty('--map-surface', tokens.surface);
    root.setProperty('--map-border', tokens.border);
    root.setProperty('--map-text', tokens.text);
    root.setProperty('--map-text-muted', tokens.textMuted);
    root.setProperty('--map-accent', tokens.accent);
    root.setProperty('--map-accent-fg', tokens.accentFg);
    root.setProperty('--map-pin-bg', tokens.pinBg);
    root.setProperty('--map-pin-border', tokens.pinBorder);
    root.setProperty('--map-halo', tokens.halo);

    var useDarkFilter = Boolean(tokens.isDark && !TILES.darkUrl);
    mapEl.classList.toggle('map-dark-tiles', useDarkFilter);

    var desiredUrl = tileUrlFor(Boolean(tokens.isDark));
    if (desiredUrl !== activeTileUrl) {
      activeTileUrl = desiredUrl;
      tileLayer.setUrl(desiredUrl);
    }

    casing.setStyle({ color: tokens.routeCasing });
    line.setStyle({ color: tokens.accent });
  }

  applyTheme(tokens);

  var clientIcon = L.divIcon({
    className: '',
    html: '<div class="pin-client">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/><path d="M10 21v-6h4v6"/></svg>' +
      '</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  var meIcon = L.divIcon({
    className: '',
    html: '<div class="pin-me"><div class="pin-me-dot">' +
      '<svg class="pin-me-arrow" viewBox="0 0 24 24" width="14" height="14">' +
      '<path d="M12 2 21 22l-9-5-9 5z"/></svg>' +
      '</div></div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  var meMarker = null;
  var clientMarker = null;

  map.on('dragstart', function () {
    if (MODE === 'client') viewerPanned = true;
    if (follow) {
      follow = false;
      post({ type: 'follow', value: false });
    }
  });

  function centerOn(lat, lng, animate) {
    var offset = (TOP_INSET - BOTTOM_INSET) / 2;
    var point = map.project([lat, lng], FOLLOW_ZOOM);
    var center = map.unproject([point.x, point.y - offset], FOLLOW_ZOOM);
    map.setView(center, FOLLOW_ZOOM, { animate: !!animate, duration: 0.6 });
  }

  function fitViewer(animate) {
    var bounds = null;
    var points = line.getLatLngs();
    if (points && points.length > 1) {
      bounds = line.getBounds();
    } else {
      bounds = L.latLngBounds([]);
      if (meMarker) bounds.extend(meMarker.getLatLng());
      if (clientMarker) bounds.extend(clientMarker.getLatLng());
      if (!bounds.isValid()) return;
    }
    map.fitBounds(bounds, {
      paddingTopLeft: [28, TOP_INSET + 20],
      paddingBottomRight: [28, BOTTOM_INSET + 20],
      maxZoom: 16,
      animate: !!animate,
      duration: 0.5,
    });
  }

  window.TripMap = {
    setTheme: function (nextTokens) {
      applyTheme(nextTokens);
    },
    setInsets: function (top, bottom) {
      TOP_INSET = top;
      BOTTOM_INSET = bottom;
      if (MODE === 'mechanic' && follow && meMarker) {
        var p = meMarker.getLatLng();
        centerOn(p.lat, p.lng, true);
      } else if (MODE === 'client' && !viewerPanned) {
        fitViewer(true);
      }
    },
    setMode: function (mode) {
      MODE = mode === 'client' ? 'client' : 'mechanic';
      if (MODE === 'client') {
        viewerPanned = false;
        fitViewer(true);
      } else if (follow && meMarker) {
        var p = meMarker.getLatLng();
        centerOn(p.lat, p.lng, true);
      }
    },
    setDestination: function (lat, lng) {
      if (!clientMarker) {
        clientMarker = L.marker([lat, lng], {
          icon: clientIcon, interactive: false, keyboard: false, zIndexOffset: 100,
        }).addTo(map);
      } else {
        clientMarker.setLatLng([lat, lng]);
      }
      if (MODE === 'client' && !viewerPanned && line.getLatLngs().length < 2) {
        fitViewer(hasFitted);
      }
    },
    setMechanic: function (lat, lng, heading) {
      if (!meMarker) {
        meMarker = L.marker([lat, lng], {
          icon: meIcon, interactive: false, keyboard: false, zIndexOffset: 200,
        }).addTo(map);
        var el = meMarker.getElement();
        arrowEl = el ? el.querySelector('.pin-me-arrow') : null;
      } else {
        meMarker.setLatLng([lat, lng]);
      }
      if (arrowEl && typeof heading === 'number' && isFinite(heading)) {
        arrowEl.style.transform = 'rotate(' + heading + 'deg)';
      }
      if (MODE === 'mechanic' && follow) {
        centerOn(lat, lng, hasCentered);
        hasCentered = true;
      } else if (MODE === 'client' && !viewerPanned && line.getLatLngs().length < 2) {
        fitViewer(hasFitted);
        hasFitted = true;
      }
    },
    setRoute: function (points, estimated, fit) {
      if (!points || points.length < 2) {
        casing.setLatLngs([]);
        line.setLatLngs([]);
        return;
      }
      casing.setLatLngs(points);
      line.setLatLngs(points);
      line.setStyle({ dashArray: estimated ? '10 8' : null });
      if (MODE === 'client') {
        if (!viewerPanned) {
          fitViewer(hasFitted);
          hasFitted = true;
        }
        return;
      }
      if (fit && !hasFitted) {
        hasFitted = true;
        map.fitBounds(line.getBounds(), {
          paddingTopLeft: [36, TOP_INSET + 36],
          paddingBottomRight: [36, BOTTOM_INSET + 36],
        });
      }
    },
    recenter: function () {
      follow = true;
      if (MODE === 'client') {
        viewerPanned = false;
        fitViewer(true);
      } else if (meMarker) {
        var p = meMarker.getLatLng();
        centerOn(p.lat, p.lng, true);
      }
    },
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

/** HTML pemilih titik lokasi (pin-picker) lazy untuk layar `request/new`. */
export function buildPinPickerMapHtml(
  initialTokens: MapThemeTokens,
  initialCoords: { lat: number; lng: number },
): string {
  const tiles = getTripMapTiles();

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>${sharedMapStyles(initialTokens)}</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  var TILES = ${JSON.stringify(tiles)};
  var tokens = ${JSON.stringify(initialTokens)};
  var start = ${JSON.stringify(initialCoords)};

  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  if (typeof L === 'undefined') {
    post({ type: 'error', code: 'leaflet' });
    return;
  }

  var mapEl = document.getElementById('map');
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    zoomSnap: 0.5,
  }).setView([start.lat, start.lng], 16, { animate: false });

  function tileUrlFor(isDark) {
    return isDark && TILES.darkUrl ? TILES.darkUrl : TILES.url;
  }

  var activeTileUrl = tileUrlFor(tokens.isDark);
  var tileLayer = L.tileLayer(activeTileUrl, {
    maxZoom: 19,
    attribution: TILES.attribution,
    crossOrigin: true,
  }).addTo(map);

  function applyTheme(next) {
    tokens = next || tokens;
    var root = document.documentElement.style;
    root.setProperty('--map-bg', tokens.canvas);
    root.setProperty('--map-surface', tokens.surface);
    root.setProperty('--map-border', tokens.border);
    root.setProperty('--map-text', tokens.text);
    root.setProperty('--map-text-muted', tokens.textMuted);
    root.setProperty('--map-accent', tokens.accent);

    var useDarkFilter = Boolean(tokens.isDark && !TILES.darkUrl);
    mapEl.classList.toggle('map-dark-tiles', useDarkFilter);

    var desiredUrl = tileUrlFor(Boolean(tokens.isDark));
    if (desiredUrl !== activeTileUrl) {
      activeTileUrl = desiredUrl;
      tileLayer.setUrl(desiredUrl);
    }
  }

  applyTheme(tokens);

  map.on('moveend', function () {
    var center = map.getCenter();
    post({ type: 'center', lat: center.lat, lng: center.lng });
  });

  window.PinMap = {
    setTheme: function (nextTokens) {
      applyTheme(nextTokens);
    },
    setCenter: function (lat, lng) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.4 });
    },
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
