import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AssistantChat } from '@/features/ai-assistant/components/assistant-chat';
import type { AssistantVehicleOption } from '@/features/ai-assistant/constants';
import { listMyVehicles } from '@/features/client/service';

/**
 * Chat AI sisi client: diagnosis ringan + tanya harga sparepart.
 * Kendaraan dari Garasi dipakai sebagai konteks agar rentang harga lebih tepat.
 */
export default function ClientAIAssistantScreen() {
  const [vehicles, setVehicles] = useState<AssistantVehicleOption[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      listMyVehicles()
        .then((rows) => {
          if (!active) return;
          setVehicles(
            rows.map((vehicle) => ({
              id: vehicle.id,
              label: [vehicle.brand, vehicle.model, vehicle.year]
                .filter(Boolean)
                .join(' '),
            })),
          );
        })
        .catch(() => {
          // Tanpa data garasi chat tetap jalan dengan konteks "Umum".
        });

      return () => {
        active = false;
      };
    }, []),
  );

  return <AssistantChat persona="client" vehicles={vehicles} />;
}
