import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getForegroundEpoch, subscribeForeground } from '@/lib/app-lifecycle';

/**
 * Angka yang bertambah setiap aplikasi kembali ke foreground. Cocok dipakai
 * sebagai dependency effect yang perlu dijalankan ulang (mis. resolve signed
 * URL yang mungkin sudah kedaluwarsa).
 */
export function useForegroundEpoch(): number {
  const [epoch, setEpoch] = useState(getForegroundEpoch);

  useEffect(
    () =>
      subscribeForeground(() => {
        setEpoch(getForegroundEpoch());
      }),
    [],
  );

  return epoch;
}

/**
 * Jalankan `callback` saat aplikasi kembali aktif dari background **dan**
 * layar sedang fokus. Tidak dipanggil pada render pertama, dan tidak
 * terpengaruh perubahan identitas callback (memakai ref).
 */
export function useRefreshOnForeground(callback: () => void): void {
  const epoch = useForegroundEpoch();
  const lastEpoch = useRef(epoch);
  const focused = useRef(false);
  const callbackRef = useRef(callback);

  // Ref diperbarui di effect (bukan saat render) agar aman terhadap aturan React.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (epoch === lastEpoch.current) return;
    lastEpoch.current = epoch;
    if (!focused.current) return;
    callbackRef.current();
  }, [epoch]);
}
