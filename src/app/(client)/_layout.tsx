import { Redirect, Stack } from "expo-router";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { useSessionUser } from "@/hooks/use-session-user";

/**
 * Sejak Expo Router SDK 58 route dengan `href: null` di dalam `Tabs` dianggap
 * tidak reachable dan navigasinya dialihkan ke tab awal (Beranda). Karena itu
 * layar pendalaman (detail pesanan, layanan, form request, dst.) dipindahkan
 * ke Stack di level grup, dengan tab sebagai route `(tabs)` di bawahnya.
 */
export const unstable_settings = { anchor: "(tabs)" };

// Guard: hanya role client (dari database) yang boleh masuk section ini (PRD §6).
export default function ClientLayout() {
  const { user, loading } = useSessionUser();

  if (loading) return <AppLoadingScreen instant status="Memeriksa akses…" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "MONTIR") return <Redirect href="/(mechanic)/(tabs)" />;
  if (user.role !== "CLIENT") return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
