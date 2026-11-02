import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getLatestMechanicLocation,
  type MechanicLocationSnapshot,
} from '@/features/client/service';
import { fetchTripRoute, type TripRoute } from '@/features/mechanic/tracking/directions';
import { haversineMeters, type LatLng } from '@/features/mechanic/tracking/geo';

/** Selang polling cadangan bila realtime terputus (mis. sinyal lemah). */
const POLL_INTERVAL_MS = 10_000;
/** Rute dihitung ulang setelah montir bergeser sejauh ini … */
const ROUTE_MIN_DISTANCE_M = 30;
/** … atau setelah selang waktu ini, mana pun yang lebih dulu. */
const ROUTE_MIN_INTERVAL_MS = 30_000;
/** Data lebih tua dari ini ditandai sebagai posisi terakhir di UI. */
export const STALE_LOCATION_MS = 45_000;

interface UseMechanicTrackingOptions {
  requestId: string | null | undefined;
  /** Titik lokasi client (tujuan montir). */
  destination: LatLng | null;
  /** Matikan langganan saat order tidak lagi dalam perjalanan. */
  enabled?: boolean;
}

export interface MechanicTracking {
  /** Posisi montir terakhir yang diterima. */
  position: LatLng | null;
  route: TripRoute | null;
  /** true sampai rute pertama selesai dihitung. */
  routeLoading: boolean;
  /** Waktu (epoch ms) sinyal GPS montir terakhir diterima. */
  updatedAt: number | null;
  /** true = belum ada sinyal GPS sama sekali untuk pesanan ini. */
  waiting: boolean;
  /** Pesan kegagalan pembacaan lokasi, bukan kegagalan rute. */
  error: string | null;
}

interface PointSnapshot {
  requestId: string;
  position: LatLng;
  updatedAt: number;
}

interface RouteSnapshot {
  requestId: string;
  route: TripRoute;
}

interface RawLocationRow {
  lat?: number | null;
  lng?: number | null;
  accuracy_meters?: number | null;
  recorded_at?: string | null;
}

/**
 * Memantau posisi montir dari sisi client secara **pasif**.
 *
 * Berbeda dengan `useTripTracking` milik montir, hook ini tidak meminta izin
 * GPS dan tidak pernah menulis posisi. Sumber data:
 *
 * 1. Realtime Supabase — INSERT baru pada `mechanic_locations`
 *    (difilter `request_id`), sehingga titik montir muncul tanpa jeda.
 * 2. Polling 10 detik sebagai cadangan bila websocket terputus.
 *
 * Rute ke lokasi client dihitung ulang hanya saat montir bergeser ≥30 m atau
 * sudah 30 detik, agar tidak membanjiri penyedia rute.
 */
export function useMechanicTracking({
  requestId,
  destination,
  enabled = true,
}: UseMechanicTrackingOptions): MechanicTracking {
  const [point, setPoint] = useState<PointSnapshot | null>(null);
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const lastPointRef = useRef<{ requestId: string; recordedAt: number }>({
    requestId: '',
    recordedAt: 0,
  });
  const lastRouteRequestRef = useRef<string>('');
  const lastRouteOriginRef = useRef<LatLng | null>(null);
  const lastRouteAtRef = useRef(0);
  const routeFetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applySnapshot = useCallback((forRequest: string, snapshot: MechanicLocationSnapshot) => {
    const parsed = Date.parse(snapshot.recorded_at);
    const recordedAt = Number.isFinite(parsed) ? parsed : Date.now();
    const previous = lastPointRef.current;
    // Abaikan titik lama yang datang terlambat (polling vs realtime).
    if (previous.requestId === forRequest && recordedAt < previous.recordedAt) return;
    lastPointRef.current = { requestId: forRequest, recordedAt };
    setPoint({
      requestId: forRequest,
      position: { latitude: snapshot.lat, longitude: snapshot.lng },
      updatedAt: recordedAt,
    });
    setError(null);
  }, []);

  // Ambil titik terakhir saat kartu dibuka + muat ulang secara berkala.
  useEffect(() => {
    if (!enabled || !requestId) return;
    let cancelled = false;

    const read = () => {
      getLatestMechanicLocation(requestId)
        .then((snapshot) => {
          if (cancelled) return;
          if (snapshot) {
            applySnapshot(requestId, snapshot);
          } else {
            setError(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Realtime mungkin masih berjalan; pesan ini hanya informasi.
          setError('Tidak dapat memperbarui posisi montir. Mencoba lagi…');
        });
    };

    read();
    const timer = setInterval(read, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, requestId, applySnapshot]);

  // Realtime: setiap titik baru dari montir langsung ditampilkan.
  useEffect(() => {
    if (!enabled || !requestId) return;
    const channel = supabase
      .channel(`client-mechanic-tracking-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mechanic_locations',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as RawLocationRow;
          if (row.lat == null || row.lng == null || !row.recorded_at) return;
          applySnapshot(requestId, {
            lat: row.lat,
            lng: row.lng,
            accuracy_meters: row.accuracy_meters ?? null,
            recorded_at: row.recorded_at,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, requestId, applySnapshot]);

  // Posisi/rute milik pesanan lain tidak boleh tampil saat order berganti.
  const position = point && point.requestId === requestId ? point.position : null;
  const updatedAt = point && point.requestId === requestId ? point.updatedAt : null;
  const route = routeSnapshot && routeSnapshot.requestId === requestId ? routeSnapshot.route : null;

  // Hitung ulang rute bila tujuan atau posisi montir berubah cukup jauh.
  useEffect(() => {
    if (!enabled || !requestId || !position || !destination) return;
    if (routeFetchingRef.current) return;

    if (lastRouteRequestRef.current !== requestId) {
      lastRouteRequestRef.current = requestId;
      lastRouteOriginRef.current = null;
      lastRouteAtRef.current = 0;
    }

    const now = Date.now();
    const lastOrigin = lastRouteOriginRef.current;
    const moved = lastOrigin ? haversineMeters(lastOrigin, position) : Number.POSITIVE_INFINITY;
    const elapsed = lastRouteAtRef.current ? now - lastRouteAtRef.current : Number.POSITIVE_INFINITY;
    if (route && moved < ROUTE_MIN_DISTANCE_M && elapsed < ROUTE_MIN_INTERVAL_MS) return;

    const forRequest = requestId;
    routeFetchingRef.current = true;
    lastRouteOriginRef.current = position;
    lastRouteAtRef.current = now;

    fetchTripRoute(position, destination)
      .then((next) => {
        if (!mountedRef.current || lastRouteRequestRef.current !== forRequest) return;
        setRouteSnapshot({ requestId: forRequest, route: next });
      })
      .finally(() => {
        routeFetchingRef.current = false;
      });
  }, [enabled, requestId, position, destination, route]);

  return {
    position,
    route,
    routeLoading: position != null && destination != null && route == null,
    updatedAt,
    waiting: position == null,
    error,
  };
}
