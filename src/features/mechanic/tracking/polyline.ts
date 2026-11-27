import type { LatLng } from './geo';

/**
 * Decoder polyline ter-encode milik Google Directions
 * (https://developers.google.com/maps/documentation/utilities/polylinealgorithm).
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];

  const points: LatLng[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let byte = 0;
    let shift = 0;
    let result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

/** Encoder polyline Google Directions untuk menyimpan snapshot rute secara ringkas. */
export function encodePolyline(points: LatLng[]): string {
  if (!points.length) return '';

  const encodeValue = (value: number): string => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = '';
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
    return out;
  };

  let prevLat = 0;
  let prevLng = 0;
  let encoded = '';

  for (const pt of points) {
    const lat = Math.round(pt.latitude * 1e5);
    const lng = Math.round(pt.longitude * 1e5);
    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}
