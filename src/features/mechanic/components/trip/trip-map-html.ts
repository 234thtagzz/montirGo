import { Brand } from '@/constants/brand';

/**
 * Tile peta untuk renderer WebView. Default OpenStreetMap (gratis, tanpa key).
 * Untuk produksi ganti ke penyedia ber-SLA (MapTiler, Carto, dsb.) lewat env:
 * `EXPO_PUBLIC_MAP_TILE_URL` + `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`.
 */
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const LEAFLET_VERSION = '1.9.4';

export interface TripMapTiles {
  url: string;
  attribution: string;
}

export function getTripMapTiles(): TripMapTiles {
  return {
    url: process.env.EXPO_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL,
    attribution:
      process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_TILE_ATTRIBUTION,
  };
}

/**
 * HTML peta yang dirender di WebView: Leaflet + tile raster.
 *
 * Dipakai karena bisa jalan di Expo Go maupun development build (tidak butuh
 * Google Maps SDK / key), sementara `react-native-maps` tidak lagi menampilkan
 * petak peta di Expo Go Android.
 *
 * Jembatan RN → web: `window.TripMap.setMechanic/setDestination/setRoute/...`
 * Jembatan web → RN: `window.ReactNativeWebView.postMessage(JSON.stringify(...))`
 */
export function buildTripMapHtml(): string {
  const tiles = getTripMapTiles();

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #EEF2F7; }
  #map { position: absolute; inset: 0; }
  .leaflet-container { background: #EEF2F7; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-control-attribution {
    font-size: 9px;
    padding: 1px 5px;
    background: rgba(255, 255, 255, 0.82);
    color: #6B7280;
  }
  .leaflet-control-attribution a { color: ${Brand.primary}; }
  .pin-client {
    width: 36px; height: 36px; border-radius: 18px;
    background: #FFFFFF; border: 2px solid ${Brand.primary};
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(11, 27, 51, 0.25);
    box-sizing: border-box;
  }
  .pin-me {
    width: 42px; height: 42px; border-radius: 21px;
    background: rgba(11, 116, 229, 0.18);
    display: flex; align-items: center; justify-content: center;
  }
  .pin-me-dot {
    width: 28px; height: 28px; border-radius: 14px;
    background: ${Brand.primary}; border: 2px solid #FFFFFF;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(11, 27, 51, 0.3);
    box-sizing: border-box;
  }
  .pin-me-arrow { display: block; transition: transform 0.25s linear; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
(function () {
  var TILES = ${JSON.stringify(tiles)};
  var ACCENT = '${Brand.primary}';
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

  var follow = true;
  var hasFitted = false;
  var hasCentered = false;
  var arrowEl = null;

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    zoomSnap: 0.5,
    fadeAnimation: true,
  });
  L.tileLayer(TILES.url, {
    maxZoom: 19,
    attribution: TILES.attribution,
    crossOrigin: true,
  }).addTo(map);
  map.setView([-6.2, 106.816666], 12, { animate: false });

  var casing = L.polyline([], {
    color: '#FFFFFF', weight: 9, opacity: 0.95,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(map);
  var line = L.polyline([], {
    color: ACCENT, weight: 5, opacity: 1,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(map);

  var clientIcon = L.divIcon({
    className: '',
    html: '<div class="pin-client">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + ACCENT +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/><path d="M10 21v-6h4v6"/></svg>' +
      '</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  var meIcon = L.divIcon({
    className: '',
    html: '<div class="pin-me"><div class="pin-me-dot">' +
      '<svg class="pin-me-arrow" viewBox="0 0 24 24" width="14" height="14" fill="#FFFFFF">' +
      '<path d="M12 2 21 22l-9-5-9 5z"/></svg>' +
      '</div></div>',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });

  var meMarker = null;
  var clientMarker = null;

  map.on('dragstart', function () {
    if (follow) {
      follow = false;
      post({ type: 'follow', value: false });
    }
  });

  // Pusatkan kamera ke montir, digeser agar titiknya berada di tengah area yang
  // tidak tertutup kartu atas/bawah.
  function centerOn(lat, lng, animate) {
    var offset = (TOP_INSET - BOTTOM_INSET) / 2;
    var point = map.project([lat, lng], FOLLOW_ZOOM);
    var center = map.unproject([point.x, point.y - offset], FOLLOW_ZOOM);
    map.setView(center, FOLLOW_ZOOM, { animate: !!animate, duration: 0.6 });
  }

  window.TripMap = {
    setInsets: function (top, bottom) {
      TOP_INSET = top;
      BOTTOM_INSET = bottom;
      // Kartu atas/bawah berubah tinggi (mis. sheet dilipat): jaga montir tetap
      // di tengah area yang terlihat.
      if (follow && meMarker) {
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
      if (follow) {
        centerOn(lat, lng, hasCentered);
        hasCentered = true;
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
      if (meMarker) {
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
