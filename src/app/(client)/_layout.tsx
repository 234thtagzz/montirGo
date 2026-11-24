import { Redirect, Stack } from "expo-router";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { useSessionUser } from "@/hooks/use-session-user";
import { ClientAlertsProvider } from "@/features/notifications/client-alerts";
import { IdentityRequiredScreen } from "@/features/auth/components/identity-required";
import { SessionRetryScreen } from "@/features/auth/components/session-retry";

/**
 * Sejak Expo Router SDK 58 route dengan `href: null` di dalam `Tabs` dianggap
 * tidak reachable dan navigasinya dialihkan ke tab awal (Beranda). Karena itu
 * layar pendalaman (detail pesanan, layanan, form request, dst.) dipindahkan
 * ke Stack di level grup, dengan tab sebagai route `(tabs)` di bawahnya.
 */
export const unstable_settings = { anchor: "(tabs)" };

// Guard: hanya role client (dari database) yang boleh masuk section ini (PRD §6).
export default function ClientLayout() {
  const { user, loading, error, refresh } = useSessionUser();

  if (loading) return <AppLoadingScreen instant status="Memeriksa akses…" />;
  if (error === "network") return <SessionRetryScreen onRetry={refresh} />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "ADMIN") return <Redirect href="/(auth)/admin-only" />;
  if (user.role === "MONTIR") return <Redirect href="/(mechanic)/(tabs)" />;
  if (user.role !== "CLIENT") return <Redirect href="/(auth)/login" />;
  if (!user.identityNumber) return <IdentityRequiredScreen onSaved={refresh} />;

  return (
    <ClientAlertsProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ClientAlertsProvider>
  );
}
